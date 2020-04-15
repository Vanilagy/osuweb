import { PLAYFIELD_DIMENSIONS, SLIDER_BODY_INSIDE_TO_TOTAL_RATIO, SCREEN_COORDINATES_X_FACTOR, SCREEN_COORDINATES_Y_FACTOR } from "../../util/constants";
import { Color } from "../../util/graphics_util";
import { DrawableSlider } from "./drawable_slider";
import { MathUtil } from "../../util/math_util";
import { IGNORE_BEATMAP_SKIN } from "../skin/skin";
import { SliderBounds } from "./drawable_slider_path";
import { currentWindowDimensions } from "../../visuals/ui";

export const OBSERVED_SLIDER_BODY_TEXTURE_SIZE = 32768; // Observed in osu!stable. TODO: Is this system-dependent?

let vertexShaderSource = `
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

let fragmentShaderSource = `
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
		float alpha = 0.66666;

		color = alpha * vec4(mix(innerColor, outerColor, fragDistance / insideToTotalRatio), 1.0); // Premultiplied alpha
	}

	gl_FragColor = color;
}
`;

let sliderBodyProgram = new PIXI.Program(vertexShaderSource, fragmentShaderSource, "sliderBodyProgram");

export function createSliderBodyShader() {
	let shader = new PIXI.Shader(sliderBodyProgram, {});
	return shader;
}

export function updateSliderBodyShaderUniforms(shader: PIXI.Shader, slider: DrawableSlider) {
	let beatmap = slider.drawableBeatmap.processedBeatmap.beatmap;
	let { skin } = slider.drawableBeatmap.play;

	let borderColor: Color = null;
	if (!IGNORE_BEATMAP_SKIN) borderColor = beatmap.colors.sliderBorder;
	if (borderColor === null) borderColor = skin.config.colors.sliderBorder;

	let sliderBodyColor: Color = null;
	if (!IGNORE_BEATMAP_SKIN) sliderBodyColor = beatmap.colors.sliderTrackOverride;
	if (sliderBodyColor === null) sliderBodyColor = skin.config.colors.sliderTrackOverride;
	if (sliderBodyColor === null) sliderBodyColor = slider.color;

	let targetRed = Math.min(255, sliderBodyColor.r * 1.125 + 75),
		targetGreen = Math.min(255, sliderBodyColor.g * 1.125 + 75),
		targetBlue = Math.min(255, sliderBodyColor.b * 1.125 + 75);

	let uniforms = shader.uniforms;
	uniforms.insideToTotalRatio = SLIDER_BODY_INSIDE_TO_TOTAL_RATIO;
	uniforms.borderColor = [borderColor.r/255, borderColor.g/255, borderColor.b/255];
	uniforms.innerColor = [targetRed/255, targetGreen/255, targetBlue/255];
	uniforms.outerColor = [sliderBodyColor.r/255, sliderBodyColor.g/255, sliderBodyColor.b/255];
}

export function createSliderBodyTransformationMatrix(slider: DrawableSlider, sliderBounds: SliderBounds) { // The reason the bounds is given as a separate argument here is that bounds can change dynamically for very large, snaking sliders.
	let { hitObjectPixelRatio, circleRadius, circleRadiusOsuPx } = slider.drawableBeatmap.play;

	let matrix = glMatrix.mat3.create();
	glMatrix.mat3.identity(matrix);

	// NOTE: Read all matrix transformations in reverse order (bottom to top).

	// Okay. Why does it work with this line commented out: ? QUE?
	// glMatrix.mat3.scale(matrix, matrix, new Float32Array([1.0, -1.0])); // Flip that y axis.

	if (slider.hasFullscreenBaseSprite === false) {
		// The slider base sprite is not fullscreen and is as big as the slider.

		let width = sliderBounds.screenWidth,
			height = sliderBounds.screenHeight;

		glMatrix.mat3.translate(matrix, matrix, [-1.0, -1.0]);
		glMatrix.mat3.scale(matrix, matrix, [2 / width, 2 / height]); // From here, we just norm it to the [-1.0, 1.0] NDC (normalized device coordinates) interval.

		glMatrix.mat3.translate(matrix, matrix, [circleRadius, circleRadius]); // Okay, at this point, we'll have projected the coordinate into slider-relative space.
		glMatrix.mat3.scale(matrix, matrix, [hitObjectPixelRatio, hitObjectPixelRatio]);
		glMatrix.mat3.translate(matrix, matrix, [-sliderBounds.min.x, -sliderBounds.min.y]);
	} else {
		// The slider base sprite is fullscreen because the slider is likely very big, at least bigger than the device's screen. In rare cases, this can trigger sliders to get distorted. This behavior is accurately faked here.

		// A quick explanation of how slider distortion works exactly, because I've already gone through 2 days of absolute agony of figuring this mess out, and wanna spend the last bit of kindness left inside me to spare the next human that tries to figure it out as well.
		// Okay, so it seems like ppy draws slider bodies onto textures of 32768x32768 max size, or... something. What's for sure is that 32768 is the magic number that triggers distortion on a given axis.
		// Define _f_ to be the factor a distorted axis has to be scaled by for it to be exactly 32768 pixels long. So, if the slider is 65536 pixels wide, f is 32768/65536 = 0.5.
		// Distortion can be done per-axis; the two axes don't interfere with each other. Therefore, let's cover both axes separately, starting with the x-axis:
		// If the slider texture is more than 32768 pixels wide, the following two things can happen: If any part of the slider intersects the left edge of the screen, then the slider is scaled along the x-axis by f, with the scaling being centered on the left screen edge. If the slider does NOT intersect the left edge of the screen, then the slider is scaled by f with the center being at the left-most point of the slider.
		// Scaling along the y-axis works almost identically, now using the top edge, not the left edge. The exception is that top-edge scaling only happens if the slider ALSO intersects the bottom edge of the screen. In the case where the slider only intersects the top edge, no scaling is done at all.

		let width = currentWindowDimensions.width,
			height = currentWindowDimensions.height;

		glMatrix.mat3.translate(matrix, matrix, [-1.0, -1.0]);
		glMatrix.mat3.scale(matrix, matrix, [2 / width, 2 / height]); // From here, we just norm it to the [-1.0, 1.0] NDC (normalized device coordinates) interval.

		// Slider distortion code here:
		let intersectsLeftEdge = false,
			intersectsTopEdge = false,
			intersectsBottomEdge = false,
			shrinkFactorX = MathUtil.clamp(OBSERVED_SLIDER_BODY_TEXTURE_SIZE / sliderBounds.screenWidth, 0, 1),
			shrinkFactorY = MathUtil.clamp(OBSERVED_SLIDER_BODY_TEXTURE_SIZE / sliderBounds.screenHeight, 0, 1),
			adjustedCircleRadius = circleRadiusOsuPx * 1.22; // Not sure why this needs a factor, but I think ppy just made his slider body texture a bit bigger than necessary.
		let isDistortedSlider = shrinkFactorX < 1.0 || shrinkFactorY < 1.0;

		if (isDistortedSlider) {
			intersectsLeftEdge = slider.drawableBeatmap.play.toScreenCoordinatesX(sliderBounds.min.x + adjustedCircleRadius, false) <= 0;
			intersectsTopEdge = slider.drawableBeatmap.play.toScreenCoordinatesY(sliderBounds.min.y + adjustedCircleRadius, false) <= 0;
			intersectsBottomEdge = slider.drawableBeatmap.play.toScreenCoordinatesY(sliderBounds.max.y + adjustedCircleRadius, false) >= currentWindowDimensions.height;

			// Do left-edge scaling
			if (intersectsLeftEdge) glMatrix.mat3.scale(matrix, matrix, [shrinkFactorX, 1.0]);
			// Do top-edge scaling
			if (intersectsTopEdge && intersectsBottomEdge) glMatrix.mat3.scale(matrix, matrix, [1.0, shrinkFactorY]);
		}

		// These lines project from osu coordinates into screen coordinates:
		glMatrix.mat3.translate(matrix, matrix, [width * SCREEN_COORDINATES_X_FACTOR, height * SCREEN_COORDINATES_Y_FACTOR]); // At this point, we'll have projected the coordinate into screen-relative space.
		glMatrix.mat3.scale(matrix, matrix, [hitObjectPixelRatio, hitObjectPixelRatio]);
		glMatrix.mat3.translate(matrix, matrix, [-PLAYFIELD_DIMENSIONS.width/2, -PLAYFIELD_DIMENSIONS.height/2]);

		// More slider distortion code:
		if (!intersectsLeftEdge) {
			// Scale from the left-most part of the slider
			glMatrix.mat3.translate(matrix, matrix, [sliderBounds.min.x - adjustedCircleRadius, 0]);
			glMatrix.mat3.scale(matrix, matrix, [shrinkFactorX, 1.0]);
			glMatrix.mat3.translate(matrix, matrix, [-sliderBounds.min.x + adjustedCircleRadius, 0]); // Why plus here, and not minus? :thinking:
		}

		if (!intersectsTopEdge) {
			// Scale from the top-most part of the slider
			glMatrix.mat3.translate(matrix, matrix, [0, sliderBounds.min.y - adjustedCircleRadius]);
			glMatrix.mat3.scale(matrix, matrix, [1.0, shrinkFactorY]);
			glMatrix.mat3.translate(matrix, matrix, [0, -sliderBounds.min.y + adjustedCircleRadius]);
		}
	}

	return matrix;
}