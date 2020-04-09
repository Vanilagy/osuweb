import { GameplayInputState } from "./gameplay_input_state";

export abstract class InputStateHookable {
	protected inputStateMouseHook: GameplayInputState = null;
	protected inputStateButtonHook: GameplayInputState = null;

	hook(state: GameplayInputState) {
		this.hookMouse(state);
		this.hookButtons(state);
	}

	hookMouse(state: GameplayInputState) {
		this.inputStateMouseHook = state;
	}

	hookButtons(state: GameplayInputState) {
		this.inputStateButtonHook = state;
	}
	
	unhook() {
		this.unhookMouse();
		this.unhookButtons();
	}

	unhookMouse() {
		this.inputStateMouseHook = null;
	}

	unhookButtons() {
		this.inputStateButtonHook = null;
	}
}