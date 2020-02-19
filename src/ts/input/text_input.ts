import { inputEventEmitter, KeyCode } from "./input";
import { CustomEventEmitter } from "../util/custom_event_emitter";

const textInputElement = document.querySelector('#hidden-text-input') as HTMLInputElement;

export let textInputEventEmitter = new CustomEventEmitter<{
    textInput: string
}>();

inputEventEmitter.addListener('keyDown', () => {
    textInputElement.focus();
});

textInputElement.addEventListener('input', () => {
    let value = textInputElement.value;

    textInputEventEmitter.emit('textInput', value);
    textInputElement.value = "";
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