import { Point, pointDistanceSquared } from "./point";

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
	static pointOnBézierCurve(pointArray: Point[], t: number): Point {
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
    static curvatureOfBézierCurve(pointArray: Point[], t: number, middlePoint?: Point) {
        let a = MathUtil.pointOnBézierCurve(pointArray, t - 0.001),
            b = middlePoint || MathUtil.pointOnBézierCurve(pointArray, t),
            c = MathUtil.pointOnBézierCurve(pointArray, t + 0.001);

        let a1 = Math.atan2(b.y - a.y, b.x - a.x),
            a2 = Math.atan2(c.y - b.y, c.x - b.x);

        return Math.abs(MathUtil.getNormalizedAngleDelta(a1, a2));
    }
    static triangleArea(a: Point, b: Point, c: Point) {
        return 0.5 * ((b.x - a.x)*(c.y - a.y) - (c.x - a.x)*(b.y - a.y));
    }
    static circleRadius(p1: Point, p2: Point, p3: Point) {
        let ds1 = pointDistanceSquared(p1, p2),
            ds2 = pointDistanceSquared(p2, p3),
            ds3 = pointDistanceSquared(p1, p3),
            area = MathUtil.triangleArea(p1, p2, p3);

        return Math.sqrt(ds1 * ds2 * ds3) / (4 * area);
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

        if(yDelta_a === 0) {         //aSlope == 0
            center.x = AB_Mid.x;
            if (xDelta_b === 0) {        //bSlope == INFINITY
                center.y = BC_Mid.y;
            } else {
                center.y = BC_Mid.y + (BC_Mid.x-center.x)/bSlope;
            }
        } else if (yDelta_b === 0) {             //bSlope == 0
            center.x = BC_Mid.x;
            if (xDelta_a === 0) {           //aSlope == INFINITY
                center.y = AB_Mid.y;
            } else {
                center.y = AB_Mid.y + (AB_Mid.x-center.x)/aSlope;
            }
        } else if (xDelta_a === 0) {       //aSlope == INFINITY
            center.y = AB_Mid.y;
            center.x = bSlope*(BC_Mid.y-center.y) + BC_Mid.x;
        } else if (xDelta_b === 0) {       //bSlope == INFINITY
            center.y = BC_Mid.y;
            center.x = aSlope*(AB_Mid.y-center.y) + AB_Mid.x;
        } else {
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
    static ease(type: EaseType, val: number, p = 0.3) {
        // p = Some shit used for elastic bounce

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

    static lerp(start: number, end: number, t: number) {
        return (1-t)*start + t*end;
    }

    /** Makes sure an angle is in the interval [-PI, PI] */
    static constrainRadians(angle: number) {
        if (angle > Math.PI) angle -= Math.PI*2;
        if (angle < -Math.PI) angle += Math.PI*2;

        return angle;
    }

    // Adopted from https://github.com/SRombauts/SimplexNoise/blob/master/src/SimplexNoise.cpp
    static simplexNoise1D(x: number) {
        let n0: number, n1: number;   // Noise contributions from the two "corners"
    
        // No need to skew the input space in 1D
    
        // Corners coordinates (nearest integer values):
        let i0 = Math.floor(x);
        let i1 = i0 + 1;
        // Distances to corners (between 0 and 1):
        let x0 = x - i0;
        let x1 = x0 - 1.0;
    
        // Calculate the contribution from the first corner
        let t0 = 1.0 - x0*x0;
    //  if(t0 < 0.0f) t0 = 0.0f; // not possible
        t0 *= t0;
        n0 = t0 * t0 * noiseGrad(noiseHash(i0), x0);
    
        // Calculate the contribution from the second corner
        let t1 = 1.0 - x1*x1;
    //  if(t1 < 0.0f) t1 = 0.0f; // not possible
        t1 *= t1;
        n1 = t1 * t1 * noiseGrad(noiseHash(i1), x1);
    
        // The maximum value of this noise is 8*(3/4)^4 = 2.53125
        // A factor of 0.395 scales to fit exactly within [-1,1]
        return 0.395 * (n0 + n1);
    }
}

/* The three following functions are helper functions for the simplex noise: */

let noisePerm = [
    151, 160, 137, 91, 90, 15,
    131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23,
    190, 6, 148, 247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33,
    88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71, 134, 139, 48, 27, 166,
    77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244,
    102, 143, 54, 65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169, 200, 196,
    135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64, 52, 217, 226, 250, 124, 123,
    5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59, 227, 47, 16, 58, 17, 182, 189, 28, 42,
    223, 183, 170, 213, 119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9,
    129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232, 178, 185, 112, 104, 218, 246, 97, 228,
    251, 34, 242, 193, 238, 210, 144, 12, 191, 179, 162, 241, 81, 51, 145, 235, 249, 14, 239, 107,
    49, 192, 214, 31, 181, 199, 106, 157, 184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150, 254,
    138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180
];
function noiseHash(i: number) {
    return noisePerm[i | 0];
}
function noiseGrad(hash: number, x: number) {
    let h = hash & 0x0F;  // Convert low 4 bits of hash code
    let grad = 1.0 + (h & 7);    // Gradient value 1.0, 2.0, ..., 8.0
    if ((h & 8) != 0) grad = -grad; // Set a random sign for the gradient
//  float grad = gradients1D[h];    // NOTE : Test of Gradient look-up table instead of the above
    return (grad * x);              // Multiply the gradient with the distance
}