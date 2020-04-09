import { Play } from "../play";
import { Point } from "../../util/point";
import { EaseType } from "../../util/math_util";
import { PLAYFIELD_DIMENSIONS } from "../../util/constants";
import { ProcessedHitObject } from "../../datamodel/processed/processed_hit_object";
import { ProcessedBeatmap } from "../../datamodel/processed/processed_beatmap";
import { ProcessedCircle } from "../../datamodel/processed/processed_circle";
import { ProcessedSlider } from "../../datamodel/processed/processed_slider";
import { ProcessedSpinner } from "../../datamodel/processed/processed_spinner";
import { Mod, modMultipliers, modIncompatibilities } from "../../datamodel/mods";
import { Replay, ReplayEventType } from "../replay";
import { GameButton } from "../../input/gameplay_input_state";
import { PlayEvent, PlayEventType } from "../../datamodel/play_events";

const SPINNER_END_REDUCTION = 1; // For edge cases where objects might start immediately after spinner. Done so movement will be correct.
const STREAM_BPM_THRESHOLD = 140; // Starting at this BPM, consecutive quarter notes count as a stream.
const STREAM_TIME_THRESHOLD = 60000 / STREAM_BPM_THRESHOLD / 4;

export const HALF_TIME_PLAYBACK_RATE = 2/3;
export const DOUBLE_TIME_PLAYBACK_RATE = 3/2;

enum WaypointType {
	Positional,
	SpinnerStart,
	SpinnerEnd
}

interface Waypoint {
	type: WaypointType, 
	time: number,
	pos?: Point,
	hitObject: ProcessedHitObject
}

export enum AutoInstructionType {
	Blink,
	Move,
	Follow,
	Spin
}

export interface AutoInstruction {
	type: AutoInstructionType,
	time: number,
	endTime?: number,
	to?: Point,
	startPos?: Point,
	endPos?: Point,
	hitObject?: ProcessedHitObject
}

function hardRockFlipPoint(point: Point) {
	// Mirror the point on the horizontal line that goes through the playfield center.
	point.y = PLAYFIELD_DIMENSIONS.height - point.y;
}

export class ModHelper {
	static getModsFromModCode(modCode: string) {
		let chunks: string[] = [];
		let set = new Set<Mod>();
	
		for (let i = 0; i < modCode.length; i += 2) {
			chunks.push(modCode.slice(i, i+2));
		}

		for (let chunk of chunks) {
			if (!Object.values(Mod).includes(chunk as Mod)) continue;
			set.add(chunk as Mod);
		}

		return set;
	}

	// Checks if a combination of mods is valid. For example: HDDT is valid, but DTHT is not. HR is valid, but HREZ is not.
	static validateModSelection(mods: Set<Mod>) {
		for (let group of modIncompatibilities) {
			let count = 0;

			mods.forEach((mod) => {
				if (group.includes(mod)) count++
			});

			if (count > 1) return false; // More than one mod from this group!
		}

		return true;
	}

	// TODO: Apply health respawn thing.
	static applyEz(processedBeatmap: ProcessedBeatmap) {
		let difficulty = processedBeatmap.difficulty;

		difficulty.CS /= 2; // half, no lower limit, this can actually go to CS 1
		difficulty.AR /= 2; // half
		difficulty.OD /= 2; // half
		difficulty.HP /= 2; // half
	}

	/** Change the difficulty values and perform the point flipping. */
	static applyHr(processedBeatmap: ProcessedBeatmap) {
		let difficulty = processedBeatmap.difficulty;

		difficulty.CS = Math.min(7, difficulty.CS * 1.3); // cap at 7, and yes, the 1.3 is correct
		difficulty.AR = Math.min(10, difficulty.AR * 1.4); // cap at 10
		difficulty.OD = Math.min(10, difficulty.OD * 1.4); // cap at 10
		difficulty.HP = Math.min(10, difficulty.HP * 1.4); // cap at 10

		for (let i = 0; i < processedBeatmap.hitObjects.length; i++) {
			let hitObject = processedBeatmap.hitObjects[i];

			if (hitObject instanceof ProcessedCircle) {
				hardRockFlipPoint(hitObject.startPoint);
				// Since endPoint === startPoint, this also flips endPoint
			} else if (hitObject instanceof ProcessedSlider) {
				hardRockFlipPoint(hitObject.startPoint);
				hardRockFlipPoint(hitObject.tailPoint);
				// Since endPoint is either startPoint or tailPoint, we'll have flipped endPoint.

				let path = hitObject.path;
				for (let i = 0; i < path.points.length; i++) {
					hardRockFlipPoint(path.points[i]);
				}
			}
		}
	}

	static calculateModMultiplier(mods: Set<Mod>) {
		let multiplier = 1.0;

		mods.forEach((mod) => multiplier *= modMultipliers.get(mod));

		return multiplier;
	}

	static createAutoReplay(play: Play, autopilot = false) {
		console.time("Auto replay generation");

		// Generates waypoints from start and end positions aswell as slider ticks and spinners.
		// Will be used to construct mouse and button instructions.
		let waypoints: Waypoint[] = [];
		for (let i = 0; i < play.processedBeatmap.hitObjects.length; i++) {
			let hitObject = play.processedBeatmap.hitObjects[i];

			if (hitObject instanceof ProcessedCircle) {
				waypoints.push({
					type: WaypointType.Positional,
					time: hitObject.startTime,
					pos: hitObject.startPoint,
					hitObject: hitObject
				});
			} else if (hitObject instanceof ProcessedSlider) {
				let sliderEvents: PlayEvent[] = [];
				hitObject.addPlayEvents(sliderEvents);

				// Simply add a positional waypoint for each slider event.
				for (let j = 0; j < sliderEvents.length; j++) {
					let event = sliderEvents[j];
					if (event.type === PlayEventType.HeadHitWindowEnd || event.type === PlayEventType.SliderSlide) continue;

					waypoints.push({
						type: WaypointType.Positional,
						time: event.time,
						pos: event.position,
						hitObject: hitObject
					});
				}
			} else if (hitObject instanceof ProcessedSpinner) {
				waypoints.push({
					type: WaypointType.SpinnerStart,
					time: hitObject.startTime,
					hitObject: hitObject
				});
				waypoints.push({
					type: WaypointType.SpinnerEnd,
					time: hitObject.endTime - SPINNER_END_REDUCTION,
					hitObject: hitObject
				});
			}
		}
		waypoints.sort((a, b) => a.time - b.time);

		let replay = new Replay();
		let buttonAReleaseTime = -Infinity;
		let buttonBReleaseTime = -Infinity;
		let currentSpinnerCount = 0;

		/** Gets the next button to be pressed down. Makes sure to alternate buttons if buttons are being pressed down fast. */
		function getNextButton(time: number) {
			if (time - buttonAReleaseTime >= STREAM_TIME_THRESHOLD * play.playbackRate) return GameButton.A1;

			if (buttonAReleaseTime > buttonBReleaseTime) return GameButton.B1;
			else return GameButton.A1;
		}
		function releaseButton(button: GameButton, time: number) {
			if (button === GameButton.A1) buttonAReleaseTime = time;
			else buttonBReleaseTime = time;
		}

		for (let i = 0; i < waypoints.length; i++) {
			let waypoint = waypoints[i];

			if (waypoint.type === WaypointType.Positional) {
				let lastWaypointTime = (i === 0)? -Infinity : waypoints[i-1].time;
				// Switch to linear easing for streams and such, as they tend to be played more in a continuous movement as opposed to move-and-stop.
				let ease = ((waypoint.time - lastWaypointTime) <= STREAM_TIME_THRESHOLD * play.playbackRate)? EaseType.Linear : EaseType.EaseOutQuad;
				if (autopilot) ease = EaseType.EaseInOutQuint; // This ease will spend the least amount of time "travelling", therefore giving the player the greatest hit window

				replay.addEvent({
					type: ReplayEventType.Positional,
					time: waypoint.time,
					position: waypoint.pos,
					ease: ease,
					leadUpDuration: play.approachTime
				});

				let button = getNextButton(waypoint.time);
				replay.addEvent({
					type: ReplayEventType.Button,
					time: waypoint.time,
					button: button,
					state: true
				});

				// This is <= instead of < so that we get an extra iteration when we're past all waypoints
				for (let j = i+1; j <= waypoints.length; j++) {
					let otherWaypoint = waypoints[j];

					// We check if the next waypoint belongs to the current hit object (and thus is part of a slider)
					if (otherWaypoint && otherWaypoint.hitObject === waypoint.hitObject && currentSpinnerCount === 0) {
						// We can safely skip the next waypoint
						i++;
					} else {
						// We'll always land in this "else" block if the current hit object isn't a slider

						let prevWaypoint = waypoints[j-1];
						let nextWaypointTime = otherWaypoint? otherWaypoint.time : Infinity;

						if (prevWaypoint !== waypoint && currentSpinnerCount === 0) replay.addEvent({
							type: ReplayEventType.Follow,
							time: waypoint.time,
							endTime: prevWaypoint.time,
							slider: waypoint.hitObject as ProcessedSlider
						});

						let buttonReleaseTime = prevWaypoint.time + Math.min(nextWaypointTime - prevWaypoint.time, 1e-6); // Try releasing the button a tad later. This way, slider ticks can be registered.
						replay.addEvent({
							type: ReplayEventType.Button,
							time: buttonReleaseTime,
							button: button,
							state: false
						});
						releaseButton(button, buttonReleaseTime);

						break;
					}
				}

				// If a spinner is currently in progress, start spinning again.
				if (currentSpinnerCount > 0) insertSpinner(true);
			} else if (waypoint.type === WaypointType.SpinnerStart) {
				currentSpinnerCount++;
				insertSpinner();
			} else if (waypoint.type === WaypointType.SpinnerEnd) {
				currentSpinnerCount--;
				if (currentSpinnerCount > 0) insertSpinner(true);
			}

			function insertSpinner(continuation = false) {
				let button = getNextButton(waypoint.time);
				let endTime = waypoints[i+1].time; // We're guaranteed there's another waypoint because every SpinnerStart is followed by a SpinnerEnd

				replay.addEvent({
					type: ReplayEventType.Button,
					time: waypoint.time - (continuation? 0 : 1e-6), // Start holding down just before the spinner begins so that we're guaranteed to be pressing the button as soon as the spinner handles the first mouse input.
					button: button,
					state: true
				});
				replay.addEvent({
					type: ReplayEventType.Spin,
					time: waypoint.time,
					endTime: endTime
				});
				replay.addEvent({
					type: ReplayEventType.Button,
					time: endTime,
					button: button,
					state: false
				});
				releaseButton(button, endTime);
			}
		}

		replay.finalize();
		console.timeEnd("Auto replay generation");

		return replay;
	}
}