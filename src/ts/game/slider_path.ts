import { Point, Vector2, pointDistance } from "../util/point";
import { gameState } from "./game_state";
import { MathUtil } from "../util/math_util";
import { last } from "../util/misc_util";
import { DrawableSlider } from "./drawable_slider";

const SLIDER_BODY_SIZE_REDUCTION_FACTOR = 0.92; // Dis correct?
const SLIDER_CAPCIRCLE_SEGMENTS = 40;
const SLIDER_CAP_CIRCLE_SEGMENT_ARC_LENGTH = Math.PI*2 / SLIDER_CAPCIRCLE_SEGMENTS;

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

export class SliderPath {
    public points: Point[];
    public lineLengths: number[] = [];
    public lineThetas: number[] = [];
    public lineNormals: Vector2[] = [];
    public baseVertexBuffer: Float32Array;
    public lineSegmentVBOIndices: number[] = []; // Basically, to which index (exclusive) in the VBO one needs to draw in order to draw the first _n_ line segments.
    private radius: number;
    private slider: DrawableSlider;

    constructor(points: Point[], slider: DrawableSlider) {
        let { circleRadiusOsuPx } = gameState.currentPlay;

        this.points = points;
        this.slider = slider;
        this.radius = circleRadiusOsuPx * SLIDER_BODY_SIZE_REDUCTION_FACTOR;

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

        let buffer = new Float32Array((this.points.length - 1) * getMaxFloatsPerLineSegment());

        let data: VertexBufferGenerationData = {
            buffer: buffer,
            currentIndex: 0,
            radius: this.radius
        };

        for (let i = 0; i < points.length-1; i++) {
            let p1 = points[i],
                p2 = points[i+1],
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
            radius: this.radius
        };

        let firstP = this.points[0],
            lastP: Point;

        if (completion < 1) {
            // Add an additional line segment.

            let p1Index = Math.floor((this.points.length - 1) * completion)

            let p1 = this.points[p1Index];
            let p2 = this.slider.getPosFromPercentage(completion);

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
}