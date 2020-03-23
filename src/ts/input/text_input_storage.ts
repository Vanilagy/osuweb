import { KeyCode } from "./input";
import { CustomEventEmitter } from "../util/custom_event_emitter";
import { InteractionRegistration } from "./interactivity";

export class TextInputStorage extends CustomEventEmitter<{change: string}> {
	private registration: InteractionRegistration;
	public stored: string = "";

	constructor(registration: InteractionRegistration) {
		super();

		this.registration = registration;
		this.registration.addListener('keyDown', (e) => {
			if (e.keyCode === KeyCode.Backspace) {
				if (this.stored.length > 0) {
					this.stored = this.stored.slice(0, -1);
					this.emit('change', this.stored);
				}
			} else {
				let str = e.key;
				if (str.length !== 1) return;

				this.stored += str;
				this.emit('change', this.stored);
			}
		});
	}
}