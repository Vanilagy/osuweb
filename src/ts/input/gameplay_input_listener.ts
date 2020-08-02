import { InteractionRegistration } from "./interactivity";
import { KeyCode, MouseButton, getCurrentMousePosition } from "./input";
import { InputStateHookable } from "./input_state_hookable";
import { GameButton } from "./gameplay_input_state";
import { GameplayController } from "../game/gameplay_controller";
import { globalState } from "../global_state";

export class GameplayInputListener extends InputStateHookable {
	private controller: GameplayController;
	private registration: InteractionRegistration;

	constructor(controller: GameplayController, registration: InteractionRegistration) {
		super();

		this.controller = controller;
		this.registration = registration;
		this.registration.allowAllMouseButtons();

		this.registration.addKeybindListener('gameButtonA', 'down', (e) => {
			if (!this.inputStateButtonHook) return;
			if (globalState.settings['disableMouseButtonsDuringGameplay'] && e.sourceEvent instanceof MouseEvent) return;

			let button = (e.keyIndex === 0)? GameButton.A1 : GameButton.A2;
			this.inputStateButtonHook.setButton(button, true, this.getCurrentTime());
		});
		this.registration.addKeybindListener('gameButtonA', 'up', (e) => {
			if (!this.inputStateButtonHook) return;
			if (globalState.settings['disableMouseButtonsDuringGameplay'] && e.sourceEvent instanceof MouseEvent) return;

			let button = (e.keyIndex === 0)? GameButton.A1 : GameButton.A2;
			this.inputStateButtonHook.setButton(button, false, this.getCurrentTime());
		});
		this.registration.addKeybindListener('gameButtonB', 'down', (e) => {
			if (!this.inputStateButtonHook) return;
			if (globalState.settings['disableMouseButtonsDuringGameplay'] && e.sourceEvent instanceof MouseEvent) return;

			let button = (e.keyIndex === 0)? GameButton.B1 : GameButton.B2;
			this.inputStateButtonHook.setButton(button, true, this.getCurrentTime());
		});
		this.registration.addKeybindListener('gameButtonB', 'up', (e) => {
			if (!this.inputStateButtonHook) return;
			if (globalState.settings['disableMouseButtonsDuringGameplay'] && e.sourceEvent instanceof MouseEvent) return;

			let button = (e.keyIndex === 0)? GameButton.B1 : GameButton.B2;
			this.inputStateButtonHook.setButton(button, false, this.getCurrentTime());
		});
		this.registration.addKeybindListener('smoke', 'down', (e) => {
			if (!this.inputStateButtonHook) return;
			this.inputStateButtonHook.setButton(GameButton.Smoke, true, this.getCurrentTime());
		});
		this.registration.addKeybindListener('smoke', 'up', (e) => {
			if (!this.inputStateButtonHook) return;
			this.inputStateButtonHook.setButton(GameButton.Smoke, false, this.getCurrentTime());
		});
		this.registration.addListener('mouseMove', (e) => {
			if (!this.inputStateMouseHook) return;

			let osuPosition = this.controller.currentPlay.toOsuCoordinates(getCurrentMousePosition());
			this.inputStateMouseHook.setMousePosition(osuPosition, this.getCurrentTime());
		});
	}

	private getCurrentTime() {
		return this.controller.currentPlay.getCurrentSongTime();
	}
}