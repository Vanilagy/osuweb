import { Point } from "./point";

export enum EaseType {
    Linear,
    EaseInQuad,
    EaseOutQuad,
    EaseInOutQuad,
    EaseInCubic,
    EaseOutCubic,
    EaseInOutCubic,
    EaseInQuart,
    EaseOutQuart,
    EaseInOutQuart,
    EaseInQuint,
    EaseOutQuint,
    EaseInOutQuint,
    EaseOutElastic,
    EaseInSine,
    EaseOutSine,
    EaseInOutSine,
    EaseInExpo,
    EaseOutExpo,
    EaseInOutExpo
}

export class MathUtil {
	static coordsOnBezier(pointArray: Point[], t: number): Point {
        let bx = 0, by = 0, n = pointArray.length - 1; // degree

        if (n === 1) { // if linear
            bx = (1 - t) * pointArray[0].x + t * pointArray[1].x;
            by = (1 - t) * pointArray[0].y + t * pointArray[1].y;
        } else if (n === 2) { // if quadratic
            bx = (1 - t) * (1 - t) * pointArray[0].x + 2 * (1 - t) * t * pointArray[1].x + t * t * pointArray[2].x;
            by = (1 - t) * (1 - t) * pointArray[0].y + 2 * (1 - t) * t * pointArray[1].y + t * t * pointArray[2].y;
        } else if (n === 3) { // if cubic
            bx = (1 - t) * (1 - t) * (1 - t) * pointArray[0].x + 3 * (1 - t) * (1 - t) * t * pointArray[1].x + 3 * (1 - t) * t * t * pointArray[2].x + t * t * t * pointArray[3].x;
            by = (1 - t) * (1 - t) * (1 - t) * pointArray[0].y + 3 * (1 - t) * (1 - t) * t * pointArray[1].y + 3 * (1 - t) * t * t * pointArray[2].y + t * t * t * pointArray[3].y;
        } else { // generalized equation
            for (let i = 0; i <= n; i++) {
                bx += this.binomialCoef(n, i) * Math.pow(1 - t, n - i) * Math.pow(t, i) * pointArray[i].x;
                by += this.binomialCoef(n, i) * Math.pow(1 - t, n - i) * Math.pow(t, i) * pointArray[i].y;
            }
        }

        return {x: bx, y: by};
	}
    static binomialCoef(n: number, k: number): number {
        // I tried to add caching to this function, but apparently, V8 already recognized this function is "hot" (called a lot), and therefore caches it in the background or something. It was slower with manual caching than without.

        if (k > n)
            return 0;

		let r = 1;
        for (let d = 1; d <= k; d++) {
            r *= n--;
            r /= d;
        }

        return r;
	}
    static circleCenterPos(p1: Point, p2: Point, p3: Point): Point {
        let yDelta_a = p2.y - p1.y;
        let xDelta_a = p2.x - p1.x;
        let yDelta_b = p3.y - p2.y;
        let xDelta_b = p3.x - p2.x;
        let center = {x: 0, y: 0};

        let aSlope = yDelta_a/xDelta_a;
        let bSlope = yDelta_b/xDelta_b;

        let AB_Mid = {x: (p1.x+p2.x)/2, y: (p1.y+p2.y)/2};
        let BC_Mid = {x: (p2.x+p3.x)/2, y: (p2.y+p3.y)/2};

        if(yDelta_a === 0)         //aSlope == 0
        {
            center.x = AB_Mid.x;
            if (xDelta_b === 0)         //bSlope == INFINITY
            {
                center.y = BC_Mid.y;
            }
            else
            {
                center.y = BC_Mid.y + (BC_Mid.x-center.x)/bSlope;
            }
        }
        else if (yDelta_b === 0)               //bSlope == 0
        {
            center.x = BC_Mid.x;
            if (xDelta_a === 0)             //aSlope == INFINITY
            {
                center.y = AB_Mid.y;
            }
            else
            {
                center.y = AB_Mid.y + (AB_Mid.x-center.x)/aSlope;
            }
        }
        else if (xDelta_a === 0)        //aSlope == INFINITY
        {
            center.y = AB_Mid.y;
            center.x = bSlope*(BC_Mid.y-center.y) + BC_Mid.x;
        }
        else if (xDelta_b === 0)        //bSlope == INFINITY
        {
            center.y = BC_Mid.y;
            center.x = aSlope*(AB_Mid.y-center.y) + AB_Mid.x;
        }
        else
        {
            center.x = (aSlope*bSlope*(AB_Mid.y-BC_Mid.y) - aSlope*BC_Mid.x + bSlope*AB_Mid.x)/(bSlope-aSlope);
            center.y = AB_Mid.y - (center.x - AB_Mid.x)/aSlope;
        }

        return center;
    }
    static reflect(val: number) {
        let mod2 = val % 2;
        if (mod2 > 1) return 2 - mod2;
        return mod2;
    }
    static distance(p1: Point, p2: Point) {
	    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
    }
    static getRandomInt(min: number, max: number) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    static getNormalizedAngleDelta(alpha: number, beta: number) {
        let difference = alpha - beta;
        if (beta - alpha < -Math.PI) {
            difference -= Math.PI * 2;
        } else if (difference < -Math.PI) {
            difference += Math.PI * 2;
        }
        return difference;
    }
    // start: inclusive, end: exclusive
    static getAvgInArray(array: number[], start: number = 0, end?: number) {
        if (end === undefined) end = array.length;

        let total = 0;
        for (let i = start; i < end; i++) {
            total += array[i];
        }
        
        return total / (end - start);
    }
    static clamp(val: number, min: number, max: number) {
	    if (val < min) {
	        return min;
        } else if (val > max) {
	        return max;
        }
        return val;
    }
    static ease(type: EaseType, val: number) {
        let p = 0.3; // Some shit used for elastic bounce

	    switch (type) {
	        /**
                Only considering the value for the range [0, 1] => [0, 1].
	            The higher the power used (Quad, Cubic, Quart), the more sudden the animation will be.
	        */

            case EaseType.Linear: // no easing, no acceleration
                return val; break;
            case EaseType.EaseInQuad: // accelerating from zero velocity
                return val * val; break;
            case EaseType.EaseOutQuad: // decelerating to zero velocity
                return val * (2 - val); break;
            case EaseType.EaseInOutQuad: // acceleration until halfway, then deceleration
                return val < 0.5 ? 2 * val * val : -1 + (4 - 2 * val) * val; break;
            case EaseType.EaseInCubic: // accelerating from zero velocity
                return val * val * val; break;
            case EaseType.EaseOutCubic: // decelerating to zero velocity
                return (--val) * val * val + 1; break;
            case EaseType.EaseInOutCubic: // acceleration until halfway, then deceleration
                return val < 0.5 ? 4 * val * val * val : (val - 1) * (2 * val - 2) * (2 * val - 2) + 1; break;
            case EaseType.EaseInQuart: // accelerating from zero velocity
                return val * val * val * val; break;
            case EaseType.EaseOutQuart: // decelerating to zero velocity
                return 1-(--val) * val * val * val; break;
            case EaseType.EaseInOutQuart: // acceleration until halfway, then deceleration
                return val < 0.5 ? 8 * val * val * val * val : 1 - 8 * (--val) * val * val * val; break;
            case EaseType.EaseInQuint: // accelerating from zero velocity
                return val * val * val * val * val; break;
            case EaseType.EaseOutQuint: // decelerating to zero velocity
                return 1+(--val) * val * val * val * val; break;
            case EaseType.EaseInOutQuint: // acceleration until halfway, then deceleration
                return val < 0.5 ? 16 * val * val * val * val * val : 1 + 16*(--val) * val * val * val * val; break;
            case EaseType.EaseOutElastic: // Cartoon-like elastic effect
                return Math.pow(2,-10*val) * Math.sin((val-p/4)*(2*Math.PI)/p) + 1; break;
            case EaseType.EaseInSine: // accelerating from zero velocity, using trig.
                return -1 * Math.cos(val * (Math.PI / 2)) + 1; break;
            case EaseType.EaseOutSine: // decelerating to zero velocity, using trig.
                return Math.sin(val * (Math.PI / 2)); break;
            case EaseType.EaseInOutSine: // acceleration until halfway, then deceleration, using trig.
                return Math.cos(Math.PI * val) * -0.5 + 0.5; break;
            case EaseType.EaseInExpo: // Accelerate exponentially until finish
                return val === 0 ? 0 : Math.pow(2, 10 * (val - 1)); break;
            case EaseType.EaseOutExpo: // Initial exponential acceleration slowing to stop
                return val === 1 ? 1 : (-Math.pow(2, -10 * val) + 1);
            case EaseType.EaseInOutExpo: // Exponential acceleration and deceleration
                if (val === 0 || val === 1) return val;

                const scaledTime = val * 2;
                const scaledTime1 = scaledTime - 1;

                if(scaledTime < 1) {
                    return 0.5 * Math.pow(2, 10 * (scaledTime1));
                }

                return 0.5 * (-Math.pow(2, -10 * scaledTime1) + 2);
            default:
                return val;
        }
    }
}

let interpolationStorage = {};