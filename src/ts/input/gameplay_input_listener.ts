import { InteractionRegistration } from "./interactivity";
import { KeyCode, MouseButton, getCurrentMousePosition } from "./input";
import { InputStateHookable } from "./input_state_hookable";
import { GameButton } from "./gameplay_input_state";
import { GameplayController } from "../game/gameplay_controller";
import { globalState } from "../global_state";

export const GAME_KEYS: [number, number] = [KeyCode.X, KeyCode.Y];
const SMOKE_KEY = KeyCode.C;

export class GameplayInputListener extends InputStateHookable {
	private controller: GameplayController;
	private registration: InteractionRegistration;

	constructor(controller: GameplayController, registration: InteractionRegistration) {
		super();

		this.controller = controller;
		this.registration = registration;
		this.registration.allowAllMouseButtons();

		this.registration.addListener('keyDown', (e) => {
			if (!this.inputStateButtonHook) return;

			if (e.keyCode === SMOKE_KEY) {
				this.inputStateButtonHook.setButton(GameButton.Smoke, true, this.getCurrentTime());
				return;
			}

			let index = GAME_KEYS.indexOf(e.keyCode);
			if (index === -1) return;

			let button = (index === 0)? GameButton.A1 : GameButton.B1;
			this.inputStateButtonHook.setButton(button, true, this.getCurrentTime());
		});
		this.registration.addListener('keyUp', (e) => {
			if (!this.inputStateButtonHook) return;

			if (e.keyCode === SMOKE_KEY) {
				this.inputStateButtonHook.setButton(GameButton.Smoke, false, this.getCurrentTime());
				return;
			}

			let index = GAME_KEYS.indexOf(e.keyCode);
			if (index === -1) return;

			let button = (index === 0)? GameButton.A1 : GameButton.B1;
			this.inputStateButtonHook.setButton(button, false, this.getCurrentTime());
		});
		this.registration.addListener('mouseDown', (e) => {
			if (!this.inputStateButtonHook || globalState.settings['disableMouseButtonsDuringGameplay']) return;

			if (e.button !== MouseButton.Left && e.button !== MouseButton.Right) return;

			let button = (e.button === MouseButton.Left)? GameButton.A2 : GameButton.B2;
			this.inputStateButtonHook.setButton(button, true, this.getCurrentTime());
		});
		this.registration.addListener('mouseUp', (e) => {
			if (!this.inputStateButtonHook || globalState.settings['disableMouseButtonsDuringGameplay']) return;

			if (e.button !== MouseButton.Left && e.button !== MouseButton.Right) return;

			let button = (e.button === MouseButton.Left)? GameButton.A2 : GameButton.B2;
			this.inputStateButtonHook.setButton(button, false, this.getCurrentTime());
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