import { ProcessedHeadedHitObject } from "./processed_headed_hit_object";
import { ComboInfo, CurrentTimingPointInfo, ProcessedBeatmap } from "./processed_beatmap";
import { Slider, SliderType } from "../hit_objects/slider";
import { Point, stackShiftPoint } from "../../util/point";
import { SliderPath } from "../hit_objects/slider_path";
import { MathUtil } from "../../util/math_util";
import { toFloat32 } from "../../util/misc_util";
import { PlayEvent, PlayEventType } from "../play_events";

export enum SpecialSliderBehavior {
	None,
	Invisible
}

export class ProcessedSlider extends ProcessedHeadedHitObject {
	public hitObject: Slider;
	/** The "visual other end" of the slider. Not necessarily where the slider ends (because of repeats); for that, refer to endPoint instead. */
	public tailPoint: Point;
	public duration: number;
	public repeat: number; // Contains the adjusted value of repeats in case the file was doing something funky.
	public length: number; // Same info as for repeat.
	public velocity: number; // In osu!pixels per millisecond
	public specialBehavior: SpecialSliderBehavior = SpecialSliderBehavior.None;
	public tickCompletions: number[];
	public path: SliderPath;
	public lazyEndPosition: Point = null;
	public lazyTravelDistance: number = 0;
	
	constructor(slider: Slider, comboInfo: ComboInfo, timingInfo: CurrentTimingPointInfo, processedBeatmap: ProcessedBeatmap) {
		super(slider, comboInfo, timingInfo, processedBeatmap);

		let { path, length: pathLength } = SliderPath.fromSlider(slider);
		this.path = path;

		let combinedMsPerBeat = timingInfo.msPerBeat * timingInfo.msPerBeatMultiplier;
		if (combinedMsPerBeat <= 0 && !MathUtil.isPositiveZero(combinedMsPerBeat)) combinedMsPerBeat = 1000; // This is the case for Aspire-like hacky maps. It's strange and kinda arbitrary, but observed.

		if (slider.sections.length === 0 && slider.type !== SliderType.Bézier) {
			this.specialBehavior = SpecialSliderBehavior.Invisible;
		}
		if (slider.sections.length > 0 && slider.length < 0) {
			this.specialBehavior = SpecialSliderBehavior.Invisible;
		}
		// It can happen that the ms-per-beat is so insanely big (like, 1e298), that the slider would practically be infinitely long. Osu seems to hide those sliders.
		if (!isFinite(toFloat32(combinedMsPerBeat))) {
			this.specialBehavior = SpecialSliderBehavior.Invisible;
		}

		let repeat = slider.repeat;
		if (repeat < 1) repeat = 1; // In case the map file is feeling funny.
		this.repeat = repeat;

		let length = slider.length;
		if (this.specialBehavior === SpecialSliderBehavior.Invisible) length = 0;
		if (length < 0) length = 0;
		if (slider.sections.length === 0) length = 0;
		if (slider.sections.length > 0 && slider.length === 0) length = pathLength; // When the length is 0 in the file, it doesn't mean "zero" length (how could you guess something so outrageous?), but instead means that the path generator will calculate the length based on the control points. More on that in SliderPath.
		// TODO: More here?
		this.length = length;

		let sliderVelocityInOsuPixelsPerBeat = 100 * processedBeatmap.difficulty.SV; // 1 SV is 100 osu!pixels per beat.
		let sliderVelocityInOsuPixelsPerMillisecond = sliderVelocityInOsuPixelsPerBeat / combinedMsPerBeat;
		this.velocity = sliderVelocityInOsuPixelsPerMillisecond;

		this.endTime = this.startTime + this.getRelativeTimeFromCompletion(this.repeat);
		this.endTime = toFloat32(this.endTime);
		this.duration = this.endTime - this.startTime;
		this.tailPoint = this.path.getPosFromPercentage(1.0);

		if (this.duration === Infinity) debugger;
	
 		if (this.repeat % 2 === 0) {
			this.endPoint = this.startPoint;
		} else {
			this.endPoint = this.tailPoint;
		}

		this.initTicks(timingInfo);
	}

	/** Returns the completion of the slider at a point in absolute time (relative to the whole beatmap). */
	getCompletionAtTime(time: number) {
		// || 0 to catch NaN for zero-length slider
		return MathUtil.clamp(((this.velocity * (time - this.startTime)) / this.length) || 0, 0, this.repeat);
	}

	/** Returns the relative time (time relative to the slider start) where the slider will reach a given completion. */
	getRelativeTimeFromCompletion(completion: number) {
		return completion * this.length / this.velocity;
	}
	
	private initTicks(timingInfo: CurrentTimingPointInfo) {
		let tickCompletions: number[] = this.tickCompletions = [];

		if (this.specialBehavior === SpecialSliderBehavior.Invisible) return;

		let timeBetweenTicks = timingInfo.msPerBeat;
		if (timeBetweenTicks <= 0) timeBetweenTicks = 1000 / timingInfo.msPerBeatMultiplier; // This is seriously weird, but observed. Weird because it's so arbitrary, and 'cause ticks usually don't get affected by the multiplier, at least not for normal values.

		// Not sure if this is how osu does it, but this is to prevent getting stuck while generating slider ticks.
		if (timeBetweenTicks < 1) return;

		let tickCompletionIncrement = (this.velocity * (timeBetweenTicks / this.processedBeatmap.difficulty.TR)) / this.length;
		
		// Only go to completion 1, because the slider tick locations are determined solely by the first repeat cycle. In all cycles after that, they stay in the exact same place. Example: If my slider is:
		// O----T----T-O
		// where O represents the ends, and T is a slider tick, then repeating that slider does NOT change the position of the Ts. It follows that slider ticks don't always "tick" in constant time intervals.
		for (let tickCompletion = tickCompletionIncrement; tickCompletion > 0 && tickCompletion < 1; tickCompletion += tickCompletionIncrement) {
			let timeToStart = this.getRelativeTimeFromCompletion(tickCompletion);
			let timeToEnd = this.getRelativeTimeFromCompletion(1- tickCompletion);

			if (timeToStart < 6 || timeToEnd < 6) continue; // Ignore slider ticks temporally close to either slider end

			tickCompletions.push(tickCompletion);
		}
		
		// Weird implementation. Can probably be done much easier-ly. This handles the "going back and forth but keep the ticks in the same location" thing. TODO.
		let len = tickCompletions.length;
		if (len > 0) {
			for (let i = 1; i < this.repeat; i++) {
				if (i % 2 === 0) {
					for (let j = 0; j < len; j++) {
						tickCompletions.push(i + tickCompletions[j]);
					}
				} else {
					for (let j = len-1; j >= 0; j--) {
						tickCompletions.push(i + 1 - tickCompletions[j]);
					}
				}
			}
		}
	}
	
	applyStackPosition() {
		stackShiftPoint(this.startPoint, this.stackHeight);
		stackShiftPoint(this.tailPoint, this.stackHeight);
		// Since endPoint is either startPoint or tailPoint, we'll have shifted endPoint.

		this.path.applyStackPosition(this.stackHeight);
	}
	
	addPlayEvents(playEventArray: PlayEvent[]) {
		super.addPlayEvents(playEventArray);

		// Sliders that are shorter than 1ms in duration won't run checks for the slider end, repeats or ticks. The float conversion is done to account for osu-internal code.
		// This isn't totally how osu works, osu is more buggy. But it's like... buggy in a really unpredictable way. It's such a small and rare edge case, that I cannot be bothered to figure out its exact behavior. Sorry.
		let tooShort = toFloat32(this.duration) < 1;

		if (this.specialBehavior !== SpecialSliderBehavior.Invisible && !tooShort) {
			let sliderEndCheckTime = this.startTime + Math.max(this.duration - 36, this.duration/2); // "Slider ends are a special case and checked exactly 36ms before the end of the slider (unless the slider is <72ms in duration, then it checks exactly halfway time wise)." https://www.reddit.com/r/osugame/comments/9rki8o/how_are_slider_judgements_calculated/
			let sliderEndCheckCompletion = this.getCompletionAtTime(sliderEndCheckTime);
			sliderEndCheckCompletion = MathUtil.mirror(sliderEndCheckCompletion);
			let sliderEndCheckPosition = this.path.getPosFromPercentage(sliderEndCheckCompletion);
	
			playEventArray.push({
				type: PlayEventType.SliderEndCheck,
				hitObject: this,
				time: sliderEndCheckTime,
				position: sliderEndCheckPosition
			});
		}

		playEventArray.push({
			type: PlayEventType.SliderEnd,
			hitObject: this,
			time: this.endTime,
			position: this.endPoint
		});

		if (tooShort) return;
		if (this.specialBehavior === SpecialSliderBehavior.Invisible) return;

		// Sustained slider slide event
		playEventArray.push({
			type: PlayEventType.SliderSlide,
			hitObject: this,
			time: this.startTime,
			endTime: this.endTime
		});

		// Add repeats
		if (this.repeat > 1) {
			let repeatCycleDuration = this.duration / this.repeat;

			for (let i = 1; i < this.repeat; i++) {
				let position = (i % 2 === 0)? this.startPoint : this.tailPoint;

				playEventArray.push({
					type: PlayEventType.SliderRepeat,
					hitObject: this,
					time: this.startTime + i * repeatCycleDuration,
					position: position,
					index: i-1
				});
			}
		}

		// Add ticks
		for (let i = 0; i < this.tickCompletions.length; i++) {
			let tickCompletion = this.tickCompletions[i];

			// Time that the tick should be hit, relative to the slider start time
			let time = this.getRelativeTimeFromCompletion(tickCompletion);
			let position = this.path.getPosFromPercentage(MathUtil.mirror(tickCompletion));

			playEventArray.push({
				type: PlayEventType.SliderTick,
				hitObject: this,
				time: this.startTime + time,
				position: position,
				index: i
			});
		}
	}
}