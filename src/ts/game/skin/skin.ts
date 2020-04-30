import { SpriteNumberTextures } from "../../visuals/sprite_number";
import { VirtualDirectory } from "../../file_system/virtual_directory";
import { SkinConfiguration, DEFAULT_SKIN_CONFIG, parseSkinConfiguration } from "../../datamodel/skin_configuration";
import { Color } from "../../util/graphics_util";
import { assert, jsonClone, shallowObjectClone, last, retryUntil } from "../../util/misc_util";
import { OsuTexture } from "./texture";
import { HitSound, HitSoundType, hitSoundFilenames } from "./hit_sound";
import { AudioPlayer } from "../../audio/audio_player";
import { AudioUtil } from "../../util/audio_util";
import { soundEffectsNode } from "../../audio/audio";

export const IGNORE_BEATMAP_SKIN = true;
export const IGNORE_BEATMAP_SOUNDS = true;
const HIT_CIRCLE_NUMBER_SUFFIXES = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
const SCORE_NUMBER_SUFFIXES = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "comma", "dot", "percent", "x"];
export const DEFAULT_COLORS: Color[] = [{r: 255, g: 192, b: 0}, {r: 0, g: 202, b: 0}, {r: 18, g: 124, b: 255}, {r: 242, g: 24, b: 57}];
const CURRENT_LATEST_SKIN_VERSION = 2.5;

export enum SkinSoundType {
	SpinnerSpin,
	SpinnerBonus,
	ComboBreak,
	SectionPass,
	SectionFail,
	PauseLoop,
	Applause,
	FailSound,
	NightcoreKick,
	NightcoreClap,
	NightcoreHat,
	NightcoreFinish
}

export class Skin {
	public directory: VirtualDirectory;
	public parentDirectories: VirtualDirectory[] = [];
    public config: SkinConfiguration;
    public hasDefaultConfig: boolean;
    public textures: { [name: string]: OsuTexture };
    public hitCircleNumberTextures: SpriteNumberTextures;
    public scoreNumberTextures: SpriteNumberTextures;
    public comboNumberTextures: SpriteNumberTextures;
	public colors: Color[];
	public hitSounds: { [key in keyof typeof HitSoundType]?: HitSound };
	public sounds: { [key in keyof typeof SkinSoundType]?: AudioPlayer };
	/** Whether sliderBallBg and sliderBallSpec are shown. */
	public allowSliderBallExtras: boolean;

    constructor(directory: VirtualDirectory) {
        this.directory = directory;
        this.textures = {};
        this.hitCircleNumberTextures = null;
        this.scoreNumberTextures = null;
        this.comboNumberTextures = null;
        this.colors = [];
		this.hitSounds = {};
		this.sounds = {};
		this.allowSliderBallExtras = true;
	}

    async init(readyAssets = true) {
        console.time("Skin init");

        let skinConfigurationFile = await this.directory.getFileByPath("skin.ini") || await this.directory.getFileByPath("Skin.ini");
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
		
		let texturePromises: {[name: string]: Promise<OsuTexture>} = {};

        // Circles
        texturePromises["hitCircle"] = OsuTexture.fromFiles(this.directory, "hitcircle", "png", true);
        texturePromises["hitCircleOverlay"] = OsuTexture.fromFiles(this.directory, "hitcircleoverlay", "png", true, "hitcircleoverlay-{n}");
        texturePromises["approachCircle"] = OsuTexture.fromFiles(this.directory, "approachcircle", "png", true);

        // Sliders
        texturePromises["sliderStartCircle"] = OsuTexture.fromFiles(this.directory, "sliderstartcircle", "png", true);
        texturePromises["sliderStartCircleOverlay"] = OsuTexture.fromFiles(this.directory, "sliderstartcircleoverlay", "png", true, "sliderstartcircleoverlay-{n}");
        texturePromises["sliderEndCircle"] = OsuTexture.fromFiles(this.directory, "sliderendcircle", "png", true);
        texturePromises["sliderEndCircleOverlay"] = OsuTexture.fromFiles(this.directory, "sliderendcircleoverlay", "png", true, "sliderendcircleoverlay-{n}");
        texturePromises["sliderBall"] = OsuTexture.fromFiles(this.directory, "sliderb", "png", true, "sliderb{n}"); // No hyphen
        texturePromises["sliderBallBg"] = OsuTexture.fromFiles(this.directory, "sliderb-nd", "png", false);
        texturePromises["sliderBallSpec"] = OsuTexture.fromFiles(this.directory, "sliderb-spec", "png", false);
        texturePromises["followCircle"] = OsuTexture.fromFiles(this.directory, "sliderfollowcircle", "png", true, "sliderfollowcircle-{n}");
        texturePromises["reverseArrow"] = OsuTexture.fromFiles(this.directory, "reversearrow", "png", true);
        texturePromises["sliderTick"] = OsuTexture.fromFiles(this.directory, "sliderscorepoint", "png", true);

        // Spinners
        texturePromises["spinnerGlow"] = OsuTexture.fromFiles(this.directory, "spinner-glow", "png", true);
        texturePromises["spinnerBottom"] = OsuTexture.fromFiles(this.directory, "spinner-bottom", "png", true);
        texturePromises["spinnerTop"] = OsuTexture.fromFiles(this.directory, "spinner-top", "png", true);
        texturePromises["spinnerMiddle2"] = OsuTexture.fromFiles(this.directory, "spinner-middle2", "png", true);
        texturePromises["spinnerMiddle"] = OsuTexture.fromFiles(this.directory, "spinner-middle", "png", true);
        texturePromises["spinnerBackground"] = OsuTexture.fromFiles(this.directory, "spinner-background", "png", true);
        texturePromises["spinnerMeter"] = OsuTexture.fromFiles(this.directory, "spinner-metre", "png", true);
        texturePromises["spinnerCircle"] = OsuTexture.fromFiles(this.directory, "spinner-circle", "png", true);
        texturePromises["spinnerApproachCircle"] = OsuTexture.fromFiles(this.directory, "spinner-approachcircle", "png", true);
        texturePromises["spinnerRpm"] = OsuTexture.fromFiles(this.directory, "spinner-rpm", "png", true);
        texturePromises["spinnerSpin"] = OsuTexture.fromFiles(this.directory, "spinner-spin", "png", true);
        texturePromises["spinnerClear"] = OsuTexture.fromFiles(this.directory, "spinner-clear", "png", true);

        // Follow points
        texturePromises["followPoint"] = OsuTexture.fromFiles(this.directory, "followpoint", "png", true, "followpoint-{n}");

        // Judgements
        texturePromises["hit0"] = OsuTexture.fromFiles(this.directory, "hit0", "png", true, "hit0-{n}");
        texturePromises["hit50"] = OsuTexture.fromFiles(this.directory, "hit50", "png", true, "hit50-{n}");
        texturePromises["hit100"] = OsuTexture.fromFiles(this.directory, "hit100", "png", true, "hit100-{n}");
        texturePromises["hit100k"] = OsuTexture.fromFiles(this.directory, "hit100k", "png", true, "hit100k-{n}");
        texturePromises["hit300"] = OsuTexture.fromFiles(this.directory, "hit300", "png", true, "hit300-{n}");
        texturePromises["hit300k"] = OsuTexture.fromFiles(this.directory, "hit300k", "png", true, "hit300k-{n}");
        texturePromises["hit300g"] = OsuTexture.fromFiles(this.directory, "hit300g", "png", true, "hit300g-{n}");
        texturePromises["particle50"] = OsuTexture.fromFiles(this.directory, "particle50", "png", true);
        texturePromises["particle100"] = OsuTexture.fromFiles(this.directory, "particle100", "png", true);
		texturePromises["particle300"] = OsuTexture.fromFiles(this.directory, "particle300", "png", true);
		texturePromises["sliderPoint10"] = OsuTexture.fromFiles(this.directory, "sliderpoint10", "png", true);
		texturePromises["sliderPoint30"] = OsuTexture.fromFiles(this.directory, "sliderpoint30", "png", true);

        // Scorebar
        texturePromises["scorebarBackground"] = OsuTexture.fromFiles(this.directory, "scorebar-bg", "png", true);
        texturePromises["scorebarColor"] = OsuTexture.fromFiles(this.directory, "scorebar-colour", "png", true, "scorebar-colour-{n}");
        texturePromises["scorebarMarker"] = OsuTexture.fromFiles(this.directory, "scorebar-marker", "png", true);
        texturePromises["scorebarKi"] = OsuTexture.fromFiles(this.directory, "scorebar-ki", "png", true);
        texturePromises["scorebarKiDanger"] = OsuTexture.fromFiles(this.directory, "scorebar-kidanger", "png", true);
        texturePromises["scorebarKiDanger2"] = OsuTexture.fromFiles(this.directory, "scorebar-kidanger2", "png", true);

        // Section fail/pass
        texturePromises["sectionPass"] = OsuTexture.fromFiles(this.directory, "section-pass", "png", true);
        texturePromises["sectionFail"] = OsuTexture.fromFiles(this.directory, "section-fail", "png", true);

        // Warning arrows
        texturePromises["playWarningArrow"] = OsuTexture.fromFiles(this.directory, "play-warningarrow", "png", true);
		texturePromises["arrowWarning"] = OsuTexture.fromFiles(this.directory, "arrow-warning", "png", true);
		
		// Skip button
		texturePromises["playSkip"] = OsuTexture.fromFiles(this.directory, "play-skip", "png", true, "play-skip-{n}");

		let promises: Promise<OsuTexture>[] = [];
		for (let name in texturePromises) {
			promises.push(texturePromises[name]);
		}
		let results = await Promise.all(promises);

		let i = 0;
		for (let name in texturePromises) {
			this.textures[name] = results[i];
			i++;
		}
        
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
        
        for (let key in HitSoundType) {
            if (isNaN(Number(key))) continue;

            let type = Number(key) as HitSoundType;
            let filename = hitSoundFilenames.get(type);

            if (this.directory.networkFallbackUrl) {
                await this.directory.getFileByPath(filename + '.wav');
                await this.directory.getFileByPath(filename + '.mp3');
            }

            let hitSound = await HitSound.initFromFilename(this.directory, filename);
            this.hitSounds[key] = hitSound;
		}

		this.sounds[SkinSoundType.SpinnerSpin] = await AudioUtil.createSoundPlayerFromFilename(this.directory, "spinnerspin", "audioBufferPlayer", soundEffectsNode);
		this.sounds[SkinSoundType.SpinnerBonus] = await AudioUtil.createSoundPlayerFromFilename(this.directory, "spinnerbonus", "audioBufferPlayer", soundEffectsNode);
		this.sounds[SkinSoundType.ComboBreak] = await AudioUtil.createSoundPlayerFromFilename(this.directory, "combobreak", "audioBufferPlayer", soundEffectsNode);
		this.sounds[SkinSoundType.SectionPass] = await AudioUtil.createSoundPlayerFromFilename(this.directory, "sectionpass", "audioBufferPlayer", soundEffectsNode);
		this.sounds[SkinSoundType.SectionFail] = await AudioUtil.createSoundPlayerFromFilename(this.directory, "sectionfail", "audioBufferPlayer", soundEffectsNode);
		this.sounds[SkinSoundType.PauseLoop] = await AudioUtil.createSoundPlayerFromFilename(this.directory, "pause-loop", "audioBufferPlayer", soundEffectsNode);
		this.sounds[SkinSoundType.PauseLoop].setLoopState(true);
		this.sounds[SkinSoundType.Applause] = await AudioUtil.createSoundPlayerFromFilename(this.directory, "applause", "audioMediaPlayer", soundEffectsNode);
		this.sounds[SkinSoundType.FailSound] = await AudioUtil.createSoundPlayerFromFilename(this.directory, "failsound", "audioMediaPlayer", soundEffectsNode);
		this.sounds[SkinSoundType.NightcoreKick] = await AudioUtil.createSoundPlayerFromFilename(this.directory, "nightcore-kick", "audioBufferPlayer", soundEffectsNode);
		this.sounds[SkinSoundType.NightcoreClap] = await AudioUtil.createSoundPlayerFromFilename(this.directory, "nightcore-clap", "audioBufferPlayer", soundEffectsNode);
		this.sounds[SkinSoundType.NightcoreHat] = await AudioUtil.createSoundPlayerFromFilename(this.directory, "nightcore-hat", "audioBufferPlayer", soundEffectsNode);
		this.sounds[SkinSoundType.NightcoreFinish] = await AudioUtil.createSoundPlayerFromFilename(this.directory, "nightcore-finish", "audioBufferPlayer", soundEffectsNode);
		
		if (readyAssets) await this.readyAssets();

        console.timeEnd("Skin init");
    }

    async readyAssets() {
		console.time("Hit sounds load");

        let hitSoundReadyPromises: Promise<void>[] = [];

        for (let key in this.hitSounds) {
			let hitSound = this.hitSounds[key];
            hitSoundReadyPromises.push(hitSound.ready());
        }

        await Promise.all(hitSoundReadyPromises);

		console.timeEnd("Hit sounds load");

		// Wait until all textures assets have loaded
		await retryUntil(() => {
			for (let key in this.textures) {
				if (!this.textures[key].hasLoaded()) return false;
			}
			return true;
		});

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
		newSkin.hitSounds = shallowObjectClone(this.hitSounds);
		newSkin.sounds = shallowObjectClone(this.sounds);
		newSkin.allowSliderBallExtras = this.allowSliderBallExtras;

        return newSkin;
    }

    getVersionNumber() {
        if (this.config.general.version === 'latest') return CURRENT_LATEST_SKIN_VERSION;
        return this.config.general.version;
    }
}

export function joinSkins(skins: Skin[], joinTextures = true, joinSounds = true, useLastConfig = false) {
    assert(skins.length > 0);

	let baseSkin = skins[0].clone();
	let directories: VirtualDirectory[] = [];

    for (let i = 1; i < skins.length; i++) {
		let skin = skins[i];
		directories.unshift(skin.directory, ...skin.parentDirectories);

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

        if (joinSounds) {
            for (let key in skin.hitSounds) {
				let hitSound = skin.hitSounds[key];
                baseSkin.hitSounds[key] = baseSkin.hitSounds[key].joinWith(hitSound);
			}
			
			for (let key in skin.sounds) {
                let sounds = skin.sounds[key];
                if (sounds.isEmpty()) continue;
    
                baseSkin.sounds[key] = sounds;
            }
        }
    }

	if (useLastConfig) baseSkin.config = last(skins).config;
	baseSkin.parentDirectories = directories;

    return baseSkin;
}