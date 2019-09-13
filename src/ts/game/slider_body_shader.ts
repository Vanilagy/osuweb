import { gameState } from "./game_state";
import { PLAYFIELD_DIMENSIONS, SLIDER_BODY_INSIDE_TO_TOTAL_RATIO } from "../util/constants";
import { Color } from "../util/graphics_util";
import { DrawableSlider } from "./drawable_slider";

declare const glMatrix: any; // Why? Because TypeScript made it goddamn hard to get actual good and correct types for glMatrix. AND HELL NAW DO I WANNA IMPORT IT VIA FUCKING NPM.

export const SLIDER_BODY_MESH_STATE = new PIXI.State();
SLIDER_BODY_MESH_STATE.depthTest = true;
SLIDER_BODY_MESH_STATE.blend = false; // Why doesn't this work?

let vertexShaderText = `
precision mediump float;

attribute vec3 vertPosition;

uniform mat3 matrix; // Original name. I know.

varying float fragDistance;

void main() {
    fragDistance = vertPosition.z;

    vec3 screenPosition = matrix * vec3(vertPosition.x, vertPosition.y, 1.0);
    gl_Position = vec4(screenPosition.x, screenPosition.y, vertPosition.z, 1.0);
}
`;

let fragmentShaderText = `
precision mediump float;

uniform vec3 borderColor;
uniform vec3 innerColor;
uniform vec3 outerColor;
uniform float insideToTotalRatio;

varying float fragDistance;

void main() {
    vec4 color;

    if (fragDistance > insideToTotalRatio) {
        color = vec4(borderColor, 1.0);
    } else {
        float alpha = 0.666;

        color = alpha * vec4(mix(innerColor, outerColor, fragDistance / insideToTotalRatio), 1.0); // Premultiplied alpha
    }

    gl_FragColor = color;
}
`;

let sliderBodyProgram = new PIXI.Program(vertexShaderText, fragmentShaderText, "sliderBodyProgram");

export function createSliderBodyShader(slider: DrawableSlider) {
    let { pixelRatio, circleRadius } = gameState.currentPlay;

    let matrix = new Float32Array(9);
    glMatrix.mat3.identity(matrix);

    // Read these transformations in reverse order (bottom to top):

    // Okay. Why does it work with this line commented out: ? QUE?
    //glMatrix.mat3.scale(matrix, matrix, new Float32Array([1.0, -1.0])); // Flip that y axis.
    glMatrix.mat3.translate(matrix, matrix, new Float32Array([-1.0, -1.0]));
    glMatrix.mat3.scale(matrix, matrix, new Float32Array([2 / slider.bounds.screenWidth, 2 / slider.bounds.screenHeight])); // From here, we just norm it to the [-1.0, 1.0] NDC (normalized device coordinates) interval.
    glMatrix.mat3.translate(matrix, matrix, new Float32Array([circleRadius, circleRadius])); // Okay, at this point, we'll have projected the coordinate into slider-relative space.
    glMatrix.mat3.scale(matrix, matrix, new Float32Array([pixelRatio, pixelRatio]));
    glMatrix.mat3.translate(matrix, matrix, new Float32Array([-slider.bounds.minX, -slider.bounds.minY]));

    let borderColor = gameState.currentGameplaySkin.config.colors.sliderBorder;

    let sliderBodyColor: Color;
    if (gameState.currentGameplaySkin.config.colors.sliderTrackOverride) {
        sliderBodyColor = gameState.currentGameplaySkin.config.colors.sliderTrackOverride;
    } else {
        sliderBodyColor = slider.comboInfo.color;
    }

    let targetRed = Math.min(255, sliderBodyColor.r * 1.125 + 75),
        targetGreen = Math.min(255, sliderBodyColor.g * 1.125 + 75),
        targetBlue = Math.min(255, sliderBodyColor.b * 1.125 + 75);

    // TODO: Is this definition even right?
    let pixiUniforms = {} as any;
    pixiUniforms.matrix = matrix;
    pixiUniforms.insideToTotalRatio = SLIDER_BODY_INSIDE_TO_TOTAL_RATIO;
    pixiUniforms.borderColor = [borderColor.r/255, borderColor.g/255, borderColor.b/255];
    pixiUniforms.innerColor = [targetRed/255, targetGreen/255, targetBlue/255];
    pixiUniforms.outerColor = [sliderBodyColor.r/255, sliderBodyColor.g/255, sliderBodyColor.b/255];

    let shader = new PIXI.Shader(sliderBodyProgram, pixiUniforms);
    return shader;
}