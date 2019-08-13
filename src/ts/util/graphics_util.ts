import { MathUtil, EaseType } from "./math_util";

export interface Color {
    r: number, // 0-255
    g: number, // 0-255
    b: number, // 0-255
    a?: number // 0.0-1.0
}

export function colorToHexNumber(color: Color) {
    return color.r * 0x10000 + color.g * 0x100 + color.b * 0x1;
}

export function colorToHexStirng(color: Color) {
    return '#' + ('000000' + colorToHexNumber(color).toString(16)).slice(-6);
}

type InterpolatedCounterDurationCallback = (distanceToGoal: number) => number;

interface InterpolatedCounterOptions {
    initial: number,
    duration: number | InterpolatedCounterDurationCallback, // In ms
    ease: EaseType
}

// For animating numbers going from x to y
export class InterpolatedCounter {
    private options: InterpolatedCounterOptions;
    private start: number;
    private end: number;
    public ease: EaseType;
    private duration: number;
    private startTime: number = -Infinity;

    constructor(options: InterpolatedCounterOptions) {
        this.options = options;
        this.start = options.initial;
        this.end = this.start;
        this.duration = this.getDuration();
        this.ease = options.ease;
    }

    getDuration() {
        if (typeof this.options.duration === 'number') return this.options.duration;
        else return this.options.duration(this.end - this.start);
    }

    getCurrentValue(customTime?: number) {
        let now;
        if (customTime !== undefined) now = customTime;
        else now = performance.now();
        
        let completion = MathUtil.clamp((now - this.startTime) / this.duration, 0, 1);
        completion = MathUtil.ease(this.ease, completion);

        return this.start * (1 - completion) + this.end * completion;
    }

    setGoal(goal: number, customTime?: number) {
        let now;
        if (customTime !== undefined) now = customTime;
        else now = performance.now();

        let current = this.getCurrentValue();
        this.start = current;
        this.end = goal;
        this.startTime = now;
        this.duration = this.getDuration();
    }

    reset(to: number) {
        this.start = to;
        this.end = to;
        this.startTime = -Infinity;
    }
}

interface InterpolatorOptions {
    ease: EaseType,
    duration: number,
    from: number,
    to: number
}

export class Interpolator {
    private options: InterpolatorOptions;
    private startTime: number = -Infinity;

    constructor(options: InterpolatorOptions) {
        this.options = options;
    }

    /**
     * 
     * @param customTime A custom time parameter to override performance.now with your own timekeeping system.
     */
    start(customTime?: number) {
        let now;
        if (customTime !== undefined) now = customTime;
        else now = performance.now();

        this.startTime = now;
    }

    /** Instantly finish the animation. */
    end() {
        this.startTime = -Infinity;
    }

    getCurrentValue(customTime?: number) {
        let now;
        if (customTime !== undefined) now = customTime;
        else now = performance.now();

        let completion = (now - this.startTime) / this.options.duration;
        completion = MathUtil.clamp(completion, 0, 1);
        completion = MathUtil.ease(this.options.ease, completion);

        return (1 - completion) * this.options.from + completion * this.options.to;
    }
}