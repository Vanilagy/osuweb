import { SliderCurve } from "./slider_curve";
import { DrawableSlider } from "./drawable_slider";
import { Point } from "../util/point";
import { SliderPath } from "./slider_path";

export class SliderCurveEmpty extends SliderCurve {
    constructor(drawableSlider: DrawableSlider) {
        super(drawableSlider, []);

        //this.equalDistancePoints.push(drawableSlider.startPoint); // TODO
    }

    getEndPoint(): Point {
        return null;
    }

    getAngleFromPercentage(percent: number): number {
        return null;
    }

    createPath() {
        this.path = new SliderPath([], this.slider);
    }
}