import { Point, lerpPoints } from "../util/point";
import { EaseType, MathUtil } from "../util/math_util";
import { Play } from "./play";
import { GameButton } from "../input/gameplay_input_state";
import { InputStateHookable } from "./input_state_hookable";
import { INITIAL_MOUSE_OSU_POSITION, PLAYFIELD_DIMENSIONS } from "../util/constants";
import { ProcessedSlider } from "../datamodel/processed/processed_slider";

const DEFAULT_SPIN_RADIUS = 45;
const RADIUS_LERP_DURATION = 333;

export enum ReplayEventType {
	Button,
	Positional,
	Follow,
	Spin
}

export interface ReplayEvent {
	type: ReplayEventType,
	time: number
}

export interface ButtonReplayEvent extends ReplayEvent {
	type: ReplayEventType.Button,
	state: boolean,
	button: GameButton
}

export interface PositionalReplayEvent extends ReplayEvent {
	type: ReplayEventType.Positional,
	position: Point,
	ease?: EaseType,
	leadUpDuration?: number
}

export interface FollowReplayEvent extends ReplayEvent {
	type: ReplayEventType.Follow,
	slider: ProcessedSlider,
	endTime: number
}

export interface SpinReplayEvent extends ReplayEvent {
	type: ReplayEventType.Spin,
	endTime: number
}

export class Replay extends InputStateHookable {
	private mouseEvents: (PositionalReplayEvent | FollowReplayEvent | SpinReplayEvent)[] = [];
	private buttonEvents: ButtonReplayEvent[] = [];

	private currentMouseEvent: number;
	private currentButtonEvent: number;
	private spinEventLastTimes: Map<SpinReplayEvent, number>;

	private finalized = false;

	constructor() {
		super();
		this.resetPlayback();
	}

	addEvent(event: ButtonReplayEvent | PositionalReplayEvent | FollowReplayEvent | SpinReplayEvent) {
		if (this.finalized) return;

		if (event.type === ReplayEventType.Button) this.buttonEvents.push(event);
		else this.mouseEvents.push(event);
	}

	/** Sorts all the replay events. Needs to be called before playback can be ticked. */
	finalize() {
		this.mouseEvents.sort((a, b) => a.time - b.time);
		this.buttonEvents.sort((a, b) => a.time - b.time);

		this.finalized = true;
	}

	resetPlayback() {
		this.currentMouseEvent = 0;
		this.currentButtonEvent = 0;
		this.spinEventLastTimes = new Map();
	}

	tickPlayback(currentTime: number) {
		if (!this.inputState || !this.finalized) return;

		this.tickButtonEvents(currentTime);
		this.tickMouseEvents(currentTime);
	}

	private tickMouseEvents(currentTime: number) {
		while (true) {
			let event = this.mouseEvents[this.currentMouseEvent];
			if (!event) break;

			if (event.type === ReplayEventType.Positional && event.time > currentTime) {
				if (!event.leadUpDuration || currentTime < event.time - event.leadUpDuration) break;
				// Lets through positional events that are currently in their lead up, but breaks out of the loop for everything else.
			}
			if (event.type === ReplayEventType.Follow || event.type === ReplayEventType.Spin) {
				if (event.time > currentTime) break;
			}

			if (event.type === ReplayEventType.Positional) {
				let pos: Point;

				if (!event.leadUpDuration) {
					pos = event.position;
				} else {
					let lastEndPos = this.getMouseEventEndPosition(this.currentMouseEvent - 1);
					let lastTime = this.getMouseEventEndTime(this.currentMouseEvent - 1);

					let duration = Math.min(event.leadUpDuration, event.time - lastTime);
					let completion = (currentTime - (event.time - duration)) / duration;
					completion = MathUtil.clamp(completion, 0, 1);
					completion = MathUtil.ease(event.ease, completion);

					pos = lerpPoints(lastEndPos, event.position, completion);
				}
				this.inputState.setMousePosition(pos, event.time);
			} else if (event.type === ReplayEventType.Follow) {
				let completion = event.slider.getCompletionAtTime(Math.min(currentTime, event.endTime));
				completion = MathUtil.clamp(completion, 0, event.slider.repeat);

				let pos = event.slider.path.getPosFromPercentage(MathUtil.mirror(completion));
				this.inputState.setMousePosition(pos, currentTime);
			} else if (event.type === ReplayEventType.Spin) {
				let lastEndPos = this.getMouseEventEndPosition(this.currentMouseEvent - 1);
				let lastEvaulatedTime = this.spinEventLastTimes.get(event);
				if (lastEvaulatedTime === undefined) lastEvaulatedTime = -Infinity;

				const timePerTick = 4; // Each tick advances us 4ms
				let startingTick = Math.floor(Math.max(0, (lastEvaulatedTime - event.time) / timePerTick));
				let newLastEvaluatedTime = lastEvaulatedTime;

				for (let tick = startingTick; true; tick++) {
					let time = event.time + tick * timePerTick;
					if (time <= lastEvaulatedTime) continue;
					if (time > currentTime) break;
					if (time >= event.endTime) break;

					let pos = Replay.getSpinningPositionOverTime(lastEndPos, time - event.time);
					this.inputState.setMousePosition(pos, time);

					newLastEvaluatedTime = time;
				}

				if (lastEvaulatedTime < event.endTime && currentTime >= event.endTime) {
					let spinnerEndPos = this.getMouseEventEndPosition(this.currentMouseEvent);
					this.inputState.setMousePosition(spinnerEndPos, event.endTime);

					newLastEvaluatedTime = event.endTime;
				}

				this.spinEventLastTimes.set(event, newLastEvaluatedTime);
			}

			if (this.currentMouseEvent === this.mouseEvents.length-1) break;

			let skipToNext = false;
			if (event.type === ReplayEventType.Positional && currentTime >= event.time) {
				skipToNext = true;
			}
			if ((event.type === ReplayEventType.Follow || event.type === ReplayEventType.Spin) && currentTime >= event.endTime) {
				skipToNext = true;
			}

			if (skipToNext) {
				this.currentMouseEvent++;
				continue;
			}

			break;
		}
	}

	private tickButtonEvents(currentTime: number) {
		while (true) {
			let event = this.buttonEvents[this.currentButtonEvent];
			if (!event) break;
			if (event.time > currentTime) break;

 			this.tickMouseEvents(event.time);
			this.inputState.setButton(event.button, event.state, event.time);

			this.currentButtonEvent++;
		}
	}

	private getMouseEventEndPosition(index: number): Point {
		let event = this.mouseEvents[index];

		if (!event) return INITIAL_MOUSE_OSU_POSITION;
		else if (event.type === ReplayEventType.Positional) return event.position;
		else if (event.type === ReplayEventType.Follow) {
			let endTimeCompletion = event.slider.getCompletionAtTime(event.endTime);
			let mirroredCompletion = MathUtil.mirror(endTimeCompletion);

			return event.slider.path.getPosFromPercentage(mirroredCompletion);
		} else if (event.type === ReplayEventType.Spin) {
			let lastEndPos = this.getMouseEventEndPosition(index-1);
			return Replay.getSpinningPositionOverTime(lastEndPos, event.endTime - event.time);
		}
	
		return null;
	}

	private getMouseEventEndTime(index: number) {
		let event = this.mouseEvents[index];

		if (!event) return -Infinity;
		else if (event.type === ReplayEventType.Positional) return event.time;
		else return event.endTime;
	} 

	static getSpinningPositionOverTime(startingPosition: Point, elapsedTime: number): Point {
		let middleX = PLAYFIELD_DIMENSIONS.width/2,
			middleY = PLAYFIELD_DIMENSIONS.height/2;

		let radiusLerpCompletion = elapsedTime / RADIUS_LERP_DURATION;
		radiusLerpCompletion = MathUtil.clamp(radiusLerpCompletion, 0, 1);
		radiusLerpCompletion = MathUtil.ease(EaseType.EaseInOutQuad, radiusLerpCompletion);
		let spinRadius = MathUtil.lerp(MathUtil.fastHypot(startingPosition.x - middleX, startingPosition.y - middleY), DEFAULT_SPIN_RADIUS, radiusLerpCompletion);
		let angle = Math.atan2(startingPosition.y - middleY, startingPosition.x - middleX) - 0.06 * elapsedTime; // Minus, because spinning counter-clockwise looks so much better.

		return {
			x: middleX + Math.cos(angle) * spinRadius,
			y: middleY + Math.sin(angle) * spinRadius
		};
	}
}