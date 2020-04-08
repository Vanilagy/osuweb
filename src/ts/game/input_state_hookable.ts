import { GameplayInputState } from "../input/gameplay_input_state";

export abstract class InputStateHookable {
	protected inputState: GameplayInputState = null;

	hook(state: GameplayInputState) {
		this.inputState = state;
	}
	
	unhook() {
		this.inputState = null;
	}
}