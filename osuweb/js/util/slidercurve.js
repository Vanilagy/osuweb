"use strict";

import {GraphicUtil} from "./graphicutil";
import {SLIDER_SETTINGS} from "../game/drawableslider";
import {GAME_STATE} from "../main";

export class SliderCurve {
    constructor(drawableSlider) {
        this.slider = drawableSlider;
        this.sections = drawableSlider.hitObject.sections;
        this.curveLength = 0;
    }

    calculateEqualDistancePoints() {

    }

    render() {

    }

    draw() { // Paints the slider, defined through path
        this.slider.baseCtx.clearRect(0, 0, Math.ceil(this.slider.sliderWidth + GAME_STATE.currentPlay.csPixel), Math.ceil(this.slider.sliderHeight + GAME_STATE.currentPlay.csPixel));

        // "Border"
        this.slider.baseCtx.lineWidth = GAME_STATE.currentPlay.csPixel * this.slider.reductionFactor;
        this.slider.baseCtx.strokeStyle = "white";
        this.slider.baseCtx.lineCap = "round";
        this.slider.baseCtx.lineJoin = "round";
        this.slider.baseCtx.globalCompositeOperation = "source-over";
        if(!SLIDER_SETTINGS.debugDrawing) this.slider.baseCtx.stroke();

        let colour = GAME_STATE.currentBeatmap.colours[this.slider.comboInfo.comboNum % GAME_STATE.currentBeatmap.colours.length];
        colour = {
            r: 3,
            g: 3,
            b: 12
        };

        // Gradient
        for (let i = this.slider.sliderBodyRadius; i > 1; i -= 2) {
            this.slider.baseCtx.lineWidth = i * 2;
            let brightnessCompletion = 1 - (i / this.slider.sliderBodyRadius); // 0 -> Border, 1 -> Center
            let red = Math.floor(colour.r + (255 - colour.r) / 2 * brightnessCompletion),
                green = Math.floor(colour.g + (255 - colour.g) / 2 * brightnessCompletion),
                blue = Math.floor(colour.b + (255 - colour.b) / 2 * brightnessCompletion);

            this.slider.baseCtx.strokeStyle = "rgb(" + red + ", " + green + ", " + blue + ")";
            if(!SLIDER_SETTINGS.debugDrawing) this.slider.baseCtx.stroke();
        }
        this.slider.baseCtx.lineWidth = this.slider.sliderBodyRadius * 2;
        this.slider.baseCtx.strokeStyle = "rgba(255, 255, 255, 0.5)";
        this.slider.baseCtx.globalCompositeOperation = "destination-out"; // Transparency
        if(!SLIDER_SETTINGS.debugDrawing) this.slider.baseCtx.stroke();
    }

    pushEqualDistancePoint(pos) { // Pushes endpoint to array
        this.equalDistancePoints.push(pos);

        let pixelRatio = GAME_STATE.currentPlay.pixelRatio;

        this.slider.minX = Math.min(this.slider.minX, pos.x * pixelRatio);
        this.slider.minY = Math.min(this.slider.minY, pos.y * pixelRatio);
        this.slider.maxX = Math.max(this.slider.maxX, pos.x * pixelRatio);
        this.slider.maxY = Math.max(this.slider.maxY, pos.y * pixelRatio);
    }
}