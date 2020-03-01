import { hexNumberToColor, Color } from "./graphics_util";

export const PLAYFIELD_DIMENSIONS = { // In osu!pixels
	width: 512,
	height: 384
};
export const STANDARD_SCREEN_DIMENSIONS = {
	width: 640,
	height: 480
};

export const SCREEN_COORDINATES_X_FACTOR = 0.5; // See this constant's use for an explanation.
export const SCREEN_COORDINATES_Y_FACTOR = 0.515;

export const DEFAULT_HIT_OBJECT_FADE_IN_TIME = 400; // In ms. This is constant and actually independent of AR.
export const HIT_OBJECT_FADE_OUT_TIME = 200; // In ms
export const SLIDER_TICK_APPEARANCE_ANIMATION_DURATION = 200; // In ms
export const FOLLOW_CIRCLE_THICKNESS_FACTOR = 0.045; // in circle diameters
export const SHOW_APPROACH_CIRCLE_ON_FIRST_HIDDEN_OBJECT = true;

export const CIRCLE_BORDER_WIDTH = 1.75 / 16;
export const SLIDER_BODY_INSIDE_TO_TOTAL_RATIO = 0.89;
export const NUMBER_HEIGHT_CS_RATIO = 52 / 128; // Determined empirically by comparing asset dimensions.
export const UNSCALED_NUMBER_HEIGHT = 47;
export const PROCEDURAL_HEAD_INNER_TYPE: "number" | "dot" = "number";

export const SLIDER_SETTINGS = {
	debugDrawing: false,
	snaking: true
};

export const THEME_COLORS = {
	PrimaryBlue: hexNumberToColor(0x6FC2FF),
	PrimaryYellow: hexNumberToColor(0xFFD84B),
	PrimaryPink: hexNumberToColor(0xFA557D)
} as const;