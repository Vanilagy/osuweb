import { Point, Vector2, pointDistance, pointsAreEqual, clonePoint, calculateTotalPointArrayArcLength, interpolatePointInPointArray } from "../util/point";
import { gameState } from "./game_state";
import { MathUtil } from "../util/math_util";
import { last, jsonClone } from "../util/misc_util";
import { Slider, SliderCurveSectionType } from "../datamodel/slider";

const SLIDER_BODY_SIZE_REDUCTION_FACTOR = 0.92; // Dis correct?
const SLIDER_CAPCIRCLE_SEGMENTS = 48;
const SLIDER_CAP_CIRCLE_SEGMENT_ARC_LENGTH = Math.PI*2 / SLIDER_CAPCIRCLE_SEGMENTS;
const CIRCLE_ARC_SEGMENT_LENGTH = 10; // For P sliders
const EQUIDISTANT_POINT_DISTANCE = 3;
const CATMULL_ROM_SECTION_SAMPLE_COUNT = 50;

// Returns the maximum amount of floats needed to store one line segment in the VBO
function getMaxFloatsPerLineSegment() {
    const floatsPerVertex = 3;
    const verticesPerTriangle = 3;
    const trianglesPerLineSegment = 4 + Math.ceil(SLIDER_CAPCIRCLE_SEGMENTS/2);

    return floatsPerVertex * verticesPerTriangle * trianglesPerLineSegment;
}

interface VertexBufferGenerationData {
    buffer: Float32Array,
    currentIndex: number,
    radius: number
}

export interface SliderPathBounds {
    minX: number,
    maxX: number,
    minY: number,
    maxY: number
}

export class SliderPath {
    public points: Point[]; // These points should be pretty much equidistant.
    public lineLengths: number[] = [];
    public lineThetas: number[] = [];
    public lineNormals: Vector2[] = [];
    public baseVertexBuffer: Float32Array;
    public lineSegmentVBOIndices: number[] = []; // Basically, to which index (exclusive) in the VBO one needs to draw in order to draw the first _n_ line segments.
    private lineRadius: number;

    constructor(points: Point[]) {
        this.points = points;

        for (let i = 0; i < points.length-1; i++) {
            let p1 = points[i],
                p2 = points[i+1];

            let length = pointDistance(p1, p2);
            let theta = Math.atan2(p2.y - p1.y, p2.x - p1.x);
            let normal: Vector2 = {
                x: -(p2.y - p1.y) / length,
                y: (p2.x - p1.x) / length,
            };

            this.lineLengths.push(length);
            this.lineThetas.push(theta);
            this.lineNormals.push(normal);
        }
    }

    static fromSlider(slider: Slider) {
        let sections = slider.sections;

        let points: Point[];

        if (sections.length === 0) points = [];
        else {
            let type = sections[0].type;

            if (type === SliderCurveSectionType.Perfect) points = calculatePerfectSliderPoints(slider);
            else if (type === SliderCurveSectionType.Linear || type === SliderCurveSectionType.Bézier) points = calculateBézierSliderPoints(slider);
            else if (type === SliderCurveSectionType.Catmull) points = calculateCatmullSliderPoints(slider);
        }

        return new SliderPath(points);
    }

    getPosFromPercentage(percentage: number) {
        return interpolatePointInPointArray(this.points, percentage);
    }

    getAngleFromPercentage(percentage: number) {
        if (this.points.length <= 1) return 0;

        let index = Math.floor(percentage * (this.points.length - 1));
        if (index === this.points.length - 1) index--;
        return this.lineThetas[index];
    }

    applyStackPosition(stackHeight: number) {
        for (let i = 0; i < this.points.length; i++) {
            let point = this.points[i];

            point.x += stackHeight * -4;
            point.y += stackHeight * -4;
        }
    }

    calculatePathBounds() {
        let bounds: SliderPathBounds = {
            minX: Infinity,
            maxX: -Infinity,
            minY: Infinity,
            maxY: -Infinity
        };

        for (let i = 0; i < this.points.length; i++) {
            let point = this.points[i];

            if (point.x < bounds.minX) bounds.minX = point.x;
            if (point.x > bounds.maxX) bounds.maxX = point.x;
            if (point.y < bounds.minY) bounds.minY = point.y;
            if (point.y > bounds.maxY) bounds.maxY = point.y;
        }

        return bounds;
    }

    generateBaseVertexBuffer() {
        let { circleRadiusOsuPx } = gameState.currentPlay;

        this.lineRadius = circleRadiusOsuPx * SLIDER_BODY_SIZE_REDUCTION_FACTOR;

        let buffer = new Float32Array((this.points.length - 1) * getMaxFloatsPerLineSegment());

        let data: VertexBufferGenerationData = {
            buffer: buffer,
            currentIndex: 0,
            radius: this.lineRadius
        };

        for (let i = 0; i < this.points.length-1; i++) {
            let p1 = this.points[i],
                p2 = this.points[i+1],
                theta = this.lineThetas[i],
                normal = this.lineNormals[i],
                prevTheta = this.lineThetas[i-1],
                prevNormal = this.lineNormals[i-1];

            SliderPath.addVerticesForLineSegment(data, p1, p2, theta, normal, prevTheta, prevNormal);

            this.lineSegmentVBOIndices.push(data.currentIndex);
        }

        let sliced = buffer.slice(0, data.currentIndex);
        this.baseVertexBuffer = sliced;
    }

    generateVertexBuffer(completion: number) {
        let targetIndex = Math.floor(this.lineSegmentVBOIndices.length * completion);
        let vboIndex = this.lineSegmentVBOIndices[targetIndex - 1] || 0;

        let lineCapAddedLength = 3 * 3 * SLIDER_CAPCIRCLE_SEGMENTS * 2; // 3 floats per vertex, 3 vertices per triangle, ..., and 2 caps in total
        let additionalLineSegmentLength = (completion < 1)? getMaxFloatsPerLineSegment() : 0;
        let length = vboIndex + lineCapAddedLength + additionalLineSegmentLength;

        let buffer = new Float32Array(length);
        buffer.set(this.baseVertexBuffer.slice(0, vboIndex));

        let data: VertexBufferGenerationData = {
            buffer: buffer,
            currentIndex: vboIndex,
            radius: this.lineRadius
        };

        let firstP = this.points[0],
            lastP: Point;

        if (completion < 1) {
            // Add an additional line segment.

            let p1Index = Math.floor((this.points.length - 1) * completion)

            let p1 = this.points[p1Index];
            let p2 = this.getPosFromPercentage(completion);

            let length = pointDistance(p1, p2);
            let theta = Math.atan2(p2.y - p1.y, p2.x - p1.x);
            let normal: Vector2 = {
                x: -(p2.y - p1.y) / length,
                y: (p2.x - p1.x) / length,
            };
            let prevTheta = this.lineThetas[p1Index - 1],
                prevNormal = this.lineNormals[p1Index - 1];

            SliderPath.addVerticesForLineSegment(data, p1, p2, theta, normal, prevTheta, prevNormal);

            lastP = p2;
        }

        if (!lastP) lastP = last(this.points);

        SliderPath.addLineCap(data, firstP.x, firstP.y, 0, Math.PI*2); // Draw a full circle for now. Can be optimized!
        SliderPath.addLineCap(data, lastP.x, lastP.y, 0, Math.PI*2);

        return buffer.slice(0, data.currentIndex);
    }

    private static addVertex(data: VertexBufferGenerationData, x: number, y: number, z: number) {
        data.buffer[data.currentIndex] = x;
        data.buffer[data.currentIndex+1] = y;
        data.buffer[data.currentIndex+2] = z;

        data.currentIndex += 3;
    }

    private static addVerticesForLineSegment(data: VertexBufferGenerationData, p1: Point, p2: Point, theta: number, normal: Vector2, prevTheta?: number, prevNormal?: Vector2) {
        let radius = data.radius;
        
        let bottomMiddle = p1;
        let topMiddle = p2;

        let bottomLeftX = p1.x - normal.x * radius,
            bottomLeftY = p1.y - normal.y * radius;
        let topLeftX = p2.x - normal.x * radius,
            topLeftY = p2.y - normal.y * radius;
        let bottomRightX = p1.x + normal.x * radius,
            bottomRightY = p1.y + normal.y * radius;
        let topRightX = p2.x + normal.x * radius,
            topRightY = p2.y + normal.y * radius;

        SliderPath.addVertex(data, bottomMiddle.x, bottomMiddle.y, 0.0);
        SliderPath.addVertex(data, bottomLeftX, bottomLeftY, 1.0);
        SliderPath.addVertex(data, topLeftX, topLeftY, 1.0);

        SliderPath.addVertex(data, bottomMiddle.x, bottomMiddle.y, 0.0);
        SliderPath.addVertex(data, topMiddle.x, topMiddle.y, 0.0);
        SliderPath.addVertex(data, topLeftX, topLeftY, 1.0);

        SliderPath.addVertex(data, bottomMiddle.x, bottomMiddle.y, 0.0);
        SliderPath.addVertex(data, bottomRightX, bottomRightY, 1.0);
        SliderPath.addVertex(data, topRightX, topRightY, 1.0);

        SliderPath.addVertex(data, bottomMiddle.x, bottomMiddle.y, 0.0);
        SliderPath.addVertex(data, topMiddle.x, topMiddle.y, 0.0);
        SliderPath.addVertex(data, topRightX, topRightY, 1.0);

        outer:
        if (prevNormal) {
            let td = MathUtil.getNormalizedAngleDelta(prevTheta, theta);
            let absTd = Math.abs(td);

            if (absTd < 1e-13) break outer; // Unnecessary for really small angles.

            if (absTd <= SLIDER_CAP_CIRCLE_SEGMENT_ARC_LENGTH) {
                let v2x: number,
                    v2y: number,
                    v3x: number,
                    v3y: number;

                if (td > 0) {
                    v2x = p1.x - prevNormal.x * radius;
                    v2y = p1.y - prevNormal.y * radius;
                    v3x = bottomLeftX;
                    v3y = bottomLeftY;
                } else {
                    v2x = p1.x + prevNormal.x * radius;
                    v2y = p1.y + prevNormal.y * radius;
                    v3x = bottomRightX;
                    v3y = bottomRightY;
                }

                SliderPath.addVertex(data, p1.x, p1.y, 0.0);
                SliderPath.addVertex(data, v2x, v2y, 1.0);
                SliderPath.addVertex(data, v3x, v3y, 1.0);
            } else {
                let startingAngle = (td > 0)? prevTheta - Math.PI/2 : prevTheta + Math.PI/2;
                SliderPath.addLineCap(data, p1.x, p1.y, startingAngle, td);
            }
        }
    }

    private static addLineCap(data: VertexBufferGenerationData, x: number, y: number, startingAngle: number, angleDifference: number) {
        let segments = Math.ceil(Math.abs(angleDifference) / SLIDER_CAP_CIRCLE_SEGMENT_ARC_LENGTH) || 1;
        let radiansPerSegment = angleDifference / segments;
        let radius = data.radius;

        let p2x = x + Math.cos(startingAngle) * radius,
            p2y = y + Math.sin(startingAngle) * radius;
        for (let i = 0; i < segments; i++) {
            let p3Angle = startingAngle + radiansPerSegment * (i+1);
            let p3x = x + Math.cos(p3Angle) * radius,
                p3y = y + Math.sin(p3Angle) * radius

            SliderPath.addVertex(data, x, y, 0.0);
            SliderPath.addVertex(data, p2x, p2y, 1.0);
            SliderPath.addVertex(data, p3x, p3y, 1.0);

            p2x = p3x;
            p2y = p3y;
        }
    }

    generateGeometry(completion: number) {
        let geometry = new PIXI.Geometry();
        geometry.addAttribute(
            'vertPosition',
            new PIXI.Buffer(new Float32Array(0)),
            3,
            false,
            PIXI.TYPES.FLOAT,
            3 * Float32Array.BYTES_PER_ELEMENT,
            0
        );

        this.updateGeometry(geometry, completion);
        return geometry;
    }

    updateGeometry(geometry: PIXI.Geometry, completion: number) {
        let vertexBuffer = this.generateVertexBuffer(completion);
        let pixiBuffer = geometry.getBuffer('vertPosition');

        pixiBuffer.update(vertexBuffer);
    }
}

function calculatePerfectSliderPoints(slider: Slider) {
    let sections = slider.sections;
    let points = sections[0].values;

    // Monstrata plz
    if (pointsAreEqual(points[0], points[2])) { // case one
        //Console.warn("Converted P to L-slider due to case one.");
        sections = jsonClone(sections); // Sicce we're modifying the sections here, we have to decouple them from the raw hit object.

        sections[0] = {type: SliderCurveSectionType.Linear, values: [points[0], points[1]]};
        sections[1] = {type: SliderCurveSectionType.Linear, values: [points[1], points[2]]};

        return calculateBézierSliderPoints(slider);
    }

    let centerPos = MathUtil.circleCenterPos(points[0], points[1], points[2]);

    // Slider seems to have all points on one line. Parsing it as linear slider instead
    if (!isFinite(centerPos.x) || !isFinite(centerPos.y)) { // case two
        //Console.warn("Converted P to L-slider due to case two.");
        sections = jsonClone(sections);
    
        // Remove middle point
        sections[0].values.splice(1, 1);
        sections[0].type = SliderCurveSectionType.Linear;

        return calculateBézierSliderPoints(slider);
    }

    let radius = pointDistance(centerPos, points[0]);
    let a1 = Math.atan2(points[0].y - centerPos.y, points[0].x - centerPos.x), // angle to start
        a2 = Math.atan2(points[1].y - centerPos.y, points[1].x - centerPos.x), // angle to control point
        a3 = Math.atan2(points[2].y - centerPos.y, points[2].x - centerPos.x); // angle to end

    let startingAngle = a1;
    let angleDifference = slider.length / radius;
    if ((a3 < a2 && a2 < a1) || (a1 < a3 && a3 < a2) || (a2 < a1 && a1 < a3)) { // Point order
        angleDifference *= -1;
    }

    let outputPoints: Point[] = [];
    let segments = Math.ceil(slider.length / CIRCLE_ARC_SEGMENT_LENGTH) || 1;
    let segmentLength = angleDifference / segments;

    for (let i = 0; i < segments + 1; i++) {
        let angle = startingAngle + segmentLength * i;
        
        outputPoints.push({
            x: centerPos.x + Math.cos(angle) * radius,
            y: centerPos.y + Math.sin(angle) * radius
        });
    }

    return outputPoints;
}

function calculateBézierSliderPoints(slider: Slider) {
    let sections = slider.sections;

    if (sections.length === 1 && sections[0].values.length === 2) { // If it's only one linear section
        let points = sections[0].values;

        let angle = Math.atan2(points[1].y - points[0].y, points[1].x - points[0].x);
        let distance = Math.min(slider.length, pointDistance(points[0], points[1]));
        let pointTwo: Point = {
            x: points[0].x + Math.cos(angle) * distance,
            y: points[0].y + Math.sin(angle) * distance
        };

        return [clonePoint(points[0]), pointTwo]; // Clone so we detach from the raw hit object's data
    }

    let samplePoints: Point[] = [];

    for (let i = 0; i < sections.length; i++) {
        let points = sections[i].values;

        if (points.length === 2) { // if segment is linear
            samplePoints.push(points[0], points[1]);
        } else {
            let t = 0;

            while (t < 1) {
                let point = MathUtil.pointOnBézierCurve(points, t);
                let curvature = MathUtil.curvatureOfBézierCurve(points, t, point);

                samplePoints.push(point);

                t += Math.min(0.25, 0.01 / Math.sqrt(curvature * 300)); // Move smaller steps based on curvature
            }
        }

        samplePoints.push(last(points));
    }

    // Now that we've sampled points along the curve, we can start generating mostly equidistant points from them.

    let arcLength = calculateTotalPointArrayArcLength(samplePoints);
    if (arcLength > slider.length) { // If traced length bigger than pixelLength
        arcLength = slider.length;
    }
    
    return calculateEquidistantPointsFromSamplePoints(samplePoints, arcLength);
}

function calculateCatmullSliderPoints(slider: Slider) {
    let points = slider.sections[0].values;
    let samplePoints: Point[] = [];

    // Based on ppy's algorithm used in lazer: https://github.com/ppy/osu-framework/blob/master/osu.Framework/MathUtils/PathApproximator.cs
    for (let i = 0; i < points.length; i++) {
        let v1 = points[i-1] || points[0],
            v2 = points[i],
            v3 = (i < points.length - 1)? points[i+1] : {x: v2.x*2 - v1.x, y: v2.y*2 - v1.y},
            v4 = (i < points.length - 2)? points[i+2] : {x: v3.x*2 - v2.x, y: v3.y*2 - v2.y};

        for (let c = 0; c < CATMULL_ROM_SECTION_SAMPLE_COUNT; c++) {
            samplePoints.push(MathUtil.catmullFindPoint(v1, v2, v3, v4, c / CATMULL_ROM_SECTION_SAMPLE_COUNT));
        }
    }

    samplePoints.push(last(points));

    let arcLength = calculateTotalPointArrayArcLength(samplePoints);
    if (arcLength > slider.length) { // If traced length bigger than pixelLength
        arcLength = slider.length;
    }

    return calculateEquidistantPointsFromSamplePoints(samplePoints, arcLength);
}

function calculateEquidistantPointsFromSamplePoints(samplePoints: Point[], arcLength: number) {
    // Extra point is added because floats
    let lastPoint = last(samplePoints);
    let secondLastPoint = samplePoints[samplePoints.length - 2];
    if (lastPoint && secondLastPoint) {
        let angle = Math.atan2(lastPoint.y - secondLastPoint.y, lastPoint.x - secondLastPoint.x);
        samplePoints.push({
            x: lastPoint.x + 500 * Math.cos(angle),
            y: lastPoint.y + 500 * Math.sin(angle)
        });
    }

    let equidistantPoints: Point[] = [];
    let segmentCount = Math.ceil(arcLength / EQUIDISTANT_POINT_DISTANCE) || 1;
    let segmentLength = arcLength / segmentCount;

    /*  Using the initially traced points, generate a slider path point array in which
        all points are equally distant from one another. This is done to guarantee constant
        slider velocity. */
    let currentPoint = samplePoints[0];
    equidistantPoints.push(clonePoint(currentPoint)); // Clone so we detach from the raw hit object's data
    let currentIndex = 1;
    for (let c = 0; c < segmentCount; c++) {
        let remainingLength = segmentLength;

        while (true) {
            let dist = pointDistance(currentPoint, samplePoints[currentIndex]);

            if (dist < remainingLength) {
                currentPoint = samplePoints[currentIndex];
                remainingLength -= dist;
                currentIndex++;
            } else {
                let percentReached = remainingLength / dist;
                let newPoint: Point = {
                    x: currentPoint.x * (1 - percentReached) + samplePoints[currentIndex].x * percentReached,
                    y: currentPoint.y * (1 - percentReached) + samplePoints[currentIndex].y * percentReached
                };

                equidistantPoints.push(newPoint);
                currentPoint = newPoint;
                break;
            }
        }
    }

    return equidistantPoints;
}