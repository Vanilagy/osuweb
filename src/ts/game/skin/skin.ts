import { SpriteNumberTextures } from "../../visuals/sprite_number";
import { VirtualDirectory } from "../../file_system/virtual_directory";
import { SkinConfiguration, DEFAULT_SKIN_CONFIG, parseSkinConfiguration } from "../../datamodel/skin_configuration";
import { Color } from "../../util/graphics_util";
import { assert, jsonClone, shallowObjectClone, last } from "../../util/misc_util";
import { OsuTexture } from "./texture";
import { OsuSoundType, OsuSound, osuSoundFileNames } from "./sound";

export const IGNORE_BEATMAP_SKIN = false;
export const IGNORE_BEATMAP_HIT_SOUNDS = false;
const HIT_CIRCLE_NUMBER_SUFFIXES = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
const SCORE_NUMBER_SUFFIXES = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "comma", "dot", "percent", "x"];
export const DEFAULT_COLORS: Color[] = [{r: 255, g: 192, b: 0}, {r: 0, g: 202, b: 0}, {r: 18, g: 124, b: 255}, {r: 242, g: 24, b: 57}];
const CURRENT_LATEST_SKIN_VERSION = 2.5;

export class Skin {
    private directory: VirtualDirectory;
    public config: SkinConfiguration;
    public hasDefaultConfig: boolean;
    public textures: { [name: string]: OsuTexture };
    public hitCircleNumberTextures: SpriteNumberTextures;
    public scoreNumberTextures: SpriteNumberTextures;
    public comboNumberTextures: SpriteNumberTextures;
    public colors: Color[];
	public sounds: { [key in keyof typeof OsuSoundType]?: OsuSound };
	/** Whether sliderBallBg and sliderBallSpec are shown. */
	public allowSliderBallExtras: boolean;

    constructor(directory: VirtualDirectory) {
        this.directory = directory;
        this.textures = {};
        this.hitCircleNumberTextures = null;
        this.scoreNumberTextures = null;
        this.comboNumberTextures = null;
        this.colors = [];
		this.sounds = {};
		this.allowSliderBallExtras = true;
    }

    async init(readyAssets = true) {
        console.time("Skin init");

        let skinConfigurationFile = await this.directory.getFileByName("skin.ini") || await this.directory.getFileByName("Skin.ini");
        if (skinConfigurationFile) {
            this.config = parseSkinConfiguration(await skinConfigurationFile.readAsText());
            this.hasDefaultConfig = false;
        } else {
            this.config = jsonClone(DEFAULT_SKIN_CONFIG);
            this.config.general.version = "latest"; // If the skin.ini file is not present, latest will be used instead.
            this.hasDefaultConfig = true;
        }

        for (let i = 1; i <= 8; i++) {
            let color = this.config.colors[("combo" + i) as keyof SkinConfiguration["colors"]];
            if (color === null) break;

            this.colors.push(color);
        }

        // Circles
        this.textures["hitCircle"] = await OsuTexture.fromFiles(this.directory, "hitcircle", "png", true);
        this.textures["hitCircleOverlay"] = await OsuTexture.fromFiles(this.directory, "hitcircleoverlay", "png", true, "hitcircleoverlay-{n}");
        this.textures["approachCircle"] = await OsuTexture.fromFiles(this.directory, "approachcircle", "png", true);

        // Sliders
        this.textures["sliderStartCircle"] = await OsuTexture.fromFiles(this.directory, "sliderstartcircle", "png", true);
        this.textures["sliderStartCircleOverlay"] = await OsuTexture.fromFiles(this.directory, "sliderstartcircleoverlay", "png", true, "sliderstartcircleoverlay-{n}");
        this.textures["sliderEndCircle"] = await OsuTexture.fromFiles(this.directory, "sliderendcircle", "png", true);
        this.textures["sliderEndCircleOverlay"] = await OsuTexture.fromFiles(this.directory, "sliderendcircleoverlay", "png", true, "sliderendcircleoverlay-{n}");
        this.textures["sliderBall"] = await OsuTexture.fromFiles(this.directory, "sliderb", "png", true, "sliderb{n}"); // No hyphen
        this.textures["sliderBallBg"] = await OsuTexture.fromFiles(this.directory, "sliderb-nd", "png", false);
        this.textures["sliderBallSpec"] = await OsuTexture.fromFiles(this.directory, "sliderb-spec", "png", false);
        this.textures["followCircle"] = await OsuTexture.fromFiles(this.directory, "sliderfollowcircle", "png", true, "sliderfollowcircle-{n}");
        this.textures["reverseArrow"] = await OsuTexture.fromFiles(this.directory, "reversearrow", "png", true);
        this.textures["sliderTick"] = await OsuTexture.fromFiles(this.directory, "sliderscorepoint", "png", true);

        // Spinners
        this.textures["spinnerGlow"] = await OsuTexture.fromFiles(this.directory, "spinner-glow", "png", true);
        this.textures["spinnerBottom"] = await OsuTexture.fromFiles(this.directory, "spinner-bottom", "png", true);
        this.textures["spinnerTop"] = await OsuTexture.fromFiles(this.directory, "spinner-top", "png", true);
        this.textures["spinnerMiddle2"] = await OsuTexture.fromFiles(this.directory, "spinner-middle2", "png", true);
        this.textures["spinnerMiddle"] = await OsuTexture.fromFiles(this.directory, "spinner-middle", "png", true);
        this.textures["spinnerBackground"] = await OsuTexture.fromFiles(this.directory, "spinner-background", "png", true);
        this.textures["spinnerMeter"] = await OsuTexture.fromFiles(this.directory, "spinner-metre", "png", true);
        this.textures["spinnerCircle"] = await OsuTexture.fromFiles(this.directory, "spinner-circle", "png", true);
        this.textures["spinnerApproachCircle"] = await OsuTexture.fromFiles(this.directory, "spinner-approachcircle", "png", true);
        this.textures["spinnerRpm"] = await OsuTexture.fromFiles(this.directory, "spinner-rpm", "png", true);
        this.textures["spinnerSpin"] = await OsuTexture.fromFiles(this.directory, "spinner-spin", "png", true);
        this.textures["spinnerClear"] = await OsuTexture.fromFiles(this.directory, "spinner-clear", "png", true);

        // Follow points
        this.textures["followPoint"] = await OsuTexture.fromFiles(this.directory, "followpoint", "png", true, "followpoint-{n}");

        // Judgements
        this.textures["hit0"] = await OsuTexture.fromFiles(this.directory, "hit0", "png", true, "hit0-{n}");
        this.textures["hit50"] = await OsuTexture.fromFiles(this.directory, "hit50", "png", true, "hit50-{n}");
        this.textures["hit100"] = await OsuTexture.fromFiles(this.directory, "hit100", "png", true, "hit100-{n}");
        this.textures["hit100k"] = await OsuTexture.fromFiles(this.directory, "hit100k", "png", true, "hit100k-{n}");
        this.textures["hit300"] = await OsuTexture.fromFiles(this.directory, "hit300", "png", true, "hit300-{n}");
        this.textures["hit300k"] = await OsuTexture.fromFiles(this.directory, "hit300k", "png", true, "hit300k-{n}");
        this.textures["hit300g"] = await OsuTexture.fromFiles(this.directory, "hit300g", "png", true, "hit300g-{n}");
        this.textures["particle50"] = await OsuTexture.fromFiles(this.directory, "particle50", "png", true);
        this.textures["particle100"] = await OsuTexture.fromFiles(this.directory, "particle100", "png", true);
		this.textures["particle300"] = await OsuTexture.fromFiles(this.directory, "particle300", "png", true);
		this.textures["sliderPoint10"] = await OsuTexture.fromFiles(this.directory, "sliderpoint10", "png", true);
		this.textures["sliderPoint30"] = await OsuTexture.fromFiles(this.directory, "sliderpoint30", "png", true);

        // Scorebar
        this.textures["scorebarBackground"] = await OsuTexture.fromFiles(this.directory, "scorebar-bg", "png", true);
        this.textures["scorebarColor"] = await OsuTexture.fromFiles(this.directory, "scorebar-colour", "png", true, "scorebar-colour-{n}");
        this.textures["scorebarMarker"] = await OsuTexture.fromFiles(this.directory, "scorebar-marker", "png", true);
        this.textures["scorebarKi"] = await OsuTexture.fromFiles(this.directory, "scorebar-ki", "png", true);
        this.textures["scorebarKiDanger"] = await OsuTexture.fromFiles(this.directory, "scorebar-kidanger", "png", true);
        this.textures["scorebarKiDanger2"] = await OsuTexture.fromFiles(this.directory, "scorebar-kidanger2", "png", true);

        // Section fail/pass
        this.textures["sectionPass"] = await OsuTexture.fromFiles(this.directory, "section-pass", "png", true);
        this.textures["sectionFail"] = await OsuTexture.fromFiles(this.directory, "section-fail", "png", true);

        // Warning arrows
        this.textures["playWarningArrow"] = await OsuTexture.fromFiles(this.directory, "play-warningarrow", "png", true);
		this.textures["arrowWarning"] = await OsuTexture.fromFiles(this.directory, "arrow-warning", "png", true);
		
		// Skip button
		this.textures["playSkip"] = await OsuTexture.fromFiles(this.directory, "play-skip", "png", true, "play-skip-{n}");
        
        // Hit circle numbers
        this.hitCircleNumberTextures = {} as SpriteNumberTextures;
        for (let suffix of HIT_CIRCLE_NUMBER_SUFFIXES) {
            this.hitCircleNumberTextures[suffix as keyof SpriteNumberTextures] = await OsuTexture.fromFiles(this.directory, `${this.config.fonts.hitCirclePrefix}-${suffix}`, "png", true);
        }

        // Score numbers
        this.scoreNumberTextures = {} as SpriteNumberTextures;
        for (let suffix of SCORE_NUMBER_SUFFIXES) {
            this.scoreNumberTextures[suffix as keyof SpriteNumberTextures] = await OsuTexture.fromFiles(this.directory, `${this.config.fonts.scorePrefix}-${suffix}`, "png", true);
        }

        // Combo numbers
        this.comboNumberTextures = {} as SpriteNumberTextures;
        for (let suffix of SCORE_NUMBER_SUFFIXES) { // Combo uses the same suffixes as score
            this.comboNumberTextures[suffix as keyof SpriteNumberTextures] = await OsuTexture.fromFiles(this.directory, `${this.config.fonts.comboPrefix}-${suffix}`, "png", true);
		}
		
		if (!this.textures["sliderBall"].isEmpty()) {
			// "extras will not be added if a custom sliderb sprite is used"
			this.allowSliderBallExtras = false;
			// Note that if you still want extras, you just gotta set this property to true from outside.
		}
        
        /* Sounds */
        
        for (let key in OsuSoundType) {
            if (isNaN(Number(key))) continue;

            let type = Number(key) as OsuSoundType;
            let fileName = osuSoundFileNames.get(type);

            if (this.directory.networkFallbackUrl) {
                await this.directory.getFileByName(fileName + '.wav');
                await this.directory.getFileByName(fileName + '.mp3');
            }

            let osuSound = new OsuSound(this.directory, fileName);
            this.sounds[key] = osuSound;
		}
		
		if (readyAssets) await this.readyAssets();

        console.timeEnd("Skin init");
    }

    async readyAssets() {
		console.time("Hit sounds load");

        let osuSoundReadyPromises: Promise<void>[] = [];

        for (let key in this.sounds) {
			let osuSound = this.sounds[key];
            osuSoundReadyPromises.push(osuSound.ready());
        }

        await Promise.all(osuSoundReadyPromises);

        console.timeEnd("Hit sounds load");

        // All texture resources should have loaded now, so let's push them into VRAM:
        console.time("Texture upload to GPU");
        for (let key in this.textures) {
            this.textures[key].uploadToGpu();
        }
        console.timeEnd("Texture upload to GPU");
	}

    clone() {
        let newSkin = new Skin(this.directory);

        newSkin.config = this.config;
        newSkin.textures = shallowObjectClone(this.textures);
        newSkin.hitCircleNumberTextures = shallowObjectClone(this.hitCircleNumberTextures);
        newSkin.scoreNumberTextures = shallowObjectClone(this.scoreNumberTextures);
        newSkin.comboNumberTextures = shallowObjectClone(this.comboNumberTextures);
        newSkin.colors = this.colors.slice(0);
        newSkin.sounds = shallowObjectClone(this.sounds);

        return newSkin;
    }

    getVersionNumber() {
        if (this.config.general.version === 'latest') return CURRENT_LATEST_SKIN_VERSION;
        return this.config.general.version;
    }
}

export function joinSkins(skins: Skin[], joinTextures = true, joinHitSounds = true, useLastConfig = false) {
    assert(skins.length > 0);

	let baseSkin = skins[0].clone();

    for (let i = 1; i < skins.length; i++) {
        let skin = skins[i];

        if (joinTextures) {
            for (let key in skin.textures) {
                let tex = skin.textures[key];
                if (tex.isEmpty()) continue;
    
                baseSkin.textures[key] = tex;
            }
            for (let k in skin.hitCircleNumberTextures) {
                let key = k as keyof SpriteNumberTextures;
    
                let tex = skin.hitCircleNumberTextures[key];
                if (tex.isEmpty()) continue;
    
                baseSkin.hitCircleNumberTextures[key] = tex;
            }
            for (let k in skin.scoreNumberTextures) {
                let key = k as keyof SpriteNumberTextures;
    
                let tex = skin.scoreNumberTextures[key];
                if (tex.isEmpty()) continue;
    
                baseSkin.scoreNumberTextures[key] = tex;
            }
            for (let k in skin.comboNumberTextures) {
                let key = k as keyof SpriteNumberTextures;
    
                let tex = skin.comboNumberTextures[key];
                if (tex.isEmpty()) continue;
    
                baseSkin.comboNumberTextures[key] = tex;
            }
    
			if (!skin.hasDefaultConfig) baseSkin.colors = skin.colors.slice(0);
			
			if (!skin.allowSliderBallExtras) baseSkin.allowSliderBallExtras = false;

			// If the hit50 texture is present, strictly copy particle50
			if (!skin.textures["hit50"].isEmpty()) {
				baseSkin.textures["particle50"] = skin.textures["particle50"];
			}
			// If any hit100 texture is present, strictly copy particle100
			if (!skin.textures["hit100"].isEmpty() || !skin.textures["hit100k"].isEmpty()) {
				baseSkin.textures["particle100"] = skin.textures["particle100"];
			}
			// If any hit300 texture is present, strictly copy particle300
			if (!skin.textures["hit300"].isEmpty() || !skin.textures["hit300k"].isEmpty() || !skin.textures["hit300g"].isEmpty()) {
				baseSkin.textures["particle300"] = skin.textures["particle300"];
			}
			// If the scorebarColor texture is present, strictly copy scorebarMarker
			if (!skin.textures["scorebarColor"].isEmpty()) {
				baseSkin.textures["scorebarMarker"] = skin.textures["scorebarMarker"];
			}
        }

        if (joinHitSounds) {
            for (let key in skin.sounds) {
                let sound = skin.sounds[key];
                if (sound.isEmpty()) continue;
    
                baseSkin.sounds[key] = sound;
            }
        }
    }

	if (useLastConfig) baseSkin.config = last(skins).config;
    return baseSkin;
}