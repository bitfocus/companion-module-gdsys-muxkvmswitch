const { InstanceBase, Regex, runEntrypoint, InstanceStatus } = require('@companion-module/base')
const UpgradeScripts = require('./upgrades')
const UpdateActions = require('./actions')
const UpdateFeedbacks = require('./feedbacks')
const UpdateVariableDefinitions = require('./variables')
const UpdatePresetDefinitions = require('./presets')
const snmp = require('snmp-native')

class MuxInstance extends InstanceBase {
	constructor(internal) {
		super(internal)
	}

	async init(config) {
		this.config = config
		this.dvisignalstatus = []
		this.currentInput = null
		this.loggedErrors = 0
		this.channels = 4 // how many input channels does the device have, will be detected later
		this.oids = [
			[1, 3, 6, 1, 4, 1, 32828, 3, 1792, 1, 2, 4, 1, 0], // selected channel
		] // oids to poll

		this.updateStatus(InstanceStatus.Connecting)

		await this.connect().catch(() => {
			this.updateStatus(InstanceStatus.ConnectionFailure)
		})

		this.updateActions()
		this.updateFeedbacks()
		this.updateVariableDefinitions()
		this.updatePresetDefinitions()

		this.checkInput()
		this.poller = this.startPolling()
	}

	// When module gets deleted
	async destroy() {
		this.stopPolling()
		this.disconnect()
		this.log('debug', 'destroy')
	}

	async connect() {
		this.session = new snmp.Session({
			host: this.config.host,
			port: this.config.port,
			community: this.config.community,
			timeouts: [80, 120, 200],
		})
		await this.checkDevice()
	}

	disconnect() {
		this.session.close()
	}

	switchInput(input) {
		this.session.set(
			{
				oid: [1, 3, 6, 1, 4, 1, 32828, 3, 1792, 1, 2, 4, 1, 0],
				type: 2,
				value: input,
			},
			(error, _varbind) => {
				if (error) {
					this.log('error', 'Could not set input')
					this.updateStatus(InstanceStatus.ConnectionFailure)
				} else {
					if (input !== this.currentInput) {
						this.currentInput = input
						this.setVariableValues({ currentInput: input })
						this.checkFeedbacks('currentInput')
						this.updateStatus(InstanceStatus.Ok)
					}
				}
			}
		)
	}

	async checkDevice() {
		return new Promise((resolve, reject) => {
			this.session.getAll(
				{
					oids: [
						'.1.3.6.1.4.1.32828.3.1792.1.2.1.3.0', // Device type
						'.1.3.6.1.4.1.32828.3.1792.1.2.1.4.0', // serial number
						'.1.3.6.1.4.1.32828.3.1792.1.2.2.1.0', // firmware
					],
					abortOnError: true,
				},
				(error, varbind) => {
					if (error) {
						this.log('error', 'Could not connect to device: ' + error.message)
						this.updateStatus(InstanceStatus.ConnectionFailure)
						reject(error)
					} else {
						let device = varbind[0].value
						let serial = varbind[1].value
						let firmware = varbind[2].value
						this.log('info', `Connected to ${device}, s/n:${serial}, firmware version ${firmware}`)

						const channels = []
						for (let c = 1; c <= 16; c += 1) {
							channels.push({
								cpu: c,
								oid: '.1.3.6.1.4.1.32828.3.1792.1.2.3.1000.1.4.' + c,
							})
						}
						this.session.getAll(
							{
								oids: channels.map((chan) => chan.oid),
								abortOnError: false,
								combinedTimeout: 3000,
							},
							(error, varbinds) => {
								if (error) {
									this.log('error', 'Could not get available channels: ' + error.message)
									this.updateStatus(InstanceStatus.ConnectionFailure)
									return
								}
								this.channels = Math.max(
									...varbinds.filter((vb) => vb.type !== 129).map((vb) => vb.oid[vb.oid.length - 1])
								)
								this.log('info', 'Detected ' + this.channels + ' inputs.')
								this.oids = this.generateOIDs(this.channels)
								resolve()
							}
						)
					}
				}
			)
		})
	}

	generateOIDs(num) {
		const oids = [
			[1, 3, 6, 1, 4, 1, 32828, 3, 1792, 1, 2, 4, 1, 0], // selected channel
		]
		for (let ch = 1; ch <= num; ch += 1) {
			oids.push([1, 3, 6, 1, 4, 1, 32828, 3, 1792, 1, 2, 3, 1001, 1, 5, ch, 1])
		}
		return oids
	}

	checkInput() {
		this.session.getAll(
			{
				oids: this.oids,
			},
			(error, varbind) => {
				if (error || varbind.length < 1) {
					this.currentInput = null
					this.loggedErrors += 1
					if (this.loggedErrors < 3 || this.loggedErrors % 300 == 0) {
						this.log('error', `Could not get input. Tried ${this.loggedErrors}x`)
					}
					this.updateStatus(InstanceStatus.ConnectionFailure)
					return
				}

				if (this.loggedErrors > 0) {
					this.log('info', 'Device back online')
				}
				this.loggedErrors = 0

				if (varbind[0].type !== 2) {
					this.log('error', 'Unexpected result from device (type is ' + varbind[0].type + ', not integer)')
					this.updateStatus(InstanceStatus.UnknownError)
					return
				}
				let input = varbind[0].value
				if (input > 4 || input < 1) {
					this.log('error', 'Unexpected result from device (input out of range)')
					this.updateStatus(InstanceStatus.UnknownError)
					return
				}
				if (input !== this.currentInput) {
					this.currentInput = input
					this.setVariableValues({ currentInput: input })
					this.checkFeedbacks('currentInput')
					this.updateStatus(InstanceStatus.Ok)
				}
				let statusChanged = false
				for (let ch = 1; ch < varbind.length; ch += 1) {
					if (this.dvisignalstatus[ch] != varbind[ch].value) {
						this.dvisignalstatus[ch] = varbind[ch].value
						statusChanged = true
					}
				}
				if (statusChanged) this.checkFeedbacks('dviSignalStatus')
			}
		)
	}

	async configUpdated(config) {
		if (
			config.host !== this.config.host ||
			config.port !== this.config.port ||
			config.community !== this.config.community
		) {
			this.stopPolling()
			this.disconnect()
			this.config = config
			this.connect()
			this.checkInput()
			this.startPolling()
		} else this.config = config
	}

	// Return config fields for web config
	getConfigFields() {
		return [
			{
				type: 'textinput',
				id: 'host',
				label: 'Target IP or hostname',
				width: 8,
				default: '192.168.0.1',
			},
			{
				type: 'textinput',
				id: 'port',
				label: 'Target Port',
				width: 4,
				regex: Regex.PORT,
				default: '161',
			},
			{
				type: 'textinput',
				id: 'community',
				label: 'Read/Write Community',
				width: 4,
				regex: '/^\\w*$/',
				default: 'private',
			},
		]
	}

	startPolling() {
		return setInterval(() => {
			this.checkInput()
		}, 903)
	}

	stopPolling() {
		if (this.poller) clearInterval(this.poller)
	}

	updateActions() {
		UpdateActions(this)
	}

	updateFeedbacks() {
		UpdateFeedbacks(this)
	}

	updateVariableDefinitions() {
		UpdateVariableDefinitions(this)
	}

	updatePresetDefinitions() {
		UpdatePresetDefinitions(this)
	}
}

runEntrypoint(MuxInstance, UpgradeScripts)
