//import {GraphicUtil} from "./graphicutil";
//import {SLIDER_SETTINGS} from "../game/drawableslider";
import { DrawableSlider } from "./drawable_slider";
import { gameState } from "./game_state";
import { SliderCurveSection } from "../datamodel/slider";
import { SLIDER_SETTINGS } from "../util/constants";
import { Point } from "../util/point";

export class SliderCurve {
    protected slider: DrawableSlider;
    protected sections: SliderCurveSection[];
    protected curveLength: number;

    constructor(drawableSlider: DrawableSlider) {
        this.slider = drawableSlider;
        this.sections = drawableSlider.hitObject.sections;
        this.curveLength = 0;
    }

    applyStackPosition() {
        console.log("SliderCurve.applyStackPosition was called. A shiver runs down your spine.");
    } // LOOK INTO THIS. IS THE NECESSARY. ON A CURVE. PLEASE! TODO TODO TODO TELL ME!!!!!!

    calculateEqualDistancePoints() { }

    render(completion: number) { }

    getEndPoint(): Point { return; }

    draw() { // Paints the slider, defined through path
        let { circleDiameter, processedBeatmap } = gameState.currentPlay;
        
        this.slider.baseCtx.clearRect(0, 0, Math.ceil(this.slider.sliderWidth + circleDiameter), Math.ceil(this.slider.sliderHeight + circleDiameter));
    
        //this.slider.baseCtx.fillStyle = 'red';
        //this.slider.baseCtx.fillRect(0, 0, this.slider.sliderWidth + gameState.currentPlay.circleDiameter, this.slider.sliderHeight + gameState.currentPlay.circleDiameter);

        // "Border"
        this.slider.baseCtx.lineWidth = circleDiameter * this.slider.reductionFactor;
        this.slider.baseCtx.strokeStyle = "white";
        this.slider.baseCtx.lineCap = "round";
        this.slider.baseCtx.lineJoin = "round";
        this.slider.baseCtx.globalCompositeOperation = "source-over";
        if(!SLIDER_SETTINGS.debugDrawing) this.slider.baseCtx.stroke();

        let colorArray = processedBeatmap.beatmap.colors;
        let color = colorArray[this.slider.comboInfo.comboNum % colorArray.length];
        color = {
            r: 3,
            g: 3,
            b: 12
        };

        // Gradient
        
        for (let i = this.slider.sliderBodyRadius; i > 1; i -= 2) {
            this.slider.baseCtx.lineWidth = i * 2;
            let brightnessCompletion = 1 - (i / this.slider.sliderBodyRadius); // 0 -> Border, 1 -> Center
            let red = Math.floor(color.r + (255 - color.r) / 2 * brightnessCompletion),
                green = Math.floor(color.g + (255 - color.g) / 2 * brightnessCompletion),
                blue = Math.floor(color.b + (255 - color.b) / 2 * brightnessCompletion);

            this.slider.baseCtx.strokeStyle = "rgb(" + red + ", " + green + ", " + blue + ")";
            if(!SLIDER_SETTINGS.debugDrawing) this.slider.baseCtx.stroke();
        }
        this.slider.baseCtx.lineWidth = this.slider.sliderBodyRadius * 2;
        this.slider.baseCtx.strokeStyle = "rgba(255, 255, 255, 0.5)";
        this.slider.baseCtx.globalCompositeOperation = "destination-out"; // Transparency
        if(!SLIDER_SETTINGS.debugDrawing) this.slider.baseCtx.stroke();
    }
}