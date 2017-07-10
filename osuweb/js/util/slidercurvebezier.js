"use strict";

import {GraphicUtil} from "./graphicutil";
import {SliderCurve} from "./slidercurve";
import {MathUtil} from "./mathutil";

const MAXIMUM_TRACE_POINT_DISTANCE = 3;

export class SliderCurveBezier extends SliderCurve {
    constructor(drawableSlider) {
        super(drawableSlider);

        this.tracePoints = [];

        this.slider.minX = this.slider.maxX = this.sections[0].values[0].x * GraphicUtil.getPixelRatio();
        this.slider.minY = this.slider.maxY = this.sections[0].values[0].y * GraphicUtil.getPixelRatio();

        if (this.sections.length === 1 && this.sections[0].values.length === 2) { // If it's only one linear sections b-o-i-s
            this.pushEqualDistancePoint(this.sections[0].values[0]);
            this.pushEqualDistancePoint(this.sections[0].values[1]);

            console.log(this.equalDistancePoints);

            return;
        }

        this.calculateTracePoints();
        this.calculateEqualDistancePoints();
    }

    calculateTracePoints() {


        for (let i = 0; i < this.sections.length; i++) {
            let points = this.sections[i].values;

            if (points.length === 2) { // if linear
                this.pushTracePoint(points[0]);
                this.pushTracePoint(points[1]);
            } else {
                let leftT = 0, rightT = 0.01;
                let p1 = MathUtil.coordsOnBezier(points, leftT);
                let p2 = MathUtil.coordsOnBezier(points, rightT);
                this.pushTracePoint(p1);

                while (leftT < 1) { // Binary segment approximation method
                    while (true) {
                        let dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);

                        if (dist < MAXIMUM_TRACE_POINT_DISTANCE) {
                            leftT += 0.01;
                            rightT += 0.01;

                            if (leftT >= 1) {
                                break;
                            }

                            p2 = MathUtil.coordsOnBezier(points, rightT);
                        } else {
                            let p3, midT;

                            while (true) {
                                midT = (leftT + rightT) / 2;
                                p3 = MathUtil.coordsOnBezier(points, midT);
                                dist = Math.hypot(p3.x - p1.x, p3.y - p1.y);

                                if (Math.abs(MAXIMUM_TRACE_POINT_DISTANCE - dist) < 0.25) {
                                    break;
                                }

                                if (dist < MAXIMUM_TRACE_POINT_DISTANCE) {
                                    leftT = midT;
                                } else {
                                    rightT = midT;
                                }
                            }

                            if (midT < 1) {
                                this.pushTracePoint(p3);
                                p1 = p3;
                            }

                            leftT = midT;
                            rightT = leftT + 0.01;
                            p2 = MathUtil.coordsOnBezier(points, rightT);

                            break;
                        }
                    }
                }
            }

            this.pushTracePoint(points[points.length - 1]);
        }

        if (this.curveLength > this.slider.hitObject.length) { // If traced length bigger than pixelLength
            this.curveLength = this.slider.hitObject.length;
        }

        // Extra point is added because floats
        let lastPoint = this.tracePoints[this.tracePoints.length - 1];
        let secondLastPoint = this.tracePoints[this.tracePoints.length - 2];
        if (lastPoint && secondLastPoint) {
            let angle = Math.atan2(lastPoint.y - secondLastPoint.y, lastPoint.x - secondLastPoint.x);
            this.tracePoints.push({
                x: lastPoint.x + 500 * Math.cos(angle),
                y: lastPoint.y + 500 * Math.sin(angle)
            });
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
                    let newPoint = {
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

    pushTracePoint(pos) { // Adding points and keeping track of the distance passed
        if (this.tracePoints[this.tracePoints.length - 1]) {
            let thatPoint = this.tracePoints[this.tracePoints.length - 1];
            this.curveLength += Math.hypot(thatPoint.x - pos.x, thatPoint.y - pos.y);
        }

        this.tracePoints.push(pos);
    }
}