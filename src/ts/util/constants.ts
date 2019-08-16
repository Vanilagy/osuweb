export const PLAYFIELD_DIMENSIONS = { // In osu!pixels
    width: 512,
    height: 384
};
export const STANDARD_SCREEN_DIMENSIONS = {
    width: 640,
    height: 480
};

export const HIT_OBJECT_FADE_IN_TIME = 400; // In ms. This is constant and actually independent of AR.
export const HIT_OBJECT_FADE_OUT_TIME = 200; // In ms
export const SLIDER_TICK_APPEARANCE_ANIMATION_DURATION = 200; // In ms
export const FOLLOW_CIRCLE_THICKNESS_FACTOR = 0.045; // in circle diameters

export enum DrawingMode {
    Procedural, // Draw everything, use no image assetss
    Skin // Use only image assets
}

export const DRAWING_MODE: DrawingMode = DrawingMode.Skin;
export const CIRCLE_BORDER_WIDTH = 1.75 / 16;
export const NUMBER_HEIGHT_CS_RATIO = 52 / 128; // Determined empirically by comparing asset dimensions.
export const UNSCALED_NUMBER_HEIGHT = 47;
export const PROCEDURAL_HEAD_INNER_TYPE: "number" | "dot" = "number";

export const SLIDER_SETTINGS = {
    debugDrawing: false
};