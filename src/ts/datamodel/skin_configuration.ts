import { Color } from "../util/graphics_util";
import { jsonClone } from "../util/misc_util";

export interface SkinConfiguration {
    general: {
        name: string,
        author: string,
        version: number | "latest",
        cursorExpand: boolean,
        cursorCenter: boolean,
        cursorRotate: boolean,
        cursorTrailRotate: boolean,
        animationFramerate: number,
        layeredHitSounds: boolean,
        comboBurstRandom: boolean,
        customComboBurstSounds: number[],
        hitCircleOverlayAboveNumber: boolean,
        sliderStyle: number,
        sliderBallFlip: boolean,
        allowSliderBallTint: boolean,
        spinnerNoBlink: boolean,
        spinnerFadePlayfield: boolean,
        spinnerFrequencyModulate: boolean
    },
    colors: {
        songSelectActiveText: Color,
        songSelectInactiveText: Color,
        menuGlow: Color,
        starBreakAdditive: Color,
        inputOverlayText: Color,
        sliderBall: Color,
        sliderTrackOverride: Color,
        sliderBorder: Color,
        spinnerBackground: Color,
        combo1: Color,
        combo2: Color,
        combo3: Color,
        combo4: Color,
        combo5: Color,
        combo6: Color,
        combo7: Color,
        combo8: Color,
    },
    fonts: {
        hitCirclePrefix: string,
        hitCircleOverlap: number,
        scorePrefix: string,
        scoreOverlap: number,
        comboPrefix: string,
        comboOverlap: number
    }
}

// Based on https://docs.google.com/spreadsheets/d/1bhnV-CQRMy3Z0npQd9XSoTdkYxz0ew5e648S00qkJZ8/edit#gid=617540681
export const DEFAULT_SKIN_CONFIG: SkinConfiguration = {
    general: {
        name: null,
        author: null,
        version: 1,
        cursorExpand: true,
        cursorCenter: true,
        cursorRotate: true,
        cursorTrailRotate: true,
        animationFramerate: null, // TODO: "Animations have their own initial framerate" whut? (google docs)
        layeredHitSounds: true,
        comboBurstRandom: false,
        customComboBurstSounds: [],
        hitCircleOverlayAboveNumber: true,
        sliderStyle: 2,
        sliderBallFlip: false,
        allowSliderBallTint: false,
        spinnerNoBlink: false,
        spinnerFadePlayfield: false,
        spinnerFrequencyModulate: true
    },
    colors: {
        songSelectActiveText: {r: 0, g: 0, b: 0},
        songSelectInactiveText: {r: 255, g: 255, b: 255},
        menuGlow: {r: 0, g: 78, b: 155},
        starBreakAdditive: {r: 255, g: 182, b: 193},
        inputOverlayText: {r: 0, g: 0, b: 0},
        sliderBall: {r: 2, g: 170, b: 255},
        sliderTrackOverride: null,
        sliderBorder: {r: 255, g: 255, b: 255},
        spinnerBackground: {r: 100, g: 100, b: 100},
        combo1: {r: 255, g: 192, b: 0},
        combo2: {r: 0, g: 202, b: 0},
        combo3: {r: 18, g: 124, b: 255},
        combo4: {r: 242, g: 24, b: 57},
        combo5: null,
        combo6: null,
        combo7: null,
        combo8: null,
    },
    fonts: {
        hitCirclePrefix: 'default',
        hitCircleOverlap: -2,
        scorePrefix: 'score',
        scoreOverlap: -2,
        comboPrefix: 'score',
        comboOverlap: -2
    }

    // TODO: Add CTB and Mania.
};

/** For parsing Skin.ini files */
export function parseSkinConfiguration(text: string) {
    console.time("Skin configuration parse");

    let config = jsonClone(DEFAULT_SKIN_CONFIG);
    let lines = text.split("\n");
    let currentSection: string;

    function parseColor(value: string) {
        let values = value.split(",").map((a) => parseInt(a));
        return {r: values[0], g: values[1], b: values[2]};
    }

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line) continue;

        let value = line.slice(line.indexOf(":") + 1).trim();

        if (currentSection === "general") {
            if (line.startsWith("Name")) config.general.name = value;
            else if (line.startsWith("Author")) config.general.author = value;
            else if (line.startsWith("Version")) config.general.version = (value === "latest")? value : Number(value);
            else if (line.startsWith("CursorExpand")) config.general.cursorExpand = value === "1";
            else if (line.startsWith("CursorCentre")) config.general.cursorCenter = value === "1";
            else if (line.startsWith("CursorRotate")) config.general.cursorRotate = value === "1";
            else if (line.startsWith("CursorTrailRotate")) config.general.cursorTrailRotate = value === "1";
            else if (line.startsWith("AnimationFramerate")) config.general.animationFramerate = parseInt(value);
            else if (line.startsWith("LayeredHitSounds")) config.general.layeredHitSounds = value === "1";
            else if (line.startsWith("ComboBurstRandom")) config.general.comboBurstRandom = value === "1";
            else if (line.startsWith("CustomComboBurstSounds")) config.general.customComboBurstSounds = value.split(",").map((a) => parseInt(a));
            else if (line.startsWith("HitCircleOverlayAboveNumber") || line.startsWith("HitCircleOverlayAboveNumer") /* typo for legacy support */) config.general.hitCircleOverlayAboveNumber = value === "1"; 
            else if (line.startsWith("SliderStyle")) config.general.sliderStyle = parseInt(value); 
            else if (line.startsWith("SliderBallFlip")) config.general.sliderBallFlip = value === "1";
            else if (line.startsWith("AllowSliderBallTint")) config.general.allowSliderBallTint = value === "1";
            else if (line.startsWith("SpinnerNoBlink")) config.general.spinnerNoBlink = value === "1"; 
            else if (line.startsWith("SpinnerFadePlayfield")) config.general.spinnerFadePlayfield = value === "1"; 
            else if (line.startsWith("SpinnerFrequencyModulate")) config.general.spinnerFrequencyModulate = value === "1";
        } else if (currentSection === "colors") {
            if (line.startsWith("SongSelectActiveText")) config.colors.songSelectActiveText = parseColor(value);
            else if (line.startsWith("SongSelectInactiveText")) config.colors.songSelectInactiveText = parseColor(value);
            else if (line.startsWith("MenuGlow")) config.colors.menuGlow = parseColor(value);
            else if (line.startsWith("StarBreakAdditive")) config.colors.starBreakAdditive = parseColor(value);
            else if (line.startsWith("InputOverlayText")) config.colors.inputOverlayText = parseColor(value);
            else if (line.startsWith("SliderBall")) config.colors.sliderBall = parseColor(value);
            else if (line.startsWith("SliderTrackOverride")) config.colors.sliderTrackOverride = parseColor(value);
            else if (line.startsWith("SliderBorder")) config.colors.sliderBorder = parseColor(value);
            else if (line.startsWith("SpinnerBackground")) config.colors.spinnerBackground = parseColor(value);
            else if (line.startsWith("Combo1")) config.colors.combo1 = parseColor(value);
            else if (line.startsWith("Combo2")) config.colors.combo2 = parseColor(value);
            else if (line.startsWith("Combo3")) config.colors.combo3 = parseColor(value);
            else if (line.startsWith("Combo4")) config.colors.combo4 = parseColor(value);
            else if (line.startsWith("Combo5")) config.colors.combo5 = parseColor(value);
            else if (line.startsWith("Combo6")) config.colors.combo6 = parseColor(value);
            else if (line.startsWith("Combo7")) config.colors.combo7 = parseColor(value);
            else if (line.startsWith("Combo8")) config.colors.combo8 = parseColor(value);
        } else if (currentSection === "fonts") {
            if (line.startsWith("HitCirclePrefix")) config.fonts.hitCirclePrefix = value;
            else if (line.startsWith("HitCircleOverlap")) config.fonts.hitCircleOverlap = parseInt(value);
            else if (line.startsWith("ScorePrefix")) config.fonts.scorePrefix = value;
            else if (line.startsWith("ScoreOverlap")) config.fonts.scoreOverlap = parseInt(value);
            else if (line.startsWith("ComboPrefix")) config.fonts.comboPrefix = value;
            else if (line.startsWith("ComboOverlap")) config.fonts.comboOverlap = parseInt(value);
        }

        if (line === "[General]") currentSection = "general";
        else if (line === "[Colours]") currentSection = "colors";
        else if (line === "[Fonts]") currentSection = "fonts";
    }

    console.timeEnd("Skin configuration parse");

    return config;
}