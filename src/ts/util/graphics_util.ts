import { MathUtil, EaseType } from "./math_util";

export interface Dimensions {
    width: number,
    height: number
}

export interface Color {
    r: number, // 0-255
    g: number, // 0-255
    b: number, // 0-255
    a?: number // 0.0-1.0
}

export function colorToHexNumber(color: Color) {
    return color.r * 0x10000 + color.g * 0x100 + color.b * 0x1;
}

export function colorToHexString(color: Color) {
    return '#' + ('000000' + colorToHexNumber(color).toString(16)).slice(-6);
}

export function lerpColors(c1: Color, c2: Color, t: number) {
    return {
        r: MathUtil.lerp(c1.r, c2.r, t) | 0,
        g: MathUtil.lerp(c1.g, c2.g, t) | 0,
        b: MathUtil.lerp(c1.b, c2.b, t) | 0
    };
}

export const Colors = {
    White: {r: 255, g: 255, b: 255} as Color,
    Black: {r: 0, g: 0, b: 0} as Color,
    Red: {r: 255, g: 0, b: 0} as Color,
    Green: {r: 0, g: 255, b: 0} as Color,
    Blue: {r: 0, g: 0, b: 255} as Color,
    Yellow: {r: 255, g: 255, b: 0} as Color
};

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

        let timePassed = (now === this.startTime)? 0 : now - this.startTime; // This check might seem unnecessary, since x - x = 0, however that does not hold true for x = +-Infinity. Since some maps are... questionable, we need to add this check.
        
        let completion = MathUtil.clamp(timePassed / this.duration, 0, 1);
        completion = MathUtil.ease(this.ease, completion);

        return MathUtil.lerp(this.start, this.end, completion);
    }

    setGoal(goal: number, customTime?: number) {
        let now;
        if (customTime !== undefined) now = customTime;
        else now = performance.now();

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
}

interface InterpolatorOptions {
    ease: EaseType,
    duration: number,
    from: number,
    to: number,
    invertDefault?: boolean
}

export class Interpolator {
    private options: InterpolatorOptions;
    private startTime: number = -Infinity;

    constructor(options: InterpolatorOptions) {
        this.options = options;

        if (this.options.invertDefault) this.startTime = Infinity;
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

        return MathUtil.lerp(this.options.from, this.options.to, completion);
    }
}