import { DrawableSlider } from "./drawable_slider";
import { gameState } from "./game_state";
import { SliderCurveSection } from "../datamodel/slider";
import { SLIDER_SETTINGS } from "../util/constants";
import { Point } from "../util/point";
import { colorToHexString, Color } from "../util/graphics_util";
import { MathUtil } from "../util/math_util";
import { SliderPath } from "./slider_path";

export abstract class SliderCurve {
    public slider: DrawableSlider;
    protected sections: SliderCurveSection[];
    protected curveLength: number;
    protected path: SliderPath;
    public lastRenderedCompletion: number = 0.0;

    constructor(drawableSlider: DrawableSlider, sections: SliderCurveSection[]) {
        this.slider = drawableSlider;
        this.sections = sections;
        this.curveLength = 0;
    }

    // World's worst abstract method:
    applyStackPosition() {
        console.log("Not implemented yet.");
    }

    abstract getEndPoint(): Point;

    abstract getAngleFromPercentage(percent: number): number;

    protected abstract createPath(): void;

    generateGeometry(completion: number) {
        if (!this.path) this.createPath();

        let geometry = new PIXI.Geometry();
        geometry.addAttribute(
            'vertPosition',
            new PIXI.Buffer(new Float32Array(0)),
            3,
            false,
            PIXI.TYPES.FLOAT,
            3 * Float32Array.BYTES_PER_ELEMENT,
            0
        );

        this.updateGeometry(geometry, completion);
        return geometry;
    }

    updateGeometry(geometry: PIXI.Geometry, completion: number) {
        let vertexBuffer = this.path.generateVertexBuffer(completion);
        let pixiBuffer = geometry.getBuffer('vertPosition');

        pixiBuffer.update(vertexBuffer);
        this.lastRenderedCompletion = completion;
    }
}