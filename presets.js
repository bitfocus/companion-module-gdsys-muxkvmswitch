const { combineRgb } = require('@companion-module/base')

{
	combineRgb
}

module.exports = function (self) {
	const presets = {}
	for (let i = 1; i <= self.channels; i += 1) {
		presets[`input${i}`] = {
			type: 'button',
			category: 'Switch Input',
			name: `Switch to input ${i}`,
			style: {
				text: `KVM ${i}`,
				size: 'auto',
				color: combineRgb(190, 190, 190),
				bgcolor: combineRgb(30, 30, 30),
			},
			steps: [
				{
					down: [
						{
							actionId: 'selectInput',
							options: {
								input: `${i}`,
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'dviSignalStatus',
					options: {
						input: `${i}`,
					},
					style: {
						color: combineRgb(255, 255, 255),
						bgcolor: combineRgb(0, 80, 0),
					},
				},
				{
					feedbackId: 'currentInput',
					options: {
						input: `${i}`,
					},
					style: {
						bgcolor: combineRgb(255, 190, 0),
						color: combineRgb(0, 0, 0),
					},
				},
			],
		}
	}

	presets['cycleLeft'] = {
		type: 'button',
		category: 'Cycle Input',
		name: `Cycle input backward`,
		style: {
			text: `<<<\\nKVM $(muxkvm:currentInput)`,
			size: 'auto',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(30, 30, 30),
		},
		steps: [
			{
				down: [
					{
						actionId: 'cycleInput',
						options: {
							direction: -1,
						},
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	}

	presets['cycleRight'] = {
		type: 'button',
		category: 'Cycle Input',
		name: `Cycle input forward`,
		style: {
			text: `>>>\\nKVM $(muxkvm:currentInput)`,
			size: 'auto',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(30, 30, 30),
		},
		steps: [
			{
				down: [
					{
						actionId: 'cycleInput',
						options: {
							direction: 1,
						},
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	}

	self.setPresetDefinitions(presets)
}
