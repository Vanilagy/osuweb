import { GameplayController } from "../game/gameplay_controller";
import { Point, clonePoint } from "../util/point";
import { INITIAL_MOUSE_OSU_POSITION } from "../util/constants";

export enum GameButton {
	A1,
	A2,
	B1,
	B2,
	Smoke
}

export class GameplayInputState {
	private controller: GameplayController;
	private buttonA: [boolean, boolean];
	private buttonB: [boolean, boolean];
	private currentMousePosition: Point;

	constructor(controller: GameplayController) {
		this.controller = controller;
	}

	reset() {
		this.buttonA = [false, false];
		this.buttonB = [false, false];
		this.currentMousePosition = clonePoint(INITIAL_MOUSE_OSU_POSITION);
	}

	private getButtonTuple(button: GameButton) {
		if (button === GameButton.A1 || button === GameButton.A2) return this.buttonA;
		else return this.buttonB;
	}

	setButton(button: GameButton, state: boolean, time?: number) {
		let tuple = this.getButtonTuple(button);
		let offThen = !tuple.includes(true);

		if (button === GameButton.A1 || button === GameButton.B1) tuple[0] = state;
		else tuple[1] = state;

		let onNow = tuple.includes(true);

		if (offThen && onNow) this.controller.currentPlay.handleButtonDown(time);
	}

	setMousePosition(osuPosition: Point, time?: number) {
		if (osuPosition === this.currentMousePosition) return; // If nothing changed

		this.currentMousePosition = osuPosition;
		this.controller.currentPlay.handleMouseMove(osuPosition, time);
	}

	getMousePosition() {
		return clonePoint(this.currentMousePosition);
	}

	isAnyButtonPressed() {
		return this.buttonA.includes(true) || this.buttonB.includes(true);
	}
}