export const PLAYFIELD_DIMENSIONS = { // In osu!pixels
    width: 512,
    height: 384
};

export const HIT_OBJECT_FADE_OUT_TIME = 175; // In ms
export const SLIDER_TICK_APPEARANCE_ANIMATION_DURATION = 85; // In ms
export const FOLLOW_CIRCLE_THICKNESS_FACTOR = 0.045; // in circle diameters

export enum DrawingMode {
    Procedural, // Draw everything, use no image assetss
    Skin // Use only image assets
}

export const DRAWING_MODE: DrawingMode = DrawingMode.Skin;
export const CIRCLE_BORDER_WIDTH = 1.75 / 16;

export const SLIDER_SETTINGS = {
    debugDrawing: false
};