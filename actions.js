module.exports = function (self) {
	self.setActionDefinitions({
		selectInput: {
			name: 'Select Input',
			options: [
				{
					id: 'input',
					type: 'textinput',
					label: 'Input',
					default: '1',
				},
			],
			callback: async (event) => {
				let input = parseInt(event.options.input)
				if (isNaN(input)) {
					console.log('' + event.options.input + ' is not a number.')
					return
				}
				if (input > self.channels || input < 1) {
					console.log('Device has no input #' + input + '.')
					return
				}
				self.switchInput(input)
			},
		},
		cycleInput: {
			name: 'Cycle Input',
			options: [
				{
					id: 'direction',
					type: 'dropdown',
					label: 'Direction',
					choices: [
						{ id: 1, label: 'forward' },
						{ id: -1, label: 'backward' },
					],
					default: 1,
				},
			],
			callback: async (event) => {
				let input = self.currentInput
				if (input >= 1 && input <= self.channels) {
					input += event.options.direction

					if (input < 1) input = self.channels
					else if (input > self.channels) input = 1

					self.switchInput(input)
				}
			},
		},
	})
}
