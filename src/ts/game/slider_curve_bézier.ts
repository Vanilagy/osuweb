//import {GraphicUtil} from "./graphicutil";

import { SliderCurve } from "./slider_curve";
import { MathUtil } from "../util/math_util";
//import {SLIDER_SETTINGS} from "../game/drawableslider";
//import {Console} from "../console";
import { DrawableSlider } from "./drawable_slider";
import { Point, pointAngle } from "../util/point";
import { gameState } from "./game_state";
import { SLIDER_SETTINGS } from "../util/constants";
import { last } from "../util/misc_util";

const MAXIMUM_TRACE_POINT_DISTANCE = 3;

export class SliderCurveBézier extends SliderCurve {
    public tracePoints: Point[];
    public equalDistancePoints: Point[];

    constructor(drawableSlider: DrawableSlider, speedCalc: boolean) {
        super(drawableSlider); 
        this.equalDistancePoints = [];
        this.tracePoints = [];

        if (!speedCalc) {
            this.slider.minX = this.slider.maxX = this.sections[0].values[0].x;
            this.slider.minY = this.slider.maxY = this.sections[0].values[0].y;

            if (this.sections.length === 1 && this.sections[0].values.length === 2) { // If it's only one linear section
                let points = this.sections[0].values;

                let angle = Math.atan2(points[1].y - points[0].y, points[1].x - points[0].x);
                let distance = Math.min(this.slider.hitObject.length, Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y));
                let pointTwo: Point = {
                    x: points[0].x + Math.cos(angle) * distance,
                    y: points[0].y + Math.sin(angle) * distance
                };

                this.pushEqualDistancePoint(points[0]);
                this.pushEqualDistancePoint(pointTwo);

                return;
            }
        }

        this.calculateTracePoints(speedCalc);
        if (!speedCalc) this.calculateEqualDistancePoints();
    }

    render(completion: number) {
        let actualIndex = completion * (this.equalDistancePoints.length - 1);
        let targetIndex = Math.floor(actualIndex);

        // Path generation
        this.slider.baseCtx.beginPath();

        let startPoint = this.slider.toCtxCoord(this.equalDistancePoints[0]);
        this.slider.baseCtx.moveTo(startPoint.x, startPoint.y);
        for (let i = 1; i < targetIndex + 1; i++) {
            let point = this.equalDistancePoints[i];

            point = this.slider.toCtxCoord(point);
            this.slider.baseCtx.lineTo(point.x, point.y);

            if (SLIDER_SETTINGS.debugDrawing) {
                this.slider.baseCtx.beginPath();
                this.slider.baseCtx.arc(point.x, point.y, 1, 0, Math.PI * 2);
                this.slider.baseCtx.fillStyle = "white";
                this.slider.baseCtx.fill();
            }
        }

        if (completion !== 1) {
            let snakingEndPoint = this.slider.toCtxCoord(this.slider.getPosFromPercentage(completion) as Point);
            this.slider.baseCtx.lineTo(snakingEndPoint.x, snakingEndPoint.y);
        }

        this.draw();
    }

    getEndPoint(): Point {
        if (this.curveLength <= this.slider.hitObject.length) {
            return last(this.tracePoints); // Just get the last point
        } else { // If it's longer, backtrack from ze end
            // TODO: Wtf is this?

            let lengthDifference = this.curveLength - this.slider.hitObject.length;
            let distanceTraveled = 0;
            let lastPoint = last(this.tracePoints);

            for (let i = this.tracePoints.length - 2; i >= 0; i--) {
                let currentPoint = this.tracePoints[i];
                let dist = Math.hypot(currentPoint.x - lastPoint.x, currentPoint.y - lastPoint.y);

                if (lengthDifference - distanceTraveled <= dist) {
                    let percentReached = (lengthDifference - distanceTraveled) / dist;

                    return {
                        x: lastPoint.x * (1 - percentReached) + currentPoint.x * percentReached,
                        y: lastPoint.y * (1 - percentReached) + currentPoint.y * percentReached
                    };
                } else {
                    distanceTraveled += dist;
                    lastPoint = currentPoint;
                }
            }
        }
    }

    getAngleFromPercentage(percent: number) {
        let index = Math.floor(percent * (this.equalDistancePoints.length - 1));
        if (index === (this.equalDistancePoints.length - 1)) index--;

        let p1 = this.equalDistancePoints[index];
        let p2 = this.equalDistancePoints[index + 1];

        return pointAngle(p1, p2);
    }

    calculateTracePoints(speedCalc: boolean) {
        for (let i = 0; i < this.sections.length; i++) {
            let points = this.sections[i].values;

            if (points.length === 2) { // if segment is linear
                this.pushTracePoint(points[0]);
                this.pushTracePoint(points[1]);
            } else {
                let t = 0;

                while (t < 1) {
                    let point = MathUtil.pointOnBézierCurve(points, t);
                    let curvature = MathUtil.curvatureOfBézierCurve(points, t, point);

                    this.pushTracePoint(point);

                    t += Math.min(0.25, 0.01 / Math.sqrt(curvature * 300)); // Move smaller steps based on curvature
                }
            }

            this.pushTracePoint(last(points));
        }

        if (!speedCalc) {
            if (this.curveLength > this.slider.hitObject.length) { // If traced length bigger than pixelLength
                this.curveLength = this.slider.hitObject.length;
            }

            // Extra point is added because floats
            let lastPoint = last(this.tracePoints);
            let secondLastPoint = this.tracePoints[this.tracePoints.length - 2];
            if (lastPoint && secondLastPoint) {
                let angle = Math.atan2(lastPoint.y - secondLastPoint.y, lastPoint.x - secondLastPoint.x);
                this.tracePoints.push({
                    x: lastPoint.x + 500 * Math.cos(angle),
                    y: lastPoint.y + 500 * Math.sin(angle)
                });
            }
        }
    }

    calculateEqualDistancePoints() {
        let segmentCount = Math.floor(this.curveLength / MAXIMUM_TRACE_POINT_DISTANCE + 1); // Math.floor + 1 is basically like .ceil, but we can't get 0 here
        let segmentLength = this.curveLength / segmentCount;

        /* Using the initially traced points, generate a slider path point array in which
         all points are equally distant from one another. This is done to guarantee constant
         slider velocity. */
        let lastPoint = this.tracePoints[0];
        this.pushEqualDistancePoint(lastPoint);
        let currentIndex = 1;
        for (let c = 0; c < segmentCount; c++) {
            let remainingLength = segmentLength;

            while (true) {
                let dist = Math.hypot(lastPoint.x - this.tracePoints[currentIndex].x, lastPoint.y - this.tracePoints[currentIndex].y);

                if (dist < remainingLength) {
                    lastPoint = this.tracePoints[currentIndex];
                    remainingLength -= dist;
                    currentIndex++;
                } else {
                    let percentReached = remainingLength / dist;
                    let newPoint: Point = {
                        x: lastPoint.x * (1 - percentReached) + this.tracePoints[currentIndex].x * percentReached,
                        y: lastPoint.y * (1 - percentReached) + this.tracePoints[currentIndex].y * percentReached
                    };

                    this.pushEqualDistancePoint(newPoint);
                    lastPoint = newPoint;
                    break;
                }
            }
        }
    }

    pushTracePoint(pos: Point) { // Adding points and keeping track of the distance passed
        if (this.tracePoints.length > 0) {
            let thatPoint = last(this.tracePoints);
            this.curveLength += Math.hypot(thatPoint.x - pos.x, thatPoint.y - pos.y);
        }

        //if (isLinearEndPoint) {
        //    pos.isLinearEndPoint = true;
        //}

        this.tracePoints.push(pos);
    }

    pushEqualDistancePoint(pos: Point) { // Pushes endpoint to array
        this.equalDistancePoints.push(pos);

        this.slider.minX = Math.min(this.slider.minX, pos.x);
        this.slider.minY = Math.min(this.slider.minY, pos.y);
        this.slider.maxX = Math.max(this.slider.maxX, pos.x);
        this.slider.maxY = Math.max(this.slider.maxY, pos.y);
    }

    applyStackPosition() {
        let stackHeight = this.slider.stackHeight;

        for (let point of this.equalDistancePoints) {
            point.x += stackHeight * -4;
            point.y += stackHeight * -4;
        }
    }
}