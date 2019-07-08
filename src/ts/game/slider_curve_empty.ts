import { SliderCurve } from "./slider_curve";
import { DrawableSlider } from "./drawable_slider";

export class SliderCurveEmpty extends SliderCurve {
    constructor(drawableSlider: DrawableSlider) {
        super(drawableSlider);

        //this.equalDistancePoints.push(drawableSlider.startPoint); // TODO
    }
}