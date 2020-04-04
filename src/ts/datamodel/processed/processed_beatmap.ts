import { Beatmap, BeatmapEventBreak, TimingPoint, BeatmapEventType } from "../beatmap";
import { Circle } from "../circle";
import { Slider } from "../slider";
import { MathUtil } from "../../util/math_util";
import { PlayEvent } from "../play_events";
import { last, assert, shallowObjectClone, binarySearchLessOrEqual } from "../../util/misc_util";
import { Spinner } from "../spinner";
import { ProcessedHitObject } from "./processed_hit_object";
import { ProcessedCircle } from "./processed_circle";
import { ProcessedSlider } from "./processed_slider";
import { ProcessedSpinner } from "./processed_spinner";
import { ProcessedHeadedHitObject } from "./processed_headed_hit_object";
import { BeatmapDifficulty } from "../beatmap_difficulty";
import { pointDistance } from "../../util/point";

const MINIMUM_REQUIRED_PRELUDE_TIME = 2000; // In milliseconds
const IMPLICIT_BREAK_THRESHOLD = 5000; // In milliseconds. When two hitobjects are more than {this value} millisecond apart and there's no break inbetween them already, put a break there automatically.
const REQUIRED_MINIMUM_BREAK_LENGTH = 750; // In milliseconds

export interface ComboInfo {
	comboNum: number,
	n: number,
	isLast: boolean
}

export interface Break {
	startTime: number,
	endTime: number
}

export interface CurrentTimingPointInfo {
	timingPoint: TimingPoint,
	index: number,
	msPerBeat: number,
	msPerBeatMultiplier: number
}

export class ProcessedBeatmap {
	public beatmap: Beatmap;
	public hitObjects: ProcessedHitObject[];
	public breaks: Break[];
	public difficulty: BeatmapDifficulty;
	private allowColorSkipping: boolean;
	private initialized = false;

	/**
	 * @param allowColorSkipping Whether or not combo colors can be skipped.
	 */
	constructor(beatmap: Beatmap, allowColorSkipping: boolean) {
		this.beatmap = beatmap;
		this.hitObjects = [];
		this.breaks = [];
		this.difficulty = this.beatmap.difficulty.clone();
		this.allowColorSkipping = allowColorSkipping;
	}

	init(generateBreaks = true) {
		assert(!this.initialized);
		this.initialized = true;

		this.generateHitObjects();
		if (generateBreaks) this.generateBreaks();
	}

	private generateHitObjects() {
		let currentObjectIndex = 0;
		let comboCount = 1;
		let currentCombo = 0;
		let firstTimingPoint = this.beatmap.timingPoints[0];

		let currentTimingPointInfo: CurrentTimingPointInfo = {
			timingPoint: firstTimingPoint,
			index: 0,
			msPerBeat: firstTimingPoint.msPerBeat,
			msPerBeatMultiplier: 1.0
		};

		for (let i = 0; i < this.beatmap.hitObjects.length; i++) {
			let rawHitObject = this.beatmap.hitObjects[i];

			let comboInfo: ComboInfo = null;
			if (rawHitObject.comboSkips !== 0) {
				if (!this.allowColorSkipping) currentCombo++; // No color skipping with this option enabled!
				else currentCombo += rawHitObject.comboSkips;

				comboCount = 1;
			}
			comboInfo = {
				comboNum: currentCombo,
				n: comboCount++,
				isLast: (this.beatmap.hitObjects[i + 1])? this.beatmap.hitObjects[i + 1].comboSkips !== 0 : true
			};

			// Apply all the timing points until the current hit object
			while (currentTimingPointInfo.index < this.beatmap.timingPoints.length) {
				let nextTimingPoint = this.beatmap.timingPoints[currentTimingPointInfo.index + 1];
				if (!nextTimingPoint) break;
				if (nextTimingPoint.offset > rawHitObject.time) break;

				if (nextTimingPoint.inheritable) {
					currentTimingPointInfo.msPerBeatMultiplier = 1.0;
					currentTimingPointInfo.msPerBeat = nextTimingPoint.msPerBeat;
				}

				// LMFAO! PPY'S CODE IS SUCH A MESS! Turns out that if a inheritable timing point has negative msPerBeat (it's positive for normal maps), it is counted as BOTH an inherited AND non-inherited timing point. BOTH! What the heck! That's why the following condition is based solely on msPerBeat and not on the inheritability of the timing point specified in the .osu file. Whew.
				if (nextTimingPoint.msPerBeat < 0) {
					// timingPoint.msPerBeat is negative. An exaplanation pulled from the osu website:
					// The milliseconds per beat field (Decimal) defines the duration of one beat. It affect the scrolling speed in osu!taiko or osu!mania, and the slider speed in osu!standard, among other things. When positive, it is faithful to its name. When negative, it is a percentage of previous non-negative milliseconds per beat. For instance, 3 consecutive timing points with 500, -50, -100 will have a resulting beat duration of half a second, a quarter of a second, and half a second, respectively.
					
					let factor = nextTimingPoint.msPerBeat * -1 / 100;
					factor = MathUtil.clamp(factor, 0.1, 10);
					
					currentTimingPointInfo.msPerBeatMultiplier = factor;   
				}

				currentTimingPointInfo.timingPoint = nextTimingPoint;
				currentTimingPointInfo.index++;
			}

			let newProcessedObject = null;
			let duplicatedTimingPointInfo = shallowObjectClone(currentTimingPointInfo);

			if (rawHitObject instanceof Circle) {
				newProcessedObject = new ProcessedCircle(rawHitObject, comboInfo, duplicatedTimingPointInfo, this);
			} else if (rawHitObject instanceof Slider) {
				newProcessedObject = new ProcessedSlider(rawHitObject, comboInfo, duplicatedTimingPointInfo, this);
			} else if (rawHitObject instanceof Spinner) {
				newProcessedObject = new ProcessedSpinner(rawHitObject, comboInfo, duplicatedTimingPointInfo, this);
			}

			if (newProcessedObject !== null) {
				newProcessedObject.index = currentObjectIndex;
				this.hitObjects.push(newProcessedObject);

				currentObjectIndex++;
			}
		}
	}

	applyStackShift() {
		let stackThreshold = this.difficulty.getApproachTime() * this.difficulty.SL;
		let stackSnapDistance = 3;

		let extendedEndIndex = this.hitObjects.length - 1;
		for (let i = this.hitObjects.length - 1; i >= 0; i--) {
			let hitObject = this.hitObjects[i];

			let stackBaseIndex = i;
			for (let b = i + 1; b < this.hitObjects.length; b++) {
				let objectB = this.hitObjects[b];
				let stackBaseObject = hitObject;

				if (!(stackBaseObject instanceof ProcessedHeadedHitObject)) break;
				if (!(objectB instanceof ProcessedHeadedHitObject)) continue;

				let endTime = stackBaseObject.endTime;

				if (objectB.startTime - endTime > stackThreshold) break;

				if (pointDistance(stackBaseObject.startPoint, objectB.startPoint) < stackSnapDistance ||
					(stackBaseObject instanceof ProcessedSlider) && pointDistance(stackBaseObject.endPoint, objectB.startPoint) < stackSnapDistance) {
					stackBaseIndex = b;

					objectB.stackHeight = 0;
				}
			}

			if (stackBaseIndex > extendedEndIndex) {
				extendedEndIndex = stackBaseIndex;
				if (extendedEndIndex === this.hitObjects.length - 1)
					break;
			}
		}

		let extendedStartIndex = 0;
		for (let i = extendedEndIndex; i > 0; i--) {
			let n = i;

			let hitObject = this.hitObjects[i];
			if (!(hitObject instanceof ProcessedHeadedHitObject)) continue;

			let objectI = hitObject;
			
			if (objectI.stackHeight !== 0) continue;

			if (objectI instanceof ProcessedCircle) {
				while (--n >= 0) {
					let objectN = this.hitObjects[n];
					if (!(objectN instanceof ProcessedHeadedHitObject)) continue;

					let endTime = objectN.endTime;

					if (objectI.startTime - endTime > stackThreshold)
						break;

					if (n < extendedStartIndex) {
						objectN.stackHeight = 0;
						extendedStartIndex = n;
					}

					if (objectN instanceof ProcessedSlider && pointDistance(objectN.endPoint, objectI.startPoint) < stackSnapDistance) {
						let offset = objectI.stackHeight - objectN.stackHeight + 1;

						for (let j = n + 1; j <= i; j++) {
							let objectJ = this.hitObjects[j];
							if (!(objectJ instanceof ProcessedHeadedHitObject)) continue;

							if (pointDistance(objectN.endPoint, objectJ.startPoint) < stackSnapDistance)
								objectJ.stackHeight -= offset;
						}
						break;
					}

					if (pointDistance(objectN.startPoint, objectI.startPoint) < stackSnapDistance) {
						objectN.stackHeight = objectI.stackHeight + 1;
						objectI = objectN;
					}
				}
			}
			else if (objectI instanceof ProcessedSlider) {
				while (--n >= 0) {
					let objectN = this.hitObjects[n];

					if (!(objectN instanceof ProcessedHeadedHitObject)) continue;

					if (objectI.startTime - objectN.startTime > stackThreshold)
						break;

					if (pointDistance(objectN.endPoint, objectI.startPoint) < stackSnapDistance) {
						objectN.stackHeight = objectI.stackHeight + 1;
						objectI = objectN;
					}
				}
			}
		}

		for (let z = 0; z < this.hitObjects.length; z++) {
			let hitObject = this.hitObjects[z];
			if (!(hitObject instanceof ProcessedHeadedHitObject)) continue;

			if (hitObject.stackHeight !== 0) hitObject.applyStackPosition();
		}
	}

	/** Returns the earliest time where all hit obejcts have been completed. */
	getEndTime() {
		let max = -Infinity;

		for (let i = 0; i < this.hitObjects.length; i++) {
			max = Math.max(max, this.hitObjects[i].endTime);
		}

		return max;
	}

	// The time to delay the song at the start to allow for player preparation, in milliseconds
	getPreludeTime() {
		let preludeTime = 0;
		let firstHitObject = this.hitObjects[0];
		if (!firstHitObject) return 0;

		if (firstHitObject.startTime < MINIMUM_REQUIRED_PRELUDE_TIME) {
			preludeTime = MINIMUM_REQUIRED_PRELUDE_TIME - firstHitObject.startTime;
		}

		return preludeTime;
	}
	
	getAllPlayEvents(): PlayEvent[] {
		let events: PlayEvent[] = [];

		for (let i = 0; i < this.hitObjects.length; i++) {
			this.hitObjects[i].addPlayEvents(events);
		}

		events.sort((a, b) => a.time - b.time); // Sort by time, ascending

		return events;
	}

	private generateBreaks() {
		for (let i = 0; i < this.beatmap.events.length; i++) {
			let event = this.beatmap.events[i];
			if (event.type !== BeatmapEventType.Break) continue;

			let breakEvent = event as BeatmapEventBreak;
			if (breakEvent.endTime - breakEvent.time < REQUIRED_MINIMUM_BREAK_LENGTH) continue;

			this.breaks.push({
				startTime: breakEvent.time,
				endTime: breakEvent.endTime
			});
		}

		if (this.hitObjects.length > 0) {
			let firstObject = this.hitObjects[0];

			// Add break before the first hit object
			this.breaks.push({
				startTime: -Infinity,
				endTime: firstObject.startTime
			});

			// Add break after the last hit object ends
			this.breaks.push({
				startTime: this.getEndTime(),
				endTime: Infinity
			});

			console.time("Implicit break generation");

			// Generate implicit breaks
			// We basically need to find timeframes of a certain minimum length in which there are no hitobjetcs - turns out that's actually not trivial. It would be, if we lived in a perfect world where only one hit object plays at a time, but 2B and Aspire maps need to work correctly too. The naive algorithm would be: For each pair of hit objects, check if there is enough space between their ends. If there is, iterate through all other hit objects and see if they happen to lie in tn that timespace. This would be O(n^3), though.

			// Doing a presort to speed up lookup later
			let hitObjectsEndTimeSorted = this.hitObjects.slice(0);
			hitObjectsEndTimeSorted.sort((a, b) => a.endTime - b.endTime);

			for (let i = 0; i < this.hitObjects.length-1; i++) {
				let ho1 = this.hitObjects[i]; // hohoho! KURISUMASU!

				// Now, since most maps aren't 2B and crazy stuff like that, we perform a simple check to see if there's enough room between this and the *next* hit object (by index). If there isn't, there's no way we'll fit a break in here, so we can terminate early.
				let quickCheckHitObject = this.hitObjects[i+1];
				if (quickCheckHitObject.startTime - ho1.endTime < IMPLICIT_BREAK_THRESHOLD) continue;

				// Find the hit object closest to the ho1's end time
				let otherIndex = binarySearchLessOrEqual(this.hitObjects, ho1.endTime, x => x.startTime);

				outer: for (let j = otherIndex; j < this.hitObjects.length; j++) {
					if (j === i) continue;
					let ho2 = this.hitObjects[j];

					let temporalDistance = ho2.startTime - ho1.endTime;
					if (temporalDistance < 0) continue;
					// There isn't enough space, so break out the loop. We won't be able to fit in a break.
					if (temporalDistance < IMPLICIT_BREAK_THRESHOLD) break;

					// At this point, there are no new hit objects starting in the timeframe right after ho1's end time. However, we still need to check if there are hit objects that *end* in that timeframe. For this, we perform another search.

					for (let k = 0; k < this.hitObjects.length; k++) {
						let ho3 = this.hitObjects[k];

						if (ho3.startTime >= ho1.endTime) break;
						if (ho3.endTime > ho1.endTime) break outer;
					}

					// At this point, we have found a large enough timeframe with no hit objects inside. Last thing to do is to check if there's already a break in this region.

					for (let k = 0; k < this.breaks.length; k++) {
						let breakEvent = this.breaks[k];

						if (breakEvent.startTime >= ho1.endTime && breakEvent.startTime < ho2.startTime) {
							break outer;
						}
					}

					// No break there yet! Let's add one!
					this.breaks.push({
						startTime: ho1.endTime,
						endTime: ho2.startTime
					});

					break;
				}
			}

			console.timeEnd("Implicit break generation");
		} else {
			// Just a "break" that spans the whole song
			this.breaks.push({
				startTime: -Infinity,
				endTime: Infinity
			});
		}

		this.breaks.sort((a, b) => a.startTime - b.startTime); // ascending
	}

	/** Returns the total length of the playable portion of the map. */
	getPlayableLength() {
		if (this.hitObjects.length === 0) return 0;
		else return this.getEndTime() - this.hitObjects[0].startTime;
	}

	getTotalBreakTime() {
		let total = 0;

		for (let i = 0; i < this.breaks.length; i++) {
			let breakEvent = this.breaks[i];
			total += getBreakLength(breakEvent);
		}

		return total;
	}

	isInBreak(time: number) {
		// Do a naive linear search for now. Given that songs almost always have less than 10 breaks, this shouldn't be a performance issue. But look into this!
		for (let i = 0; i < this.breaks.length; i++) {
			let osuBreak = this.breaks[i];
			if (time >= osuBreak.startTime && time < osuBreak.endTime) return true;
		}
		return false;
	}

	/** Returns the BPM that is present for the longest duration in the map. */
	getMostFrequentBpm() {
		let bpmDurations: [number /* bpm */, number /* duration */][] = [];

		let i = 0;
		while (true) {
			let timingPoint = this.beatmap.timingPoints[i];
			if (!timingPoint.inheritable) continue;

			let nextInheritableIndex: number;
			let duration: number;

			// Find the index of the next timing point that is inheritable
			for (let j = i+1; j < this.beatmap.timingPoints.length; j++) {
				if (this.beatmap.timingPoints[j].inheritable) nextInheritableIndex = j;
			}

			if (nextInheritableIndex) {
				// If there's such a timing point, the duration is simply the difference of their offsets
				duration = this.beatmap.timingPoints[nextInheritableIndex].offset - timingPoint.offset;
			} else {
				// If there isn't, then the current timing point is the last inheritable one. The duration then is the duration 'til the end of the map.
				duration = this.getEndTime() - timingPoint.offset;
			}

			if (duration < 0) break;

			// See if we already have an entry for this bpm
			let entryIndex = bpmDurations.findIndex(x => x[0] === timingPoint.bpm);
			if (entryIndex === -1) {
				// If not, create one!
				bpmDurations.push([timingPoint.bpm, duration]);
			} else {
				// If yes, then add to the already saved duration
				bpmDurations[entryIndex][1] += duration;
			}

			if (nextInheritableIndex) i = nextInheritableIndex;
			else break;
		}

		if (bpmDurations.length === 0) return 120;

		bpmDurations.sort((a, b) => b[1] - a[1]);
		return bpmDurations[0][0];
	}
}

export function getBreakMidpoint(osuBreak: Break) {
	return (osuBreak.startTime + osuBreak.endTime) / 2;
}

export function getBreakLength(osuBreak: Break) {
	return osuBreak.endTime - osuBreak.startTime;
}