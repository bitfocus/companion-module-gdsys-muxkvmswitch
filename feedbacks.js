const { combineRgb } = require('@companion-module/base')

module.exports = async function (self) {
	self.setFeedbackDefinitions({
		currentInput: {
			name: 'Current Input',
			type: 'boolean',
			defaultStyle: {
				bgcolor: combineRgb(255, 0, 0),
				color: combineRgb(0, 0, 0),
			},
			options: [
				{
					id: 'input',
					type: 'number',
					label: 'Input',
					default: 1,
					min: 1,
					max: self.channels,
				},
			],
			callback: (feedback) => {
				if (feedback.options.input == self.currentInput) {
					return true
				} else {
					return false
				}
			},
		},
		dviSignalStatus: {
			name: 'DVI Signal Status',
			type: 'boolean',
			defaultStyle: {
				bgcolor: combineRgb(0, 152, 0),
				color: combineRgb(0, 0, 0),
			},
			options: [
				{
					id: 'input',
					type: 'number',
					label: 'Input',
					default: 1,
					min: 1,
					max: self.channels,
				},
			],
			callback: (feedback) => {
				if (self.dvisignalstatus[feedback.options.input] == 1) {
					return true
				} else {
					return false
				}
			},
		},
	})
}
