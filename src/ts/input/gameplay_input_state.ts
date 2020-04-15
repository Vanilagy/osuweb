import { GameplayController } from "../game/gameplay_controller";
import { Point, clonePoint } from "../util/point";
import { INITIAL_MOUSE_OSU_POSITION } from "../util/constants";
import { Replay, ReplayEventType } from "../game/replay";

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
	private smokeButton: boolean;
	private currentMousePosition: Point;
	private recordingReplay: Replay = null;

	constructor(controller: GameplayController) {
		this.controller = controller;
	}

	private get play() {
		return this.controller.currentPlay;
	}

	reset() {
		this.buttonA = [false, false];
		this.buttonB = [false, false];
		this.currentMousePosition = clonePoint(INITIAL_MOUSE_OSU_POSITION);
		if (this.recordingReplay) this.recordingReplay.clearEventsAndUnfinalize();

		this.smokeButton = false;
	}

	private getButtonTuple(button: GameButton) {
		if (button === GameButton.A1 || button === GameButton.A2) return this.buttonA;
		else return this.buttonB;
	}

	setButton(button: GameButton, state: boolean, time: number) {
		if (!this.play.handlesInputRightNow()) return;

		if (button === GameButton.Smoke) {
			if (state) this.controller.smokeCanvas.press();
			else this.controller.smokeCanvas.release(time);

			this.smokeButton = state;
		} else {
			let tuple = this.getButtonTuple(button);

			let index = (button === GameButton.A1 || button === GameButton.B1)? 0 : 1;
			if (tuple[index] === state) return; // Nothing's changed, don't do anything
	
			let offThen = !tuple.includes(true);
			tuple[index] = state;
	
			if (offThen && state === true) this.play.handleButtonDown(time);
		}

		if (this.recordingReplay && this.play.handlesInputRightNow()) this.recordingReplay.addEvent({
			type: ReplayEventType.Button,
			time: time,
			button: button,
			state: state
		});

		let adjustedTime = this.play.toPlaybackRateIndependentTime(time);
		this.controller.hud.keyCounter.setButtonState(button, state, adjustedTime);
	}

	setMousePosition(osuPosition: Point, time: number) {
		if (!this.play.handlesInputRightNow()) return;
		if (osuPosition === this.currentMousePosition) return; // If nothing changed

		this.currentMousePosition = osuPosition;
		this.play.handleMouseMove(osuPosition, time);
		this.controller.smokeCanvas.moveMouse(osuPosition);

		if (this.recordingReplay && this.play.handlesInputRightNow()) this.recordingReplay.addEvent({
			type: ReplayEventType.Positional,
			time: time,
			position: osuPosition
		});
	}

	getMousePosition() {
		return clonePoint(this.currentMousePosition);
	}

	isAnyButtonPressed() {
		return this.buttonA.includes(true) || this.buttonB.includes(true);
	}

	bindReplayRecording(replay: Replay) {
		this.recordingReplay = replay;
	}

	unbindReplayRecording() {
		this.recordingReplay = null;
	}
}