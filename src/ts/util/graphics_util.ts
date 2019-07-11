import { MathUtil } from "./math_util";

export interface Color {
    r: number, // 0-255
    g: number, // 0-255
    b: number, // 0-255
    a?: number // 0.0-1.0
}

export function colorToHexNumber(color: Color) {
    return color.r * 0x10000 + color.g * 0x100 + color.b * 0x1;
}

interface InterpolatedCounterOptions {
    initial: number,
    duration: number, // In ms
    ease: string
}

// For animating numbers going from x to y
export class InterpolatedCounter {
    private start: number;
    private end: number;
    public duration: number;
    public ease: string;
    private startTime: number = -Infinity;

    constructor(options: InterpolatedCounterOptions) {
        this.start = options.initial;
        this.end = this.start;
        this.duration = options.duration;
        this.ease = options.ease;
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
    }

    reset(to: number) {
        this.start = to;
        this.end = to;
        this.startTime = -Infinity;
    }
}