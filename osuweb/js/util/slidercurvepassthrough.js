"use strict";

import {SliderCurve} from "./slidercurve";
import {GraphicUtil} from "./graphicutil";
import {MathUtil} from "./mathutil";
import {SliderCurveBezier} from "./slidercurvebezier";
import {GAME_STATE} from "../main";
import {Console} from "../console";

const MAXIMUM_TRACE_POINT_DISTANCE = 3;

export class SliderCurvePassthrough extends SliderCurve {
    constructor(drawableSlider) {
        super(drawableSlider);
    }

    applyStackPosition() {
        this.centerPos.x -= this.slider.stackHeight * 4;
        this.centerPos.y -= this.slider.stackHeight * 4;
    }

    render(completion) {
        let pixelRatio = GAME_STATE.currentPlay.pixelRatio;
        let centerPos = this.slider.toCtxCoord(this.centerPos);
        let angleDifference = this.angleDifference * completion;

        this.slider.baseCtx.beginPath();
        this.slider.baseCtx.arc(centerPos.x, centerPos.y, this.radius * pixelRatio, this.startingAngle, this.startingAngle + angleDifference, angleDifference < 0);

        this.draw();
    }

    getEndPoint() {
        let angle = this.startingAngle + this.angleDifference;

        return {
            x: this.centerPos.x + this.radius * Math.cos(angle),
            y: this.centerPos.y + this.radius * Math.sin(angle)
        };
    }

    calculateValues(speedCalc) {
        let points = this.sections[0].values;

        // Monstrata plz
        if(JSON.stringify(points[0]) === JSON.stringify(points[2])) { // case one
            Console.warn("Converted P to L-slider due to case one.");
            this.sections[0] = {type: "linear", values: [points[0], points[1]]};
            this.sections[1] = {type: "linear", values: [points[1], points[2]]};

            this.slider.curve = new SliderCurveBezier(this.slider, speedCalc);
            return;
        }

        this.centerPos = MathUtil.circleCenterPos(points[0], points[1], points[2]);

        // Slider seems to have all points on one line. Parsing it as linear slider instead
        if(!isFinite(this.centerPos.x) || !isFinite(this.centerPos.y)) { // case two
            Console.warn("Converted P to L-slider due to case two.");
            // Remove middle point
            this.sections[0].values.splice(1,1);
            this.sections[0].type = "linear";

            this.slider.curve = new SliderCurveBezier(this.slider, speedCalc);
            return;
        }

        this.radius = Math.hypot(this.centerPos.x - points[0].x, this.centerPos.y - points[0].y);
        let a1 = Math.atan2(points[0].y - this.centerPos.y, points[0].x - this.centerPos.x), // angle to start
            a2 = Math.atan2(points[1].y - this.centerPos.y, points[1].x - this.centerPos.x), // angle to control point
            a3 = Math.atan2(points[2].y - this.centerPos.y, points[2].x - this.centerPos.x); // angle to end

        this.startingAngle = a1;
        this.angleDifference = this.slider.hitObject.length / this.radius;
        if ((a3 < a2 && a2 < a1) || (a1 < a3 && a3 < a2) || (a2 < a1 && a1 < a3)) { // Point order
            this.angleDifference *= -1;
        }

        let endAngle = this.startingAngle + this.angleDifference;

        if (!speedCalc) { // Figures out boundaries of the slider
            var pixelRatio = GAME_STATE.currentPlay.pixelRatio;
            var updateBoundaries = (angle) => {
                this.slider.minX = Math.min(this.slider.minX, (this.centerPos.x + this.radius * Math.cos(angle)) * pixelRatio);
                this.slider.maxX = Math.max(this.slider.maxX, (this.centerPos.x + this.radius * Math.cos(angle)) * pixelRatio);
                this.slider.minY = Math.min(this.slider.minY, (this.centerPos.y + this.radius * Math.sin(angle)) * pixelRatio);
                this.slider.maxY = Math.max(this.slider.maxY, (this.centerPos.y + this.radius * Math.sin(angle)) * pixelRatio);
            };

            this.slider.minX = this.slider.maxX = (this.centerPos.x + this.radius * Math.cos(a1)) * pixelRatio;
            this.slider.minY = this.slider.maxY = (this.centerPos.y + this.radius * Math.sin(a1)) * pixelRatio;

            updateBoundaries(endAngle);

            for (let revs = -1.5; revs <= 1.5; revs += 0.25) { // Rotates around in 90° segments
                let angle = revs * Math.PI * 2;
                if ((this.angleDifference > 0) ? (angle > this.startingAngle && angle < endAngle) : (angle > endAngle && angle < this.startingAngle)) {
                    updateBoundaries(angle);
                }
            }
        }
    }
}