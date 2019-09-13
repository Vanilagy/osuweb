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
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

// Gets the distanced squared, for efficiency 
export function pointDistanceSquared(p1: Point, p2: Point) {
    return (p1.x - p2.x)**2 + (p1.y - p2.y)**2;
}

export function pointAngle(p1: Point, p2: Point) {
    return Math.atan2(p2.y - p1.y, p2.x - p1.x);
}

export function pointsAreEqual(p1: Point, p2: Point) {
    return p1.x === p2.x && p1.y === p2.y;
}

export function clonePoint(p: Point): Point {
    return {x: p.x, y: p.y};
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