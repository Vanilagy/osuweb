import { SliderCurve } from "./slider_curve";
//import {GraphicUtil} from "./graphicutil";
import { MathUtil } from "../util/math_util";
import { SliderCurveBézier } from "./slider_curve_bézier";
import { DrawableSlider } from "./drawable_slider";
import { Point, pointsAreEqual } from "../util/point";
import { gameState } from "./game_state";
import { jsonClone } from "../util/misc_util";
import { SliderCurveSection } from "../datamodel/slider";
import { SliderPath } from "./slider_path";
//import {Console} from "../console";

const CIRCLE_SEGMENTS = 64;
const RADIANS_PER_CIRCLE_SEGMENT = Math.PI*2 / CIRCLE_SEGMENTS;

export class SliderCurvePerfect extends SliderCurve {
    public centerPos: Point = {x: 0, y: 0};
    public angleDifference: number = 0;
    public radius: number = 0;
    public startingAngle: number = 0;  

    private constructor(drawableSlider: DrawableSlider, sections: SliderCurveSection[], speedCalc: boolean, centerPos?: Point) {
        super(drawableSlider, sections);

        // Incase center pos has already been computed, so let's pass it over:
        this.calculateValues(speedCalc, centerPos);
    }

    getEndPoint(): Point {
        let angle = this.startingAngle + this.angleDifference;

        return {
            x: this.centerPos.x + this.radius * Math.cos(angle),
            y: this.centerPos.y + this.radius * Math.sin(angle)
        };
    }

    getAngleFromPercentage(percent: number) {
        let angle = MathUtil.lerp(this.startingAngle, this.startingAngle + this.angleDifference, percent);

        if (this.angleDifference > 0) {
            angle += Math.PI/2; // Rotate 90° clockwise
        } else {
            angle -= Math.PI/2; // Rotate 90° counter-clockwise
        }

        return MathUtil.constrainRadians(angle);
    }

    calculateValues(speedCalc: boolean, centerPos?: Point) {
        let points = this.sections[0].values;
        this.centerPos = centerPos || MathUtil.circleCenterPos(points[0], points[1], points[2]);

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
            var updateBoundaries = (angle: number) => {
                this.slider.minX = Math.min(this.slider.minX, (this.centerPos.x + this.radius * Math.cos(angle)));
                this.slider.maxX = Math.max(this.slider.maxX, (this.centerPos.x + this.radius * Math.cos(angle)));
                this.slider.minY = Math.min(this.slider.minY, (this.centerPos.y + this.radius * Math.sin(angle)));
                this.slider.maxY = Math.max(this.slider.maxY, (this.centerPos.y + this.radius * Math.sin(angle)));
            };

            this.slider.minX = this.slider.maxX = (this.centerPos.x + this.radius * Math.cos(a1));
            this.slider.minY = this.slider.maxY = (this.centerPos.y + this.radius * Math.sin(a1));

            updateBoundaries(endAngle);

            for (let revs = -1.5; revs <= 1.5; revs += 0.25) { // Rotates around in 90° segments
                let angle = revs * Math.PI * 2;
                // The fuck? Clean this up.
                if ((this.angleDifference > 0) ? (angle > this.startingAngle && angle < endAngle) : (angle > endAngle && angle < this.startingAngle)) {
                    updateBoundaries(angle);
                }
            }
        }
    }

    protected createPath() {
        let points: Point[] = [];

        let segments = Math.ceil(Math.abs(this.angleDifference) / RADIANS_PER_CIRCLE_SEGMENT) || 1;
        let segmentLength = this.angleDifference / segments;

        for (let i = 0; i < segments + 1; i++) {
            let angle = this.startingAngle + segmentLength * i;
            
            points.push({
                x: this.centerPos.x + Math.cos(angle) * this.radius,
                y: this.centerPos.y + Math.sin(angle) * this.radius
            });
        }

        this.path = new SliderPath(points, this.slider);
    }

    applyStackPosition() {
        let stackHeight = this.slider.stackHeight;

        this.centerPos.x += stackHeight * -4;
        this.centerPos.y += stackHeight * -4;
    }

    /** Needs separate method because some perfect sliders need to be converted to bézier. */
    static create(slider: DrawableSlider, speedCalc: boolean) {
        let sections = slider.hitObject.sections;
        let points = sections[0].values;

        // Monstrata plz
        if (pointsAreEqual(points[0], points[2])) { // case one
            //Console.warn("Converted P to L-slider due to case one.");
            sections = jsonClone(sections); // Sicce we're modifying the sections here, we have to decouple them from the raw hit object.

            sections[0] = {type: "linear", values: [points[0], points[1]]};
            sections[1] = {type: "linear", values: [points[1], points[2]]};

            return new SliderCurveBézier(slider, sections, speedCalc);
        }

        let centerPos = MathUtil.circleCenterPos(points[0], points[1], points[2]);

        // Slider seems to have all points on one line. Parsing it as linear slider instead
        if (!isFinite(centerPos.x) || !isFinite(centerPos.y)) { // case two
            //Console.warn("Converted P to L-slider due to case two.");
            sections = jsonClone(sections);
        
            // Remove middle point
            sections[0].values.splice(1, 1);
            sections[0].type = "linear";

            return new SliderCurveBézier(slider, sections, speedCalc);
        }

        return new SliderCurvePerfect(slider, sections, speedCalc, centerPos);
    }
}