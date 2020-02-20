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
		if (typeof this.options.duration === 'number') return this.options.duration;
		else return this.options.duration(this.end - this.start);
	}

	getCurrentValue(now: number) {
		let timePassed = (now === this.startTime)? 0 : now - this.startTime; // This check might seem unnecessary, since x - x = 0, however that does not hold true for x = +-Infinity. Since some maps are... questionable, we need to add this check.
		
		let completion = MathUtil.clamp(timePassed / this.duration, 0, 1);
		completion = MathUtil.ease(this.ease, completion, this.p);

		return MathUtil.lerp(this.start, this.end, completion);
	}

	setGoal(goal: number, now: number) {
		let current = this.getCurrentValue(now);
		
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
	duration: number,
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
	private duration: number;
	private from: number = 0.0;
	private to: number = 1.0;
	private ease: EaseType = EaseType.Linear;
	private p: number;
	private reverseDuration: number;
	private reverseEase: EaseType = EaseType.Linear;
	private reverseP: number;
	private reverseMode: ReverseMode = ReverseMode.ByValue;
	private defaultToFinished: boolean = false;

	private startTime: number;
	private reversed = false;

	constructor(options: InterpolatorOptions) {
		Object.assign(this, options);

		if (options.beginReversed) this.reversed = true;
		this.reset();
	}
	
	private getDuration() {
		return (this.reversed && this.reverseDuration !== undefined)? this.reverseDuration : this.duration;
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
		let currentValue = this.getCurrentValue(now);

		this.reversed = !this.reversed;

		if (this.reverseMode === ReverseMode.ByValue && this.reverseEase && this.reverseEase !== this.ease) {
			let ease = this.getEase();
			let easeP = this.getEaseP();

			let root = MathUtil.findRootInInterval((x) => {
				return MathUtil.ease(ease, x, easeP) - currentValue;
			}, 0.0, 1.0);

			if (!isNaN(root)) currentCompletion = root;
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

	getCurrentValue(now: number) {
		let completion = this.getCurrentCompletion(now);
		completion = MathUtil.ease(this.getEase(), completion, this.getEaseP());

		return MathUtil.lerp(this.from, this.to, completion);
	}

	isReversed() {
		return this.reversed;
	}

	setValueRange(from: number, to: number) {
		this.from = from;
		this.to = to;
	}
}