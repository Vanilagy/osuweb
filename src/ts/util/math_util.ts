import { Point, pointDistanceSquared, Vector2 } from "./point";
import { last } from "./misc_util";

export const TAU = Math.PI * 2;

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

export abstract class MathUtil {
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
            // This uses De Casteljau's Algorithm, taken from https://stackoverflow.com/questions/41663348/bezier-curve-of-n-order?noredirect=1&lq=1. Probably not yet as fast as it can be, might have to look into some other form of array or WebAssembly.

            let list = pointArray.slice();

            for (let j = pointArray.length; j > 1; j--) {
                let firstIteration = j === pointArray.length;
            
                for (let i = 0; i < j-1; i++) {
                    let x = (1-t) * list[i].x + t * list[i+1].x,
                        y = (1-t) * list[i].y + t * list[i+1].y;

                    if (firstIteration) list[i] = {x, y};
                    else list[i].x = x, list[i].y = y;
                }
            }

            return list[0];
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

    // No, this isn't some mathematically-accurate 2nd derivative calculation. It's an estimate, and it does the job. Hopefully. >.<
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

        if (yDelta_a === 0) {         //aSlope == 0
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

    static mirror(val: number) {
        let mod2 = val % 2;
        if (mod2 > 1) return 2 - mod2;
        return mod2;
    }

    static getRandomInt(min: number, max: number) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    static randomInRange(min: number, max: number) {
        return Math.random() * (max - min) + min;
    }

    static getNormalizedAngleDelta(theta1: number, theta2: number) {
        let difference = theta2 - theta1;
        if (-difference < -Math.PI) {
            difference -= Math.PI * 2;
        } else if (difference < -Math.PI) {
            difference += Math.PI * 2;
        }
        return difference;
    }

    static getAggregateValuesFromArray(array: number[], start: number = 0, end?: number) {
        if (end === undefined) end = array.length;

        let total = 0;
        let min = Infinity;
        let max = -Infinity;

        for (let i = start; i < end; i++) {
            let val = array[i];

            total += val;
            if (val < min) min = val;
            if (val > max) max = val;
        }

        return {
            avg: total / (end - start),
            min: min,
            max: max
        };
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
                return val;
            case EaseType.EaseInQuad: // accelerating from zero velocity
                return val * val;
            case EaseType.EaseOutQuad: // decelerating to zero velocity
                return val * (2 - val);
            case EaseType.EaseInOutQuad: // acceleration until halfway, then deceleration
                return val < 0.5 ? 2 * val * val : -1 + (4 - 2 * val) * val;
            case EaseType.EaseInCubic: // accelerating from zero velocity
                return val * val * val;
            case EaseType.EaseOutCubic: // decelerating to zero velocity
                return (--val) * val * val + 1;
            case EaseType.EaseInOutCubic: // acceleration until halfway, then deceleration
                return val < 0.5 ? 4 * val * val * val : (val - 1) * (2 * val - 2) * (2 * val - 2) + 1;
            case EaseType.EaseInQuart: // accelerating from zero velocity
                return val * val * val * val;
            case EaseType.EaseOutQuart: // decelerating to zero velocity
                return 1-(--val) * val * val * val;
            case EaseType.EaseInOutQuart: // acceleration until halfway, then deceleration
                return val < 0.5 ? 8 * val * val * val * val : 1 - 8 * (--val) * val * val * val;
            case EaseType.EaseInQuint: // accelerating from zero velocity
                return val * val * val * val * val;
            case EaseType.EaseOutQuint: // decelerating to zero velocity
                return 1+(--val) * val * val * val * val;
            case EaseType.EaseInOutQuint: // acceleration until halfway, then deceleration
                return val < 0.5 ? 16 * val * val * val * val * val : 1 + 16*(--val) * val * val * val * val;
            case EaseType.EaseOutElastic: // Cartoon-like elastic effect
                return Math.pow(2,-10*val) * Math.sin((val-p/4)*(2*Math.PI)/p) + 1;
            case EaseType.EaseInSine: // accelerating from zero velocity, using trig.
                return -1 * Math.cos(val * (Math.PI / 2)) + 1;
            case EaseType.EaseOutSine: // decelerating to zero velocity, using trig.
                return Math.sin(val * (Math.PI / 2));
            case EaseType.EaseInOutSine: // acceleration until halfway, then deceleration, using trig.
                return Math.cos(Math.PI * val) * -0.5 + 0.5;
            case EaseType.EaseInExpo: // Accelerate exponentially until finish
                return val === 0 ? 0 : Math.pow(2, 10 * (val - 1));
            case EaseType.EaseOutExpo: // Initial exponential acceleration slowing to stop
                return val === 1 ? 1 : (-Math.pow(2, -10 * val) + 1);
            case EaseType.EaseInOutExpo: // Exponential acceleration and deceleration
                if (val === 0 || val === 1) return val;

                const scaledTime = val * 2;
                const scaledTime1 = scaledTime - 1;

                if (scaledTime < 1) {
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

    // Based on https://www.cubic.org/docs/hermite.htm
    static calculateCardinalSplineTangents(points: Point[], tightness: number) {
        let tangents: Vector2[] = [];

        for (let i = 0; i < points.length; i++) {
            let p1 = points[i-1] || points[0],
                p2 = points[i+1] || last(points);

            tangents.push({
                x: (p2.x - p1.x) * tightness,
                y: (p2.y - p1.y) * tightness
            });
        }

        return tangents;
    }

    static calculateCatmullRomTangents(points: Point[]) {
        return this.calculateCardinalSplineTangents(points, 0.5); // Catmull-Rom splines are just Cardinal splines with a fixed tightness of 0.5.
    }

    static pointOnCubicHermiteSpline(points: Point[], tangents: Vector2[], t: number): Point {
        let scaledT = t * (points.length - 1);
        let index = Math.floor(scaledT);
        let s = scaledT - index; // from 0 to 1 between two points

        if (s === 0) return points[index];

        let p1 = points[index],
            p2 = points[index+1],
            t1 = tangents[index],
            t2 = tangents[index+1];

        let h1 = 2*s**3 - 3*s**2 + 1,
            h2 = -2*s**3 + 3*s**2,
            h3 = s**3 - 2*s**2 + s,
            h4 = s**3 - s**2;

        return {
            x: h1*p1.x + h2*p2.x + h3*t1.x + h4*t2.x,
            y: h1*p1.y + h2*p2.y + h3*t1.y + h4*t2.y,
        };
    }

    // Based on ppy's algorithm: https://github.com/ppy/osu-framework/blob/master/osu.Framework/MathUtils/PathApproximator.cs
    static catmullFindPoint(v1: Point, v2: Point, v3: Point, v4: Point, t: number): Point {
        let t2 = t**2;
        let t3 = t**3;

        return {
            x: 0.5 * (2 * v2.x + (-v1.x + v3.x) * t + (2 * v1.x - 5 * v2.x + 4 * v3.x - v4.x) * t2 + (-v1.x + 3 * v2.x - 3 * v3.x + v4.x) * t3),
            y: 0.5 * (2 * v2.y + (-v1.y + v3.y) * t + (2 * v1.y - 5 * v2.y + 4 * v3.y - v4.y) * t2 + (-v1.y + 3 * v2.y - 3 * v3.y + v4.y) * t3)
        };
    }

    static createSeededRng(seed: number) {
        let a = seed,
            b = 3456735,
            c = 92769216,
            d = 12349;

        // An implementation of xoshiro128** found here: https://stackoverflow.com/questions/521295/seeding-the-random-number-generator-in-javascript
        return function() {
            var t = b << 9, r = a * 5; r = (r << 7 | r >>> 25) * 9;
            c ^= a; d ^= b;
            b ^= c; a ^= d; c ^= t;
            d = d << 11 | d >>> 21;
            return (r >>> 0) / 4294967296;
        };
    }

    /** One-dimensional value-based noise function with the output in [-1.0, 1.0] */
    static valueNoise1D(x: number) {
        let scaledX = x * 1.0; // lol idk
        let xFloor = Math.floor(scaledX);
        let t = scaledX - xFloor;
        let tRemapSmoothstep = t * t * (3 - 2 * t);

        var xMin = xFloor % valueNoiseLatticePoints.length;
        var xMax = ( xMin + 1 ) % valueNoiseLatticePoints.length;

        return MathUtil.lerp(valueNoiseLatticePoints[xMin], valueNoiseLatticePoints[xMax], tRemapSmoothstep);
    }

    static isPositiveZero(num: number) {
        return num === 0 && 1/num === Infinity;
    }

    static isNegativeZero(num: number) {
        return num === 0 && 1/num === -Infinity;
    }

    static fastHypot(dx: number, dy: number) {
        return (dx**2 + dy**2)**0.5;
	}
	
	/** Picture a unit circle centered at (0, 1), so touching the x-axis. This function returns the distance from P = (x, 0) to the point in the circle's outline directly above P.
	 *  Obviously, this function isn't defined for anything outside of [-1.0, 1.0].
	*/
	static unitCircleContour(x: number) {
		return -Math.sqrt(1 - x*x) + 1;
	}
}

let valueNoiseRng = MathUtil.createSeededRng(1337);
let valueNoiseLatticePoints: number[] = [];
// Fill it with random points in the interval [-1.0, 1.0]
for (let i = 0; i < 1024; i++) {
    valueNoiseLatticePoints.push(valueNoiseRng() * 2 - 1);
}