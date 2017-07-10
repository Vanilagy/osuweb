"use strict";

import {SliderCurve} from "./slidercurve";
import {GraphicUtil} from "./graphicutil";
import {MathUtil} from "./mathutil";
import {SliderCurveBezier} from "./slidercurvebezier";

const MAXIMUM_TRACE_POINT_DISTANCE = 3;

export class SliderCurvePassthrough extends SliderCurve {
    constructor(drawableSlider) {
        super(drawableSlider);

        this.calculateEqualDistancePoints();
    }

    calculateEqualDistancePoints() {
        let points = this.sections[0].values;

        // Monstrata plz
        if(JSON.stringify(points[0]) === JSON.stringify(points[2])) {
            this.sections[0] = {type: "linear", values: [points[0], points[1]]};
            this.sections[1] = {type: "linear", values: [points[1], points[2]]};

            let curve = new SliderCurveBezier(this.slider);

            curve.calculateEqualDistancePoints();

            this.equalDistancePoints = curve.equalDistancePoints;

            return;
        }

        let centerPos = MathUtil.circleCenterPos(points[0], points[1], points[2]);

        // Slider seems to have all points on one line. Parsing it as linear slider instead
        if(!isFinite(centerPos.x) || !isFinite(centerPos.y)) {
            // Remove middle point
            this.sections[0].values.splice(1,1);
            this.sections[0].type = "linear";

            let curve = new SliderCurveBezier(this.slider);

            curve.calculateEqualDistancePoints();

            this.equalDistancePoints = curve.equalDistancePoints;

            return;
        }

        let radius = Math.hypot(centerPos.x - points[0].x, centerPos.y - points[0].y);
        let a1 = Math.atan2(points[0].y - centerPos.y, points[0].x - centerPos.x), // angle to start
            a2 = Math.atan2(points[1].y - centerPos.y, points[1].x - centerPos.x), // angle to control point
            a3 = Math.atan2(points[2].y - centerPos.y, points[2].x - centerPos.x); // angle to end

        let segmentCount = Math.floor(this.slider.hitObject.length / MAXIMUM_TRACE_POINT_DISTANCE + 1); // Math.floor + 1 is basically like .ceil, but we can't get 0 here
        let segmentLength = this.slider.hitObject.length / segmentCount;
        let incre = segmentLength / radius;

        if (a1 < a2 && a2 < a3) { // Point order

        } else if ((a2 < a3 && a3 < a1) || (a3 < a1 && a1 < a2)) {

        } else if (a3 < a1 && a1 < a2) {

        } else if (a3 < a2 && a2 < a1) {
            incre *= -1;
        } else {
            incre *= -1;
        }

        this.slider.minX = this.slider.maxX = (centerPos.x + radius * Math.cos(a1)) * GraphicUtil.getPixelRatio();
        this.slider.minY = this.slider.maxY = (centerPos.y + radius * Math.sin(a1)) * GraphicUtil.getPixelRatio();

        let angle = a1;
        for (let i = 0; i <= segmentCount; i++) {
            this.pushEqualDistancePoint({
                x: centerPos.x + radius * Math.cos(angle),
                y: centerPos.y + radius * Math.sin(angle)
            });

            angle += incre;
        }
    }
}