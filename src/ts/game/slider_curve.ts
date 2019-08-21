import { DrawableSlider } from "./drawable_slider";
import { gameState } from "./game_state";
import { SliderCurveSection } from "../datamodel/slider";
import { SLIDER_SETTINGS } from "../util/constants";
import { Point } from "../util/point";
import { colorToHexStirng, Color } from "../util/graphics_util";
import { MathUtil } from "../util/math_util";

export abstract class SliderCurve {
    protected slider: DrawableSlider;
    protected sections: SliderCurveSection[];
    protected curveLength: number;

    constructor(drawableSlider: DrawableSlider) {
        this.slider = drawableSlider;
        this.sections = drawableSlider.hitObject.sections;
        this.curveLength = 0;
    }

    applyStackPosition() {
        console.log("Not implemented yet.");
    }

    abstract render(completion: number): void;

    abstract getEndPoint(): Point;

    abstract getAngleFromPercentage(percent: number): number;

    draw() { // Paints the slider, defined through path
        let { circleDiameter } = gameState.currentPlay;
        
        this.slider.baseCtx.clearRect(0, 0, Math.ceil(this.slider.sliderWidth + circleDiameter), Math.ceil(this.slider.sliderHeight + circleDiameter));

        // "Border"
        this.slider.baseCtx.lineWidth = circleDiameter * this.slider.reductionFactor;
        this.slider.baseCtx.strokeStyle = colorToHexStirng(gameState.currentGameplaySkin.config.colors.sliderBorder);
        this.slider.baseCtx.lineCap = "round";
        this.slider.baseCtx.lineJoin = "round";
        this.slider.baseCtx.globalCompositeOperation = "source-over";
        if (!SLIDER_SETTINGS.debugDrawing) this.slider.baseCtx.stroke();

        let color: Color;
        if (gameState.currentGameplaySkin.config.colors.sliderTrackOverride) {
            color = gameState.currentGameplaySkin.config.colors.sliderTrackOverride;
        } else {
            color = this.slider.comboInfo.color;
        }

        let targetRed = Math.min(255, color.r * 1.125 + 75),
            targetGreen = Math.min(255, color.g * 1.125 + 75),
            targetBlue = Math.min(255, color.b * 1.125 + 75);

        // Gradient
        for (let i = this.slider.sliderBodyRadius; i > 1; i -= 2) {
            this.slider.baseCtx.lineWidth = i * 2;
            let brightnessCompletion = 1 - (i / this.slider.sliderBodyRadius); // 0 -> Border, 1 -> Center

            let red = MathUtil.lerp(color.r, targetRed, brightnessCompletion),
                green = MathUtil.lerp(color.g, targetGreen, brightnessCompletion),
                blue = MathUtil.lerp(color.b, targetBlue, brightnessCompletion);

            this.slider.baseCtx.strokeStyle = `rgb(${red | 0},${green | 0},${blue | 0})`;
            if (!SLIDER_SETTINGS.debugDrawing) this.slider.baseCtx.stroke();
        }
        this.slider.baseCtx.lineWidth = this.slider.sliderBodyRadius * 2;
        this.slider.baseCtx.strokeStyle = "rgba(255, 255, 255, 0.333)";
        this.slider.baseCtx.globalCompositeOperation = "destination-out"; // Transparency
        if (!SLIDER_SETTINGS.debugDrawing) this.slider.baseCtx.stroke();
    }
}