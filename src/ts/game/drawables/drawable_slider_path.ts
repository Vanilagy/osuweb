import { SliderPath, SLIDER_CAPCIRCLE_SEGMENTS } from "../../datamodel/slider_path";
import { Point, pointsAreEqual, pointDistance, pointNormal, clonePoint, Vector2 } from "../../util/point";
import { TAU, MathUtil } from "../../util/math_util";
import { binarySearchLessOrEqual } from "../../util/misc_util";
import { DrawableSlider } from "./drawable_slider";

const SLIDER_BODY_SIZE_REDUCTION_FACTOR = 0.92; // Dis correct?
const SLIDER_CAP_CIRCLE_SEGMENT_ARC_LENGTH = TAU / SLIDER_CAPCIRCLE_SEGMENTS;

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

export class SliderBounds {
	public min: Point;
	public max: Point;
	public width: number;
	public height: number;
	public screenWidth: number = null;
	public screenHeight: number = null;

	constructor(min: Point, max: Point, width: number, height: number) {
		this.min = min;
		this.max = max;
		this.width = width;
		this.height = height;
	}

	updateScreenDimensions(factor: number) {
		this.screenWidth = this.width * factor;
		this.screenHeight = this.height * factor;
	}
}

export class DrawableSliderPath extends SliderPath {
	public drawableSlider: DrawableSlider;
	public baseVertexBuffer: Float32Array; // The precomputed vertices of the slider body, excluding the beginning and end caps
	public vertexBuffer: Float32Array; // The CURRENT vertex buffer of the slider body (contains ends), is fixed-length
	public currentVertexCount: number = 0; // How many vertices to draw using the current vertex buffer
	public lineSegmentVBOIndices: number[] = []; // Basically, to which index (exclusive) in the VBO one needs to draw in order to draw the first _n_ line segments.
	private lineRadius: number;

	public constructor(points: Point[], completions: number[], drawableSlider: DrawableSlider) {
		super(points, completions);
		this.drawableSlider = drawableSlider;
	}
	
	static fromSliderPath(sliderPath: SliderPath, drawableSlider: DrawableSlider) {
		return new DrawableSliderPath(sliderPath.points, sliderPath.completions, drawableSlider);
	}

	generateBaseVertexBuffer() {
		let { circleRadiusOsuPx } = this.drawableSlider.drawableBeatmap.play;

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

			DrawableSliderPath.addVerticesForLineSegment(data, p1, p2, theta, normal, prevTheta, prevNormal);

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

				DrawableSliderPath.addVerticesForLineSegment(data, p1, p2, theta, normal, prevTheta, prevNormal);
			if (createSliderBoundsObject) includedPoints.push(p2);

			lastP = p2;
			lastTheta = theta;
		}

		if (!lastP) lastP = this.getPosFromPercentage(1.0);
		if (!lastTheta) lastTheta = this.getAngleFromPercentage(1.0);

		DrawableSliderPath.addLineCap(data, firstP.x, firstP.y, firstTheta + Math.PI/2, Math.PI); // Draw a semicircle
		DrawableSliderPath.addLineCap(data, lastP.x, lastP.y, lastTheta - Math.PI/2, Math.PI);

		this.currentVertexCount = data.currentIndex / 3; // The amount of vertices that need to be drawn

		return includedPoints && DrawableSliderPath.calculateBounds(includedPoints, this.drawableSlider);
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
		return DrawableSliderPath.calculateBounds(this.points, this.drawableSlider);
	}

	static calculateBounds(points: Point[], drawableSlider: DrawableSlider) {
		let { circleDiameterOsuPx, hitObjectPixelRatio } = drawableSlider.drawableBeatmap.play;

		let firstPoint = points[0];

		let min = clonePoint(firstPoint),
			max = clonePoint(firstPoint),
			width: number,
			height: number;

		for (let i = 1; i < points.length; i++) {
			let point = points[i];

			if (point.x < min.x) min.x = point.x;
			if (point.x > max.x) max.x = point.x;
			if (point.y < min.y) min.y = point.y;
			if (point.y > max.y) max.y = point.y;
		}
		
		width = max.x - min.x + circleDiameterOsuPx;
		height = max.y - min.y + circleDiameterOsuPx;

		let bounds = new SliderBounds(min, max, width, height);
		bounds.updateScreenDimensions(hitObjectPixelRatio);

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

		DrawableSliderPath.addVertex(data, bottomMiddle.x, bottomMiddle.y, 0.0);
		DrawableSliderPath.addVertex(data, bottomLeftX, bottomLeftY, 1.0);
		DrawableSliderPath.addVertex(data, topLeftX, topLeftY, 1.0);

		DrawableSliderPath.addVertex(data, bottomMiddle.x, bottomMiddle.y, 0.0);
		DrawableSliderPath.addVertex(data, topMiddle.x, topMiddle.y, 0.0);
		DrawableSliderPath.addVertex(data, topLeftX, topLeftY, 1.0);

		DrawableSliderPath.addVertex(data, bottomMiddle.x, bottomMiddle.y, 0.0);
		DrawableSliderPath.addVertex(data, bottomRightX, bottomRightY, 1.0);
		DrawableSliderPath.addVertex(data, topRightX, topRightY, 1.0);

		DrawableSliderPath.addVertex(data, bottomMiddle.x, bottomMiddle.y, 0.0);
		DrawableSliderPath.addVertex(data, topMiddle.x, topMiddle.y, 0.0);
		DrawableSliderPath.addVertex(data, topRightX, topRightY, 1.0);

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

				DrawableSliderPath.addVertex(data, p1.x, p1.y, 0.0);
				DrawableSliderPath.addVertex(data, v2x, v2y, 1.0);
				DrawableSliderPath.addVertex(data, v3x, v3y, 1.0);
			} else {
				let startingAngle = (td > 0)? prevTheta - Math.PI/2 : prevTheta + Math.PI/2;
				DrawableSliderPath.addLineCap(data, p1.x, p1.y, startingAngle, td);
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

			DrawableSliderPath.addVertex(data, x, y, 0.0);
			DrawableSliderPath.addVertex(data, p2x, p2y, 1.0);
			DrawableSliderPath.addVertex(data, p3x, p3y, 1.0);

			p2x = p3x;
			p2y = p3y;
		}
	}
}