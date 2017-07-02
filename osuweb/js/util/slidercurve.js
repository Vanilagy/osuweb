"use strict";

import {GraphicUtil} from "./graphicutil";

export class SliderCurve {
    constructor(drawableSlider) {
        this.slider = drawableSlider;
        this.sections = drawableSlider.hitObject.sections;
        this.equalDistancePoints = [];
        this.curveLength = 0;
    }

    calculateEqualDistancePoints() {

    }

    pushEqualDistancePoint(pos) { // Pushes endpoint to array
        pos = {
            x: pos.x * GraphicUtil.getPixelRatio(),
            y: pos.y * GraphicUtil.getPixelRatio()
        };

        this.equalDistancePoints.push(pos);

        this.slider.minX = Math.min(this.slider.minX, pos.x);
        this.slider.minY = Math.min(this.slider.minY, pos.y);
        this.slider.maxX = Math.max(this.slider.maxX, pos.x);
        this.slider.maxY = Math.max(this.slider.maxY, pos.y);
    }
}