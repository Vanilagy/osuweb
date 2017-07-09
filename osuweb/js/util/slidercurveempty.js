"use strict";

import {SliderCurve} from "./slidercurve";

export class SliderCurveEmpty extends SliderCurve {
    constructor(drawableSlider) {
        super(drawableSlider);

        this.equalDistancePoints.push(drawableSlider.startPoint);
    }
}