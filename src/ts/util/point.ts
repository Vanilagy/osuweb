export interface Point {
    x: number,
    y: number
}

export function interpolatePointInPointArray(arr: Point[], completion: number) {
    let actualIdx = completion * (arr.length - 1);
    let lowerIdx = Math.floor(actualIdx), upperIdx = Math.ceil(actualIdx);
    let lowerPos = arr[lowerIdx];
    let upperPos = arr[upperIdx];

    return { // Linear interpolation
        x: lowerPos.x * (1 - (actualIdx - lowerIdx)) + upperPos.x * (actualIdx - lowerIdx),
        y: lowerPos.y * (1 - (actualIdx - lowerIdx)) + upperPos.y * (actualIdx - lowerIdx)
    }
}