import { inputEventEmitter, KeyCode } from "./input";
import { CustomEventEmitter } from "../util/custom_event_emitter";

export let textInputEventEmitter = new CustomEventEmitter<{
    textInput: string
}>();

inputEventEmitter.addListener('keyDown', (e) => {
	let str = e.key;
	if (str.length !== 1) return;

	textInputEventEmitter.emit('textInput', str);
});

export class TextInputStorage extends CustomEventEmitter<{change: string}> {
	private enabled = false;
	public stored: string = "";

	constructor() {
		super();

		textInputEventEmitter.addListener('textInput', (str) => {
			if (this.enabled) {
				this.stored += str;
				this.emit('change', this.stored);
			}
		});
		inputEventEmitter.addListener('keyDown', (e) => {
			if (this.enabled && e.keyCode === KeyCode.Backspace && this.stored.length > 0) {
				this.stored = this.stored.slice(0, -1);
				this.emit('change', this.stored);
			}
		});
	}

	enable() {
		this.enabled = true;
	}

	disable() {
		this.enabled = false;
	}
}