import { Point, Vector2, pointDistance, pointsAreEqual, clonePoint, calculateTotalPointArrayArcLength, pointAngle, pointNormal, lerpPoints, fitPolylineToLength, stackShiftPoint } from "../util/point";
import { gameState } from "./game_state";
import { MathUtil } from "../util/math_util";
import { last, jsonClone, binarySearchLessOrEqual } from "../util/misc_util";
import { Slider, SliderType, SliderCurveSection } from "../datamodel/slider";

const SLIDER_BODY_SIZE_REDUCTION_FACTOR = 0.92; // Dis correct?
const SLIDER_CAPCIRCLE_SEGMENTS = 48;
const SLIDER_CAP_CIRCLE_SEGMENT_ARC_LENGTH = Math.PI*2 / SLIDER_CAPCIRCLE_SEGMENTS;
const CIRCLE_ARC_SEGMENT_LENGTH = 10; // For P sliders
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

export interface SliderBounds {
    min: Point,
    max: Point
    width: number,
    height: number,
    screenWidth: number,
    screenHeight: number
}

interface PathCalculationResult {
    points: Point[],
    completions: number[],
    length: number
}

export class SliderPath {
    public points: Point[]; // These points do not need to be equidistant.
    public completions: number[]; // The number at every index represents the percentage of how far the point with the same index is along the curve. Using this, fixed-velocity travel along the path is possible.
    public lineLengths: number[] = [];
    public lineThetas: number[] = [];
    public lineNormals: Vector2[] = [];
    public baseVertexBuffer: Float32Array; // The precomputed vertices of the slider body, excluding the beginning and end caps
    public vertexBuffer: Float32Array; // The CURRENT vertex buffer of the slider body (contains ends), is fixed-length
    public currentVertexCount: number = 0; // How many vertices to draw using the current vertex buffer
    public lineSegmentVBOIndices: number[] = []; // Basically, to which index (exclusive) in the VBO one needs to draw in order to draw the first _n_ line segments.
    private lineRadius: number;

    constructor(points: Point[], completions: number[]) {
        this.points = points;
        this.completions = completions;
    }

    /** Generates utility information for the path. Has to be called before any vertices are created! */
    generatePointData() {
        for (let i = 0; i < this.points.length-1; i++) {
            let p1 = this.points[i],
                p2 = this.points[i+1];

            let length = pointDistance(p1, p2);
            let theta = pointAngle(p1, p2);
            let normal = pointNormal(p1, p2, length);
            
            this.lineLengths.push(length);
            this.lineThetas.push(theta);
            this.lineNormals.push(normal);
        }
    }

    static fromSlider(slider: Slider) {
        let sections = slider.sections;
        let result: PathCalculationResult;

        if (sections.length === 0 || slider.length < 0) {
            // Empty slider! These wackers exist in, like, Aspire maps.
            result = {
                points: [{x: slider.x, y: slider.y}], // Path only consists of the start point.
                completions: [0.0],
                length: 0
            };
        } else {
            let { type, sections, length } = slider;

            // NOTE: A slider with length 0 will automatically figure out its length based on its control points. You'll see extra logic to handle that case in the methods this method calls.

            if (type === SliderType.Perfect && sections[0].values.length === 3) result = SliderPath.calculatePerfectSliderPoints(sections, length);
            else if (sections.length === 1 && sections[0].values.length === 2) result = SliderPath.calculateLinearSliderPoints(sections, length); // The reason we check this condition and not just "L", is because for some bizarre reason, some sliders are marked as "L" but have more than two control points. Those "special-case" "linear" sliders will then have to be treated like linear instead.
            else if (type === SliderType.Bézier) result = SliderPath.calculateBézierSliderPoints(sections, length);
            else if (type === SliderType.Catmull) result = SliderPath.calculateCatmullSliderPoints(sections, length);
            else result = SliderPath.calculateBézierSliderPoints(sections, length); // Just default to Bézier
        }

        return {
            path: new SliderPath(result.points, result.completions),
            length: result.length
        };
    }

    getPosFromPercentage(percentage: number) {
        // We need to make sure we return a new instance of Point here, because whatever this function returns might be manipulated. We don't want that to change the path!

        if (this.points.length <= 1) return clonePoint(this.points[0]) || null;

        let p1Index = binarySearchLessOrEqual(this.completions, percentage);
        let p1Completion = this.completions[p1Index];

        if (p1Completion === percentage) return clonePoint(this.points[p1Index]);

        let p1 = this.points[p1Index],
            p2 = this.points[p1Index+1],
            p2Completion = this.completions[p1Index+1];
        let t = (percentage - p1Completion) / (p2Completion - p1Completion);

        return lerpPoints(p1, p2, t);
    }

    getAngleFromPercentage(percentage: number) {
        if (this.points.length <= 1) return 0;

        let index = binarySearchLessOrEqual(this.completions, percentage);
        if (index === this.points.length - 1) index--;
        return this.lineThetas[index];
    }

    applyStackPosition(stackHeight: number) {
        for (let i = 0; i < this.points.length; i++) {
            let point = this.points[i];
            stackShiftPoint(point, stackHeight);
        }
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

        let maximumLength = sliced.length + (3 * 3 * SLIDER_CAPCIRCLE_SEGMENTS/2 * 2 /* 3 floats per vertex, 3 vertices per triangle, ..., and 2 caps in total */);
        this.vertexBuffer = new Float32Array(maximumLength); // All zeroes at this point
    }

    updateVertexBuffer(completion: number, createSliderBoundsObject = false) {
        let p1Index = binarySearchLessOrEqual(this.completions, completion);
        let vboIndex = this.lineSegmentVBOIndices[p1Index - 1] || 0;

        this.vertexBuffer.set(this.baseVertexBuffer.slice(0, vboIndex));

        let data: VertexBufferGenerationData = {
            buffer: this.vertexBuffer,
            currentIndex: vboIndex,
            radius: this.lineRadius
        };
        
        let firstP = this.getPosFromPercentage(0.0),
            lastP: Point,
            firstTheta = this.getAngleFromPercentage(0.0),
            lastTheta: number;

        let includedPoints: Point[] = null;
        if (createSliderBoundsObject) {
            includedPoints = [];

            for (let i = 0; i <= p1Index; i++) {
                includedPoints.push(this.points[i]);
            }
        }

        outer: if (completion < 1) {
            // Add an additional line segment.

            let p1 = this.points[p1Index];
            let p2 = this.getPosFromPercentage(completion);

            if (pointsAreEqual(p1, p2)) break outer;

            let length = pointDistance(p1, p2);
            let theta = this.getAngleFromPercentage(completion);
            let normal = pointNormal(p1, p2, length);
            let prevTheta = this.lineThetas[p1Index - 1],
                prevNormal = this.lineNormals[p1Index - 1];

            SliderPath.addVerticesForLineSegment(data, p1, p2, theta, normal, prevTheta, prevNormal);
            if (createSliderBoundsObject) includedPoints.push(p2);

            lastP = p2;
            lastTheta = theta;
        }

        if (!lastP) lastP = this.getPosFromPercentage(1.0);
        if (!lastTheta) lastTheta = this.getAngleFromPercentage(1.0);

        SliderPath.addLineCap(data, firstP.x, firstP.y, firstTheta + Math.PI/2, Math.PI); // Draw a semicircle
        SliderPath.addLineCap(data, lastP.x, lastP.y, lastTheta - Math.PI/2, Math.PI);

        this.currentVertexCount = data.currentIndex / 3; // The amount of vertices that need to be drawn

        return includedPoints && SliderPath.calculateBounds(includedPoints);
    }

    generateGeometry(completion: number) {
        let geometry = new PIXI.Geometry();
        geometry.addAttribute(
            'vertPosition',
            new PIXI.Buffer(this.vertexBuffer),
            3,
            false,
            PIXI.TYPES.FLOAT,
            3 * Float32Array.BYTES_PER_ELEMENT,
            0
        );

        this.updateGeometry(geometry, completion);
        return geometry;
    }

    updateGeometry(geometry: PIXI.Geometry, completion: number, createSliderBoundsObject = false) {
        let sliderBounds = this.updateVertexBuffer(completion, createSliderBoundsObject);
        let pixiBuffer = geometry.getBuffer('vertPosition');
        pixiBuffer.update();

        return sliderBounds;
    }

    calculateBounds() {
        return SliderPath.calculateBounds(this.points);
    }

    static calculateBounds(points: Point[]) {
        let { hitObjectPixelRatio, circleDiameterOsuPx } = gameState.currentPlay;

        let firstPoint = points[0];

        let bounds = {
            min: clonePoint(firstPoint),
            max: clonePoint(firstPoint)
        } as SliderBounds;

        for (let i = 1; i < points.length; i++) {
            let point = points[i];

            if (point.x < bounds.min.x) bounds.min.x = point.x;
            if (point.x > bounds.max.x) bounds.max.x = point.x;
            if (point.y < bounds.min.y) bounds.min.y = point.y;
            if (point.y > bounds.max.y) bounds.max.y = point.y;
        }
        
        bounds.width = bounds.max.x - bounds.min.x + circleDiameterOsuPx;
        bounds.height = bounds.max.y - bounds.min.y + circleDiameterOsuPx;
        bounds.screenWidth = bounds.width * hitObjectPixelRatio;
        bounds.screenHeight = bounds.height * hitObjectPixelRatio;

        return bounds;
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

    private static calculatePerfectSliderPoints(sections: SliderCurveSection[], length: number): PathCalculationResult {
        let points = sections[0].values;
    
        // Monstrata plz
        if (pointsAreEqual(points[0], points[2])) { // case one
            sections = jsonClone(sections); // Since we're modifying the sections here, we have to decouple them from the raw hit object.
    
            sections[0] = {values: [points[0], points[1]]};
            sections[1] = {values: [points[1], points[2]]};

            return SliderPath.calculateBézierSliderPoints(sections, length);
        }
    
        let centerPos = MathUtil.circleCenterPos(points[0], points[1], points[2]);
    
        // Slider seems to have all points on one line. Parsing it as linear slider instead
        if (!isFinite(centerPos.x) || !isFinite(centerPos.y)) { // case two
            sections = jsonClone(sections);
        
            // Remove middle point
            sections[0].values.splice(1, 1);

            return SliderPath.calculateLinearSliderPoints(sections, length);
        }
    
        let radius = pointDistance(centerPos, points[0]);
        let a1 = pointAngle(centerPos, points[0]), // angle to start
            a2 = pointAngle(centerPos, points[1]), // angle to control point
            a3 = pointAngle(centerPos, points[2]); // angle to end

        let counterClockwise = (a3 < a2 && a2 < a1) || (a1 < a3 && a3 < a2) || (a2 < a1 && a1 < a3);
        
        let fullAngleDifference = MathUtil.getNormalizedAngleDelta(a1, a3);
        if (fullAngleDifference < 0 && !counterClockwise) fullAngleDifference = Math.PI*2 + fullAngleDifference;
        if (fullAngleDifference > 0 && counterClockwise) fullAngleDifference = -Math.PI*2 + fullAngleDifference;

        let calculatedLength = Math.abs(fullAngleDifference) * radius;
        let hasToBeExtended = length > calculatedLength;

        // Jesus, this is horrible nomenclature! Also, I'm a quality programmer for just calling my nomenclature bad instead of improving on it. WELP, at least I self-reflected.
        let pathLength = (length === 0)? calculatedLength : length;
        let arcLength = Math.min(calculatedLength, pathLength);
    
        let startingAngle = a1;
        let angleDifference = arcLength / radius;
        if (counterClockwise) angleDifference *= -1;
    
        let outputPoints: Point[] = [];
        let segments = Math.ceil(arcLength / CIRCLE_ARC_SEGMENT_LENGTH) || 1;
        let segmentLength = angleDifference / segments;
    
        for (let i = 0; i < segments + 1; i++) {
            let angle = startingAngle + segmentLength * i;
            
            outputPoints.push({
                x: centerPos.x + Math.cos(angle) * radius,
                y: centerPos.y + Math.sin(angle) * radius
            });
        }

        if (!hasToBeExtended) {
            let completions = [];
            for (let i = 0; i < segments + 1; i++) {
                completions.push(i / segments);
            }

            return {
                points: outputPoints,
                completions: completions,
                length: pathLength
            };
        }

        let linearSegmentAngle = startingAngle + angleDifference + ((angleDifference < 0)? -Math.PI/2 : Math.PI/2);
        let additionalPoint: Point = {
            x: last(outputPoints).x + Math.cos(linearSegmentAngle),
            y: last(outputPoints).y + Math.sin(linearSegmentAngle)
        };

        outputPoints.push(additionalPoint);

        // TODO: Since length includes the full distance along the arc, but when this method travels along the circle trace points, it'll only count the sum of the chord lengths (https://en.wikipedia.org/wiki/Chord_(geometry)), is it necessary to subtract the length we're missing?
        let pathCompletions = fitPolylineToLength(outputPoints, length);

        return {
            points: outputPoints,
            completions: pathCompletions,
            length: pathLength
        };
    }

    private static calculateLinearSliderPoints(sections: SliderCurveSection[], length: number): PathCalculationResult {
        let points = sections[0].values;
    
        let angle = pointAngle(points[0], points[1]);
        let distance = (length === 0)? pointDistance(points[0], points[1]) : length;

        let pointTwo: Point = {
            x: points[0].x + Math.cos(angle) * distance,
            y: points[0].y + Math.sin(angle) * distance
        };

        let pointOne = clonePoint(points[0]) // Clone so we detach from the raw hit object's data

        return {
            points: [pointOne, pointTwo],
            completions: [0.0, 1.0],
            length: distance
        };
    }

    private static calculateBézierSliderPoints(sections: SliderCurveSection[], length: number): PathCalculationResult {
        let samplePoints: Point[] = [];

        samplePoints.push(sections[0].values[0]); // Add the first point of the first segment
    
        for (let i = 0; i < sections.length; i++) {
            let points = sections[i].values;
    
            if (points.length === 2) { // If segment is linear
                // We don't need to do anything here, because the last segment's last point as already been pushed, which is this segment's first point. Since we'll push this segment's last point later in this function, we also needn't push that here.
            } else {
                let t = 0,
                    lastPoint = last(samplePoints);
    
                while (true) {
                    let curvature = MathUtil.curvatureOfBézierCurve(points, t, lastPoint);
                    let increment = Math.min(0.2, 0.01 / Math.sqrt(curvature * 300)); // Move smaller steps based on curvature. Min 0.02 guarantees we sample each curve at least 50 times.
                    t += increment;
                    if (t >= 1) break;
    
                    lastPoint = MathUtil.pointOnBézierCurve(points, t);
                    samplePoints.push(lastPoint);
                }
            }

            samplePoints.push(last(points));
        }
    
        let arcLength = (length === 0)? calculateTotalPointArrayArcLength(samplePoints) : length;
        let pathCompletions = fitPolylineToLength(samplePoints, arcLength);

        return {
            points: samplePoints,
            completions: pathCompletions,
            length: arcLength
        };
    }
    
    private static calculateCatmullSliderPoints(sections: SliderCurveSection[], length: number): PathCalculationResult {
        let points = sections[0].values;
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
    
        let arcLength = (length === 0)? calculateTotalPointArrayArcLength(samplePoints) : length;
        let pathCompletions = fitPolylineToLength(samplePoints, arcLength);

        return {
            points: samplePoints,
            completions: pathCompletions,
            length: arcLength
        };
    }
}