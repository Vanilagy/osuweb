import { CustomEventEmitter } from "../util/custom_event_emitter";
import { InteractionRegistration } from "./interactivity";
import { KeyCode, MouseButton } from "./input";

export const GAME_KEYS: [number, number] = [KeyCode.X, KeyCode.Y];

export class GameplayInputController extends CustomEventEmitter<{gameButtonDown: void}> {
	private registration: InteractionRegistration;
	private keyButtonState: [boolean, boolean] = [false, false];
	private mouseButtonState: [boolean, boolean] = [false, false];

	constructor(registration: InteractionRegistration) {
		super();

		this.registration = registration;
		this.registration.allowAllMouseButtons();

		this.registration.addListener('keyDown', (e) => {
			let index = GAME_KEYS.indexOf(e.keyCode);
			if (index === -1) return;

			if (!this.keyButtonState[index]) {
				this.keyButtonState[index] = true;
				if (!this.mouseButtonState[index]) this.trigger();
			}
		});
		this.registration.addListener('keyUp', (e) => {
			let index = GAME_KEYS.indexOf(e.keyCode);
			if (index === -1) return;

			this.keyButtonState[index] = false;
		});
		this.registration.addListener('mouseDown', (e) => {
			let index: number;
			if (e.button === MouseButton.Left) index = 0;
			else if (e.button === MouseButton.Right) index = 1;
			else return;

			if (!this.mouseButtonState[index]) {
				this.mouseButtonState[index] = true;
				if (!this.keyButtonState[index]) this.trigger();
			}
		});
		this.registration.addListener('mouseUp', (e) => {
			let index: number;
			if (e.button === MouseButton.Left) index = 0;
			else if (e.button === MouseButton.Right) index = 1;
			else return;

			this.mouseButtonState[index] = false;
		});
	}

	trigger() {
		this.emit('gameButtonDown');
	}

	isAnyButtonPressed() {
		return this.keyButtonState.includes(true) || this.mouseButtonState.includes(true);
	}

	reset() {
		this.keyButtonState = [false, false];
		this.mouseButtonState = [false, false];
	}
}