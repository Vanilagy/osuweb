import { CustomEventEmitter } from "../util/custom_event_emitter";
import { InteractionRegistration } from "./interactivity";
import { KeyCode, MouseButton, getCurrentMousePosition } from "./input";
import { InputStateHookable } from "../game/input_state_hookable";
import { GameButton } from "./gameplay_input_state";
import { GameplayController } from "../game/gameplay_controller";

export const GAME_KEYS: [number, number] = [KeyCode.X, KeyCode.Y];

export class GameplayInputListener extends InputStateHookable {
	private controller: GameplayController;
	private registration: InteractionRegistration;

	constructor(controller: GameplayController, registration: InteractionRegistration) {
		super();

		this.controller = controller;
		this.registration = registration;
		this.registration.allowAllMouseButtons();

		this.registration.addListener('keyDown', (e) => {
			if (!this.inputState) return;

			let index = GAME_KEYS.indexOf(e.keyCode);
			if (index === -1) return;

			let button = (index === 0)? GameButton.A1 : GameButton.B1;
			this.inputState.setButton(button, true);
		});
		this.registration.addListener('keyUp', (e) => {
			if (!this.inputState) return;

			let index = GAME_KEYS.indexOf(e.keyCode);
			if (index === -1) return;

			let button = (index === 0)? GameButton.A1 : GameButton.B1;
			this.inputState.setButton(button, false);
		});
		this.registration.addListener('mouseDown', (e) => {
			if (!this.inputState) return;

			if (e.button !== MouseButton.Left && e.button !== MouseButton.Right) return;

			let button = (e.button === MouseButton.Left)? GameButton.A2 : GameButton.B2;
			this.inputState.setButton(button, true);
		});
		this.registration.addListener('mouseUp', (e) => {
			if (!this.inputState) return;

			if (e.button !== MouseButton.Left && e.button !== MouseButton.Right) return;

			let button = (e.button === MouseButton.Left)? GameButton.A2 : GameButton.B2;
			this.inputState.setButton(button, false);
		});
		this.registration.addListener('mouseMove', (e) => {
			if (!this.inputState) return;

			let osuPosition = this.controller.currentPlay.toOsuCoordinates(getCurrentMousePosition());
			this.inputState.setMousePosition(osuPosition);
		});
	}
}