import { Point, pointDistanceSquared, Vector2, lerpPoints, pointNormal, pointDistance, subtractFromPoint, clonePoint, pointsAreEqual } from "./point";
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
	EaseInElastic,
	EaseOutElastic,
	EaseInSine,
	EaseOutSine,
	EaseInOutSine,
	EaseInExpo,
	EaseOutExpo,
	EaseInOutExpo,
	EaseInCirc,
	EaseOutCirc,
	EaseInOutCirc,
	EaseInBack,
	EaseOutBack,
	EaseInOutBack,
	EaseInElasticAlternative,
	EaseOutElasticAlternative,
	EaseOutElasticHalf,
	EaseOutElasticQuarter,
	EaseInOutElasticAlternative,
	EaseInBounce,
	EaseOutBounce,
	EaseInOutBounce
}

// Some constants for easing:
const c1 = 1.70158;
const c2 = c1 * 1.525;
const c3 = c1 + 1;
const c4 = (2 * Math.PI) / 3;
const c5 = (2 * Math.PI) / 4.5;
const elasticConst = 2 * Math.PI / 0.3;
const elasticConst2 = 0.3 / 4;
const elasticOffsetHalf = Math.pow(2, -10) * Math.sin((.5 - elasticConst2) * elasticConst);
const elasticOffsetQuarter = Math.pow(2, -10) * Math.sin((.25 - elasticConst2) * elasticConst);

export abstract class MathUtil {
	static pointOnBézierCurve(controlPoints: Point[], t: number): Point {
		let bx = 0, by = 0, n = controlPoints.length - 1; // degree
		
		if (n === 1) { // if linear
			bx = (1 - t) * controlPoints[0].x + t * controlPoints[1].x;
			by = (1 - t) * controlPoints[0].y + t * controlPoints[1].y;
		} else if (n === 2) { // if quadratic
			bx = (1 - t) * (1 - t) * controlPoints[0].x + 2 * (1 - t) * t * controlPoints[1].x + t * t * controlPoints[2].x;
			by = (1 - t) * (1 - t) * controlPoints[0].y + 2 * (1 - t) * t * controlPoints[1].y + t * t * controlPoints[2].y;
		} else if (n === 3) { // if cubic
			bx = (1 - t) * (1 - t) * (1 - t) * controlPoints[0].x + 3 * (1 - t) * (1 - t) * t * controlPoints[1].x + 3 * (1 - t) * t * t * controlPoints[2].x + t * t * t * controlPoints[3].x;
			by = (1 - t) * (1 - t) * (1 - t) * controlPoints[0].y + 3 * (1 - t) * (1 - t) * t * controlPoints[1].y + 3 * (1 - t) * t * t * controlPoints[2].y + t * t * t * controlPoints[3].y;
		} else { // generalized equation
			// This uses De Casteljau's Algorithm, taken from https://stackoverflow.com/questions/41663348/bezier-curve-of-n-order?noredirect=1&lq=1. Probably not yet as fast as it can be, might have to look into some other form of array or WebAssembly.

			let list = controlPoints.slice();

			for (let j = controlPoints.length; j > 1; j--) {
				let firstIteration = j === controlPoints.length;
			
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
	static curvatureOfBézierCurve(controlPoints: Point[], t: number, middlePoint?: Point) {
		let a = MathUtil.pointOnBézierCurve(controlPoints, t - 0.001),
			b = middlePoint || MathUtil.pointOnBézierCurve(controlPoints, t),
			c = MathUtil.pointOnBézierCurve(controlPoints, t + 0.001);

		let a1 = Math.atan2(b.y - a.y, b.x - a.x),
			a2 = Math.atan2(c.y - b.y, c.x - b.x);

		return Math.abs(MathUtil.getNormalizedAngleDelta(a1, a2));
	}

	/** Modifies an array representing a polyline's points to fit a certain length. Returns an array the length of the resulting point array, where each element is a number from 0 to 1 marking the percentage of how far the point at the corresponding index is along the track. */
	static fitPolylineToLength(points: Point[], arcLength: number) {
		let completions: number[] = [];
		let traveledDistance = 0;

		for (let i = 0; i < points.length; i++) {
			completions.push(traveledDistance / arcLength);

			let p1 = points[i],
				p2 = points[i+1];

			// This 'if' is true if we've reached the end of the array without having covered the entire arc length yet. Therefore, we need to add one extra point to cover the remaining distance by extending the last segment linearly.
			if (!p2) {
				// Find the index of the point closest to the end of the array that is different from the last point in the array. This has to be done so we can construct a linear segment.
				let p3Index = i;
				while (p3Index >= 0 && pointsAreEqual(p1, points[p3Index])) p3Index--;

				let p3: Point = points[p3Index] || {x: p1.x - 1, y: p1.y}; // If no point was found, just make "that point" be 1 unit left of the last point in the array.
				let dx = p1.x - p3.x,
					dy = p1.y - p3.y;
				let distance = pointDistance(p3, p1);
				let remainingDistance = arcLength - traveledDistance;

				// The additional point to add
				let p4: Point = {
					x: p1.x + dx / distance * remainingDistance,
					y: p1.y + dy / distance * remainingDistance
				};

				points.push(p4);
				completions.push(1.0);
				break;
			}

			let distance = pointDistance(p1, p2);
			traveledDistance += distance;

			// If we've overshot our target distance with the last point, we need to remove every point after it and add an intermediate point.
			if (traveledDistance > arcLength) {
				let t = (arcLength - (traveledDistance - distance)) / distance;
				let p3 = lerpPoints(p1, p2, t);

				points.splice(i+1, points.length - i - 1, p3);
				completions.push(1.0);

				break;
			}

			// If we've perfectly reached our distance, remove the remaining points in the array.
			if (traveledDistance === arcLength) {
				points.length = i+2;
				completions.push(1.0);

				break;
			}
		}

		return completions;
	}

	/**
	 * Downsamples a given polyline using a modified version of the Douglas–Peucker algorithm.
	 * @param points The points describing the polyline.
	 * @param epsilon The epsilon used by Douglas-Peucker.
	 * @param depth The current recursion depth.
	 */
	static downsamplePolyline(points: Point[], epsilon: number, depth = 0) {
		// If a certain recursion depth is reached, terminate the algorithm. We want to prevent an overflow!
		if (depth > 5000) return points;

		let p1 = points[0];
		let p2 = last(points);
		let dmax = -1;
		let indexLow = -1; // The index of the first point with dmax distance to the secant line
		let indexHigh = -1; // The index of the last point with dmax distance to the secant line

		let outsideOfSegmentFound = false; // Whether or not there was a point whose projection onto the secant line does not lie between p1 and p2.
		let indexFarthest = -1; // The index of the overall farthest-away point from either p1 or p2
		let farthestDistance = -1;

		for (let i = 1; i < points.length-1; i++) {
			let p0 = points[i];
			let d = MathUtil.distanceToLineSegmentSquared(p0, p1, p2);

			let otherD = Math.max(pointDistanceSquared(p0, p1), pointDistanceSquared(p0, p2));
			if (otherD > farthestDistance) {
				farthestDistance = otherD;
				indexFarthest = i;
			}

			if (d > dmax) {
				indexLow = i;
				indexHigh = i;
				dmax = d;

				outsideOfSegmentFound = !MathUtil.isProjectionInside(p0, p1, p2);
			} else if (d === dmax) {
				indexHigh = i;

				outsideOfSegmentFound = outsideOfSegmentFound || !MathUtil.isProjectionInside(p0, p1, p2);
			}
		}

		let result: Point[];

		if (outsideOfSegmentFound) {
			// If we found a point that doesn't project between p1 and p2, then split the curve in half at the farthest away point. This is done for cases in which p1 and p2 are really close together and something being close to their secant line is pretty much meaningless (in which case important curve points would get dropped!)
			let resultLeft = MathUtil.downsamplePolyline(points.slice(0, indexFarthest+1), epsilon, depth+1);
			let resultRight = MathUtil.downsamplePolyline(points.slice(indexFarthest), epsilon, depth+1);
			result = [...resultLeft, ...resultRight.slice(1)];
		} else if (dmax > epsilon * epsilon) {
			if (indexLow === indexHigh) {
				// The classic Douglas–Peucker case
				let resultLeft = MathUtil.downsamplePolyline(points.slice(0, indexLow+1), epsilon, depth+1);
				let resultRight = MathUtil.downsamplePolyline(points.slice(indexLow), epsilon, depth+1);
				result = [...resultLeft, ...resultRight.slice(1)];
			} else {
				// The extended case: If there are multiple points with the same distance to the secant line, split the curve into three parts instead.
				let resultLeft = MathUtil.downsamplePolyline(points.slice(0, indexLow+1), epsilon, depth+1);
				let resultMid = MathUtil.downsamplePolyline(points.slice(indexLow, indexHigh+1), epsilon, depth+1);
				let resultRight = MathUtil.downsamplePolyline(points.slice(indexHigh), epsilon, depth+1);
				result = [...resultLeft, ...resultMid.slice(1), ...resultRight.slice(1)];
			}
		} else {
			result = [p1, p2];
		}

		return result;
	}

	static distanceToLineSegmentSquared(p: Point, lineStart: Point, lineEnd: Point) {
		let segmentLengthSquared = pointDistanceSquared(lineStart, lineEnd);
		if (segmentLengthSquared === 0) return pointDistanceSquared(p, lineStart);

		let p1 = lineStart,
			p2 = lineEnd;

		return ((p2.y - p1.y) * p.x - (p2.x - p1.x) * p.y + p2.x*p1.y - p2.y*p1.x)**2 / segmentLengthSquared;
	}

	// https://stackoverflow.com/questions/35740374/orthogonal-projection-of-point-onto-line
	/** Returns true if p, projected onto the line between p2 and p3, lies between p2 and p3. */
	static isProjectionInside(p: Point, p2: Point, p3: Point) {
		const eps = 1e-6;
		let p_proj = (p.x - p2.x) * (p3.x - p2.x) + (p.y - p2.y) * (p3.y - p2.y);
		let p3_proj = (p3.x - p2.x) * (p3.x - p2.x) + (p3.y - p2.y) * (p3.y - p2.y);
	
		return (p_proj >= -eps) && (p_proj <= p3_proj + eps);
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
		if (val < min) return min;
		else if (val > max) return max;
		return val;
	}

	/** @param x Should be in the range [0, 1].
	 *  @param p Some shit used for elastic bounce */
	static ease(type: EaseType, x: number, p = 0.3): number {
		switch (type) {
			case EaseType.Linear:
				return x;
			case EaseType.EaseInQuad:
				return x * x;
			case EaseType.EaseOutQuad:
				return x * (2 - x);
			case EaseType.EaseInOutQuad:
				return x < 0.5 ? 2 * x * x : -1 + (4 - 2 * x) * x;
			case EaseType.EaseInCubic:
				return x * x * x;
			case EaseType.EaseOutCubic:
				return (--x) * x * x + 1;
			case EaseType.EaseInOutCubic:
				return x < 0.5 ? 4 * x * x * x : (x - 1) * (2 * x - 2) * (2 * x - 2) + 1;
			case EaseType.EaseInQuart:
				return x * x * x * x;
			case EaseType.EaseOutQuart:
				return 1-(--x) * x * x * x;
			case EaseType.EaseInOutQuart:
				return x < 0.5 ? 8 * x * x * x * x : 1 - 8 * (--x) * x * x * x;
			case EaseType.EaseInQuint:
				return x * x * x * x * x;
			case EaseType.EaseOutQuint:
				return 1+(--x) * x * x * x * x;
			case EaseType.EaseInOutQuint:
				return x < 0.5 ? 16 * x * x * x * x * x : 1 + 16*(--x) * x * x * x * x;
			case EaseType.EaseInElastic:
				return 1 - MathUtil.ease(EaseType.EaseOutElastic, 1 - x, p);
			case EaseType.EaseOutElastic:
				return Math.pow(2,-10*x) * Math.sin((x-p/4)*(2*Math.PI)/p) + 1;
			case EaseType.EaseInSine:
				return -1 * Math.cos(x * (Math.PI / 2)) + 1;
			case EaseType.EaseOutSine:
				return Math.sin(x * (Math.PI / 2));
			case EaseType.EaseInOutSine:
				return Math.cos(Math.PI * x) * -0.5 + 0.5;
			case EaseType.EaseInExpo:
				return x === 0 ? 0 : Math.pow(2, 10 * (x - 1));
			case EaseType.EaseOutExpo:
				return x === 1 ? 1 : (-Math.pow(2, -10 * x) + 1);
			case EaseType.EaseInOutExpo:
				if (x === 0 || x === 1) return x;

				const scaledTime = x * 2;
				const scaledTime1 = scaledTime - 1;

				if (scaledTime < 1) {
					return 0.5 * Math.pow(2, 10 * (scaledTime1));
				}

				return 0.5 * (-Math.pow(2, -10 * scaledTime1) + 2);
			case EaseType.EaseInCirc:
				return 1 - Math.sqrt(1 - Math.pow(x, 2));
			case EaseType.EaseOutCirc:
				return Math.sqrt(1 - Math.pow(x - 1, 2));
			case EaseType.EaseInOutCirc:
				return x < 0.5
					? (1 - Math.sqrt(1 - Math.pow(2 * x, 2))) / 2
					: (Math.sqrt(1 - Math.pow(-2 * x + 2, 2)) + 1) / 2;
			case EaseType.EaseInBack:
				return c3 * x * x * x - c1 * x * x;
			case EaseType.EaseOutBack:
				return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
			case EaseType.EaseInOutBack:
				return x < 0.5
					? (Math.pow(2 * x, 2) * ((c2 + 1) * 2 * x - c2)) / 2
					: (Math.pow(2 * x - 2, 2) * ((c2 + 1) * (x * 2 - 2) + c2) + 2) / 2;
			case EaseType.EaseInElasticAlternative:
				return x === 0
					? 0
					: x === 1
					? 1
					: -Math.pow(2, 10 * x - 10) * Math.sin((x * 10 - 10.75) * c4);
			case EaseType.EaseOutElasticAlternative:
				return x === 0
					? 0
					: x === 1
					? 1
					: Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
			case EaseType.EaseInOutElasticAlternative:
				return x === 0
					? 0
					: x === 1
					? 1
					: x < 0.5
					? -(Math.pow(2, 20 * x - 10) * Math.sin((20 * x - 11.125) * c5)) / 2
					: (Math.pow(2, -20 * x + 10) * Math.sin((20 * x - 11.125) * c5)) / 2 + 1;
			case EaseType.EaseOutElasticHalf:
				return Math.pow(2, -10 * x) * Math.sin((.5 * x - elasticConst2) * elasticConst) + 1 - elasticOffsetHalf * x;
			case EaseType.EaseOutElasticQuarter:
				return Math.pow(2, -10 * x) * Math.sin((.25 * x - elasticConst2) * elasticConst) + 1 - elasticOffsetQuarter * x;
			case EaseType.EaseInBounce:
				return 1 - MathUtil.ease(EaseType.EaseOutBounce, 1 - x);
			case EaseType.EaseOutBounce:
				const n1 = 7.5625;
				const d1 = 2.75;

				if (x < 1 / d1) {
					return n1 * x * x;
				} else if (x < 2 / d1) {
					return n1 * (x -= 1.5 / d1) * x + 0.75;
				} else if (x < 2.5 / d1) {
					return n1 * (x -= 2.25 / d1) * x + 0.9375;
				} else {
					return n1 * (x -= 2.625 / d1) * x + 0.984375;
				}
			case EaseType.EaseInOutBounce:
				return x < 0.5
					? (1 - MathUtil.ease(EaseType.EaseOutBounce, 1 - 2 * x)) / 2
					: (1 + MathUtil.ease(EaseType.EaseOutBounce, 2 * x - 1)) / 2;
			default:
				return x;
		}
	}

	/** Get an approximation of the slope of an easing function at a given point. */
	static easeSlope(type: EaseType, x: number, p?: number, epsilon = 0.00001) {
		return (MathUtil.ease(type, x + epsilon, p) - MathUtil.ease(type, x, p)) / epsilon;
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

	/** Finds a root (an x such that f(x) = 0) in the given interval [low, high], for which f has to be continuous, using the binary bisection method. Returns NaN if it fails to find a root (which doesn't mean there is none). */
	static findRootInInterval(f: (x: number) => number, low: number, high: number, epsilon = 0.00001) {
		let middle = (low + high) / 2;
		let valLow = f(low);
		let valMiddle = f(middle);
		let valHigh = f(high);

		if (valLow === 0) return low;
		if (valHigh === 0) return high;

		while (high - low > epsilon) {
			valMiddle = f(middle);
			if (valMiddle === 0) return middle;

			if (valLow * valMiddle < 0) {
				high = middle;
				valHigh = valMiddle;
			} else if (valMiddle * valHigh < 0) {
				low = middle;
				valLow = valMiddle;
			} else {
				return NaN;
			}

			middle = (low + high) / 2;
		}

		return middle;
	}

	static getPercentile(values: number[], percentile: number, sortInPlace = false) {
		let arr = sortInPlace? values : values.slice();
		arr.sort((a, b) => a-b);

		if (percentile === 0) return -Infinity;

		let index = Math.ceil(percentile / 100 * (arr.length - 1));
		return arr[index];
	}

	// Example: floorToMultiple(7, 2) = 6
	static floorToMultiple(num: number, factor: number) {
		return Math.floor(num / factor) * factor;
	}

	// Works correctly for negative numbers
	static adjustedMod(a: number, n: number) {
		return ((a % n) + n) % n;
	}

	static calculateMean(data: number[]) {
		let total = 0;
		for (let i = 0; i < data.length; i++) total += data[i];
		return total / data.length;
	}

	static calculateVariance(data: number[], precalculatedMean?: number) {
		let mean = (precalculatedMean === undefined)? MathUtil.calculateMean(data) : precalculatedMean;
		let sum = 0;

		for (let i = 0; i < data.length; i++) sum += Math.pow(data[i] - mean, 2);

		return sum / data.length;
	}

	static calculateStandardDeviation(data: number[], precalculatedMean?: number) {
		return Math.sqrt(MathUtil.calculateVariance(data, precalculatedMean));
	}

	/** Calculates the size of the overlap of two closed intervals (intervals that include both their end points). */
	static calculateIntervalOverlap(start1: number, end1: number, start2: number, end2: number) {
		// If they don't overlap at all, return 0.
		if (end1 <= start2 || end2 <= start1) return 0;

		let start = Math.max(start1, start2);
		let end = Math.min(end1, end2);
		return end - start;
	}
}

let valueNoiseRng = MathUtil.createSeededRng(1337);
let valueNoiseLatticePoints: number[] = [];
// Fill it with random points in the interval [-1.0, 1.0]
for (let i = 0; i < 1024; i++) {
	valueNoiseLatticePoints.push(valueNoiseRng() * 2 - 1);
}