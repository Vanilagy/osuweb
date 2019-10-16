const OFFSET_PER_STACK_HEIGHT = -4;

export interface Point {
    x: number,
    y: number
}

// Works exactly like point, but doesn't always MEAN the same thing. Like, you wouldn't use a "Point" to describe a normal; you'd use a vector for that!
export interface Vector2 extends Point {}

export function interpolatePointInPointArray(arr: Point[], t: number): Point {
    if (arr.length <= 1) return arr[0] || null;

    let actualIdx = t * (arr.length - 1);
    let lowerIdx = Math.floor(actualIdx), upperIdx = Math.ceil(actualIdx);
    let lowerPos = arr[lowerIdx];
    let upperPos = arr[upperIdx];

    return { // Linear interpolation
        x: lowerPos.x * (1 - (actualIdx - lowerIdx)) + upperPos.x * (actualIdx - lowerIdx),
        y: lowerPos.y * (1 - (actualIdx - lowerIdx)) + upperPos.y * (actualIdx - lowerIdx)
    };
}

export function lerpPoints(p1: Point, p2: Point, completion: number): Point {
    return {
        x: p1.x * (1-completion) + p2.x * completion,
        y: p1.y * (1-completion) + p2.y * completion
    };
}

export function pointDistance(p1: Point, p2: Point) {
    return ((p1.x - p2.x)**2 + (p1.y - p2.y)**2)**0.5; // Doing it like this was measured to be about 100x faster than Math.hypot. Jesus.
}

// Gets the distanced squared, for efficiency 
export function pointDistanceSquared(p1: Point, p2: Point) {
    return (p1.x - p2.x)**2 + (p1.y - p2.y)**2;
}

export function pointAngle(p1: Point, p2: Point) {
    return Math.atan2(p2.y - p1.y, p2.x - p1.x);
}

export function pointNormal(p1: Point, p2: Point, precomputedLength?: number): Vector2 {
    let length = precomputedLength || pointDistance(p1, p2);

    return {
        x: -(p2.y - p1.y) / length,
        y: (p2.x - p1.x) / length,
    };
}

export function pointsAreEqual(p1: Point, p2: Point) {
    return p1.x === p2.x && p1.y === p2.y;
}

export function clonePoint(p: Point): Point {
    return p && {x: p.x, y: p.y};
}

export function calculateTotalPointArrayArcLength(arr: Point[]) {
    let total = 0;

    for (let i = 0; i < arr.length - 1; i++) {
        let p1 = arr[i],
            p2 = arr[i+1];

        total += pointDistance(p1, p2);
    }

    return total;
}

/** Modifies an array representing a polyline's points to fit a certain length. Returns an array the length of the resulting point array, where each element is a number from 0 to 1 marking the percentage of how far the point at the corresponding index is along the track. */
export function fitPolylineToLength(points: Point[], arcLength: number) {
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
            let p4 = {
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

export function stackShiftPoint(p: Point, stackHeight: number) {
    p.x += stackHeight * OFFSET_PER_STACK_HEIGHT;
    p.y += stackHeight * OFFSET_PER_STACK_HEIGHT;
}

/** Rotates the point around 0|0 by an angle. */
export function rotatePoint(point: Point, angle: number) {
    let oldX = point.x,
        oldY = point.y,
        sin = Math.sin(angle),
        cos = Math.cos(angle);

    point.x = cos*oldX - sin*oldY;
    point.y = sin*oldX + cos*oldY;
}

export function addPoints(p1: Point, p2: Point): Point {
    return {
        x: p1.x + p2.x,
        y: p1.y + p2.y
    };
}