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

    getCurrentValue() {
        let now = performance.now();
        let completion = MathUtil.clamp((now - this.startTime) / this.duration, 0, 1);
        completion = MathUtil.ease(this.ease, completion);

        return this.start * (1 - completion) + this.end * completion;
    }

    setGoal(goal: number) {
        let current = this.getCurrentValue();
        this.start = current;
        this.end = goal;
        this.startTime = performance.now();
        this.duration = this.getDuration();
    }

    reset(to: number) {
        this.start = to;
        this.end = to;
        this.startTime = -Infinity;
    }
}