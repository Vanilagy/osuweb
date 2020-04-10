import { Point, lerpPoints } from "../util/point";
import { EaseType, MathUtil } from "../util/math_util";
import { Play } from "./play";
import { GameButton } from "../input/gameplay_input_state";
import { InputStateHookable } from "../input/input_state_hookable";
import { INITIAL_MOUSE_OSU_POSITION, PLAYFIELD_DIMENSIONS } from "../util/constants";
import { ProcessedSlider } from "../datamodel/processed/processed_slider";
import { MAX_RADIANS_PER_MILLISECOND } from "./drawables/drawable_spinner";

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
	// Note that all the events are stored in one array, but there are separate index-keepers for mouse and button events, as these are advanced independently.
	private events: (PositionalReplayEvent | FollowReplayEvent | SpinReplayEvent | ButtonReplayEvent)[] = [];

	private currentMouseEvent: number;
	private currentButtonEvent: number;
	/** Stores the last time a "spin" event caused an input. We need to remember this so that we can ensure deterministic playback. */
	private spinEventLastTimes: Map<SpinReplayEvent, number>;

	private finalized = false;

	constructor() {
		super();
		this.resetPlayback();
	}

	addEvent(event: ButtonReplayEvent | PositionalReplayEvent | FollowReplayEvent | SpinReplayEvent) {
		if (this.finalized) return;
		this.events.push(event);
	}

	clearEventsAndUnfinalize() {
		this.events.length = 0;
		this.finalized = false;
	}

	/** Sorts all the replay events. Needs to be called before playback can be ticked. */
	finalize() {
		this.events.sort((a, b) => a.time - b.time);

		this.finalized = true;
	}

	resetPlayback() {
		this.currentMouseEvent = 0;
		this.currentButtonEvent = 0;
		this.spinEventLastTimes = new Map();
	}

	tickPlayback(currentTime: number) {
		if (!this.finalized) {
			console.error("Cannot tick a Replay that hasn't been finalized!");
			return;
		}

		this.tickButtonEvents(currentTime);
		this.tickMouseEvents(currentTime);
	}

	/** @param indexCap Only tick mouse events before index (the cap itself is exclusive) */
	private tickMouseEvents(currentTime: number, indexCap = Infinity) {
		if (!this.inputStateMouseHook) return;

		while (true) {
			if (this.currentMouseEvent >= indexCap) break;

			let event = this.events[this.currentMouseEvent];
			if (!event) break;
			if (event.type === ReplayEventType.Button) {
				// Skip button events
				this.currentMouseEvent++;
				continue;
			}

			if (event.type === ReplayEventType.Positional && event.time > currentTime) {
				if (!event.leadUpDuration || currentTime < event.time - this.getPositionalEventActualDuration(this.currentMouseEvent)) break;
				// Lets through positional events that are currently in their lead up, but breaks out of the loop for everything else.
			}
			if (event.type === ReplayEventType.Follow || event.type === ReplayEventType.Spin) {
				if (event.time > currentTime) break;
			}

			if (event.type === ReplayEventType.Positional) {
				let pos: Point;
				let duration = this.getPositionalEventActualDuration(this.currentMouseEvent);

				if (duration === 0) {
					// Jump straight to the position since we want to avoid /0 errors.
					pos = event.position;
				} else {
					let beforeIndex = this.getIndexOfLastMouseEventBefore(this.currentMouseEvent);
					let lastEndPos = this.getMouseEventEndPosition(beforeIndex);

					let completion = (currentTime - (event.time - duration)) / duration;
					completion = MathUtil.clamp(completion, 0, 1);
					completion = MathUtil.ease(event.ease, completion);

					pos = lerpPoints(lastEndPos, event.position, completion);
				}
				this.inputStateMouseHook.setMousePosition(pos, Math.min(event.time, currentTime));
			} else if (event.type === ReplayEventType.Follow) {
				let completion = event.slider.getCompletionAtTime(Math.min(currentTime, event.endTime));
				completion = MathUtil.clamp(completion, 0, event.slider.repeat);

				let pos = event.slider.path.getPosFromPercentage(MathUtil.mirror(completion));
				this.inputStateMouseHook.setMousePosition(pos, currentTime);
			} else if (event.type === ReplayEventType.Spin) {
				let beforeIndex = this.getIndexOfLastMouseEventBefore(this.currentMouseEvent);
				let lastEndPos = this.getMouseEventEndPosition(beforeIndex);
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
					this.inputStateMouseHook.setMousePosition(pos, time);

					newLastEvaluatedTime = time;
				}

				// Note that we don't do an input for the very end of the slider, because the spinner would trash that input

				this.spinEventLastTimes.set(event, newLastEvaluatedTime);
			}

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
		if (!this.inputStateButtonHook) return;

		while (true) {
			let event = this.events[this.currentButtonEvent];
			if (!event) break;
			if (event.time > currentTime) break;
			if (event.type !== ReplayEventType.Button) {
				// Skip mouse events
				this.currentButtonEvent++;
				continue;
			}

			// Before we apply the button event, apply all mouse events to this time and index
 			this.tickMouseEvents(event.time, this.currentButtonEvent);
			this.inputStateButtonHook.setButton(event.button, event.state, event.time);

			this.currentButtonEvent++;
		}
	}

	private getIndexOfLastMouseEventBefore(index: number) {
		for (let i = index-1; i >= 0; i--) {
			if (this.events[i].type !== ReplayEventType.Button) return i;
		}

		return -1;
	}

	/** Returns the last mouse position of a given mouse event. */
	private getMouseEventEndPosition(index: number): Point {
		let event = this.events[index];

		if (!event) return INITIAL_MOUSE_OSU_POSITION;
		else if (event.type === ReplayEventType.Positional) return event.position;
		else if (event.type === ReplayEventType.Follow) {
			let endTimeCompletion = event.slider.getCompletionAtTime(event.endTime);
			let mirroredCompletion = MathUtil.mirror(endTimeCompletion);

			return event.slider.path.getPosFromPercentage(mirroredCompletion);
		} else if (event.type === ReplayEventType.Spin) {
			let lastEndPos = this.getMouseEventEndPosition(this.getIndexOfLastMouseEventBefore(index));
			return Replay.getSpinningPositionOverTime(lastEndPos, event.endTime - event.time);
		}
	
		return null;
	}

	private getMouseEventEndTime(index: number) {
		let event = this.events[index];
		if (!event) return -Infinity;
		if (event.type === ReplayEventType.Button) return null;
		
		else if (event.type === ReplayEventType.Positional) return event.time;
		else return event.endTime;
	}

	private getPositionalEventActualDuration(index: number) {
		let event = this.events[index] as PositionalReplayEvent;
		if (!event.leadUpDuration) return 0;

		let lastTime = this.getMouseEventEndTime(this.getIndexOfLastMouseEventBefore(index));
		return Math.min(event.leadUpDuration, event.time - lastTime);
	}

	/** Calculates from given starting position the mouse position after a certain elapsed time of spinning. */
	static getSpinningPositionOverTime(startingPosition: Point, elapsedTime: number): Point {
		let middleX = PLAYFIELD_DIMENSIONS.width/2,
			middleY = PLAYFIELD_DIMENSIONS.height/2;

		let radiusLerpCompletion = elapsedTime / RADIUS_LERP_DURATION;
		radiusLerpCompletion = MathUtil.clamp(radiusLerpCompletion, 0, 1);
		radiusLerpCompletion = MathUtil.ease(EaseType.EaseInOutQuad, radiusLerpCompletion);
		let spinRadius = MathUtil.lerp(MathUtil.fastHypot(startingPosition.x - middleX, startingPosition.y - middleY), DEFAULT_SPIN_RADIUS, radiusLerpCompletion);
		let angle = Math.atan2(startingPosition.y - middleY, startingPosition.x - middleX) - (MAX_RADIANS_PER_MILLISECOND * 1.1) * elapsedTime; // Minus, because spinning counter-clockwise looks so much better. Spin a bit faster than max speed so that we can be *sure* we spin at max speed.

		return {
			x: middleX + Math.cos(angle) * spinRadius,
			y: middleY + Math.sin(angle) * spinRadius
		};
	}
}