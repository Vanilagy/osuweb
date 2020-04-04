import { EaseType, MathUtil } from "./math_util";

type InterpolatedValueChangerDurationCallback = (distanceToGoal: number) => number;

interface InterpolatedValueChangerOptions {
	initial: number,
	duration: number | InterpolatedValueChangerDurationCallback, // In ms
	ease: EaseType,
	p?: number
}

// For animating numbers going from x to y
export class InterpolatedValueChanger {
	private options: InterpolatedValueChangerOptions;
	private start: number;
	private end: number;
	public ease: EaseType;
	private p: number;
	private duration: number;
	private startTime: number = -Infinity;

	constructor(options: InterpolatedValueChangerOptions) {
		this.options = options;
		this.start = options.initial;
		this.end = this.start;
		this.duration = this.getDuration();
		this.ease = options.ease;
		this.p = options.p;
	}

	getDuration() {
		let val: number;

		if (typeof this.options.duration === 'number') val = this.options.duration;
		else val = this.options.duration(this.end - this.start);

		return Math.max(val, Number.MIN_VALUE);
	}

	getCurrentValue(now: number) {
		let timePassed = (now === this.startTime)? 0 : now - this.startTime; // This check might seem unnecessary, since x - x = 0, however that does not hold true for x = +-Infinity. Since some maps are... questionable, we need to add this check.
		
		let completion = MathUtil.clamp(timePassed / this.duration, 0, 1);
		completion = MathUtil.ease(this.ease, completion, this.p);

		return MathUtil.lerp(this.start, this.end, completion);
	}

	setGoal(goal: number, now: number) {
		let current = this.getCurrentValue(now);
		if (isNaN(current)) current = goal;
		
		this.start = current;
		this.end = goal;
		this.startTime = now;
		this.duration = this.getDuration();
	}

	getCurrentGoal() {
		return this.end;
	}

	reset(to: number) {
		this.start = to;
		this.end = to;
		this.startTime = -Infinity;
	}

	finish() {
		this.startTime = -Infinity;
	}
}

export enum ReverseMode {
	ByCompletion,
	ByValue
}

interface InterpolatorOptions {
	duration?: number,
	from?: number,
	to?: number,
	ease?: EaseType,
	p?: number, // Additional parameter for easing
	reverseDuration?: number,
	reverseEase?: EaseType,
	reverseP?: number,
	reverseMode?: ReverseMode
	defaultToFinished?: boolean,
	beginReversed?: boolean
}

export class Interpolator {
	private duration: number = 1000;
	private from: number = 0.0;
	private to: number = 1.0;
	private ease: EaseType = EaseType.Linear;
	private p: number;
	private reverseDuration: number;
	private reverseEase: EaseType;
	private reverseP: number;
	private reverseMode: ReverseMode = ReverseMode.ByValue;
	private defaultToFinished: boolean = false;

	private startTime: number;
	private reversed = false;

	constructor(options?: InterpolatorOptions) {
		if (options) Object.assign(this, options);

		if (options && options.beginReversed) this.reversed = true;
		this.reset();
	}
	
	private getDuration() {
		// Min value to catch cases where the duration is 0 and would cause potential NaNs. Number.MIN_VALUE is practically 0, right?
		return Math.max(Number.MIN_VALUE, (this.reversed && this.reverseDuration !== undefined)? this.reverseDuration : this.duration);
	}

	private getEase() {
		return (this.reversed && this.reverseEase !== undefined)? this.reverseEase : this.ease;
	}

	private getEaseP() {
		return (this.reversed && this.reverseP !== undefined)? this.reverseP : this.p;
	}

	start(now: number) {
		this.startTime = now;
	}

	/** Instantly finish the animation. */
	end() {
		this.startTime = -Infinity;
	}
	
	reset() {
		this.startTime = this.defaultToFinished? -Infinity : Infinity;
	}

	reverse(now: number) {
		let currentCompletion = this.getCurrentCompletion(now);
		let currentEasedCompletion = this.getCurrentEasedCompletion(now);

		this.reversed = !this.reversed;

		if (this.reverseMode === ReverseMode.ByValue && this.reverseEase && this.reverseEase !== this.ease) {
			currentCompletion = Interpolator.findEaseIntersection(this.getEase(), this.getEaseP(), currentCompletion, currentEasedCompletion);
		}

		if (!this.reversed) currentCompletion = 1 - currentCompletion;

		this.startTime = now - (1 - currentCompletion) * this.getDuration();
	}

	setReversedState(state: boolean, now: number) {
		if (state !== this.reversed) this.reverse(now);
	}

	getCurrentCompletion(now: number) {
		let completion = (now - this.startTime) / this.getDuration();
		completion = MathUtil.clamp(completion, 0, 1);

		if (this.reversed) return 1 - completion;
		return completion;
	}

	getCurrentEasedCompletion(now: number) {
		let completion = this.getCurrentCompletion(now);
		if (completion % 1 === 0) return completion;

		let easedCompletion = MathUtil.ease(this.getEase(), completion, this.getEaseP());
		return easedCompletion;
	}

	getCurrentValue(now: number) {
		return MathUtil.lerp(this.from, this.to, this.getCurrentEasedCompletion(now));
	}

	isReversed() {
		return this.reversed;
	}

	isPlaying() {
		return isFinite(this.startTime);
	}

	setValueRange(from: number, to: number) {
		this.from = from;
		this.to = to;
	}

	setDuration(newDuration: number, now: number) {
		let completionNow = this.getCurrentCompletion(now);
		if (this.reversed) completionNow = 1 - completionNow;
		
		this.duration = newDuration;
		if (this.isPlaying() && (!this.reversed || this.reverseDuration === undefined)) this.startTime = now - newDuration * completionNow;
	}

	setReverseDuration(newReverseDuration: number, now: number) {
		let completionNow = this.getCurrentCompletion(now);
		if (this.reversed) completionNow = 1 - completionNow;
		
		this.reverseDuration = newReverseDuration;
		if (this.isPlaying() && this.reversed) this.startTime = now - newReverseDuration * completionNow;
	}

	setEase(newEase: EaseType, now: number, newP?: number) {
		let currentCompletion = this.getCurrentCompletion(now);
		let currentEasedCompletion = this.getCurrentEasedCompletion(now);

		this.ease = newEase;
		this.p = newP;

		if (!this.isPlaying() || (this.reversed && this.reverseEase !== undefined)) return;

		// Find the corresponding completion input for the new ease function so that we avoid a jump in output value
		let newCompletion = Interpolator.findEaseIntersection(newEase, newP, currentCompletion, currentEasedCompletion);
		if (this.reversed) newCompletion = 1 - newCompletion;

		this.startTime = now - newCompletion * this.getDuration();
	}

	setReverseEase(newReverseEase: EaseType, now: number, newReverseP?: number) {
		let currentCompletion = this.getCurrentCompletion(now);
		let currentEasedCompletion = this.getCurrentEasedCompletion(now);

		this.reverseEase = newReverseEase;
		this.reverseP = newReverseP;

		if (!this.isPlaying() || !this.reversed) return;

		let newCompletion = Interpolator.findEaseIntersection(newReverseEase, newReverseP, currentCompletion, currentEasedCompletion);
		this.startTime = now - (1 - newCompletion) * this.getDuration();
	}

	/** Finds the completion input at which a certain ease function's output matches some other completion. */
	private static findEaseIntersection(ease: EaseType, p: number, currentCompletion: number, currentEasedCompletion: number) {
		let clampedEasedCompletion = MathUtil.clamp(currentEasedCompletion, 0, 1); // For some ease types, values can reach out of [0, 1], which would mean that no root can be found - that's why we clamp here.

		let root = MathUtil.findRootInInterval((x) => {
			return MathUtil.ease(ease, x, p) - clampedEasedCompletion;
		}, 0.0, 1.0);

		if (!isNaN(root)) return root;
		return currentCompletion;
	}
}