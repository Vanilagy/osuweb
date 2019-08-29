import { SliderCurve } from "./slider_curve";
import { DrawableSlider } from "./drawable_slider";
import { Point } from "../util/point";

export class SliderCurveEmpty extends SliderCurve {
    constructor(drawableSlider: DrawableSlider) {
        super(drawableSlider, []);

        //this.equalDistancePoints.push(drawableSlider.startPoint); // TODO
    }

    render() {}

    getEndPoint(): Point {
        return null;
    }

    getAngleFromPercentage(percent: number): number {
        return null;
    }
}