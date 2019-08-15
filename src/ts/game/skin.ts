import { SpriteNumberTextures } from "../visuals/sprite_number";
import { VirtualDirectory } from "../file_system/virtual_directory";
import { VirtualFile } from "../file_system/virtual_file";
import { SkinConfiguration, DEFAULT_SKIN_CONFIG, parseSkinConfiguration } from "../datamodel/skin_configuration";
import { Dimensions, Color } from "../util/graphics_util";

// This is all temp:
let currentSkinPath = "./assets/skins/default";
let currentSkinDirectory = new VirtualDirectory("root");
currentSkinDirectory.networkFallbackUrl = currentSkinPath;

export const IGNORE_BEATMAP_SKIN = true;
const HIT_CIRCLE_NUMBER_SUFFIXES = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
const SCORE_NUMBER_SUFFIXES = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "comma", "dot", "percent", "x"];
export const DEFAULT_COLORS: Color[] = [{r: 255, g: 192, b: 0}, {r: 0, g: 202, b: 0}, {r: 18, g: 124, b: 255}, {r: 242, g: 24, b: 57}];

export class OsuTexture {
    private sdBase: PIXI.Texture = null;
    private hdBase: PIXI.Texture = null;
    private sd: PIXI.Texture[] = [];
    private hd: PIXI.Texture[] = [];

    constructor() { }

    hasActualSdBase() {
        return this.sdBase !== null;
    }

    hasActualHdBase() {
        return this.hdBase !== null;
    }

    hasActualBase() {
        return this.hasActualSdBase() || this.hasActualHdBase();
    }

    getActualSdBase() {
        return this.sdBase;
    }

    getActualHdBase() {
        return this.hdBase;
    }

    /** If the texture doesn't have a base, fall back to the first frame of the animation */
    getDeFactoSdBase() {
        return this.sdBase || this.sd[0] || null;
    }

    /** If the texture doesn't have a base, fall back to the first frame of the animation */
    getDeFactoHdBase() {
        return this.hdBase || this.hd[0] || null;
    }

    getAnimationFrameCount() {
        return Math.max(this.sd.length, this.hd.length) || 1;
    }

    getBest(animationIndex?: number) {
        let hd = (animationIndex === undefined)? this.getDeFactoHdBase() : (this.hd[animationIndex] || this.hdBase);
        if (hd) return hd;
        return ((animationIndex === undefined)? this.getDeFactoSdBase() : (this.sd[animationIndex] || this.sdBase)) || null;
    }

    getWorst(animationIndex?: number) {
        let sd = (animationIndex === undefined)? this.getDeFactoSdBase() : (this.sd[animationIndex] || this.sdBase);
        if (sd) return sd;
        return ((animationIndex === undefined)? this.getDeFactoHdBase() : (this.hd[animationIndex] || this.hdBase)) || null;
    }

    getDynamic(size: number, animationIndex?: number) {
        let sd = (animationIndex === undefined)? this.getDeFactoSdBase() : (this.sd[animationIndex] || this.sdBase),
            hd = (animationIndex === undefined)? this.getDeFactoHdBase() : (this.hd[animationIndex] || this.hdBase);

        if (!sd && !hd) return null;
        if (!sd) return hd;
        if (!hd) return sd;

        if (size <= sd.width && size <= sd.height) return sd;
        else return hd;
    }

    /** Returns the width of the standard definition version. */
    getWidth() {
        let sd = this.getDeFactoSdBase();
        if (sd) return sd.width;
        let hd = this.getDeFactoHdBase();
        if (hd) return hd.width/2;
        
        return null;
    }

    /** Returns the height of the standard definition version. */
    getHeight() {
        let sd = this.getDeFactoSdBase();
        if (sd) return sd.height;
        let hd = this.getDeFactoHdBase();
        if (hd) return hd.height/2;
        
        return null;
    }

    getBiggestDimension() {
        return Math.max(this.getWidth(), this.getHeight());
    }

    getDownsizedDimensions(maxDimension: number): Dimensions {
        let width = this.getWidth(), height = this.getHeight();
        let ratio = width/height;

        if (width > height) {
            return {
                width: maxDimension,
                height: maxDimension / ratio
            };
        } else {
            return {
                width: maxDimension * ratio,
                height: maxDimension
            };
        }
    }

    static async fromFiles(directory: VirtualDirectory, name: string, extension: string, hd = false, animationName: string = null) {
        let newOsuTexture = new OsuTexture();

        let sdBaseFile = await directory.getFileByName(`${name}.${extension}`);
        let hdBaseFile: VirtualFile;
        if (hd) hdBaseFile = await directory.getFileByName(`${name}@2x.${extension}`);

        if (sdBaseFile) newOsuTexture.sdBase = PIXI.Texture.from(await sdBaseFile.readAsResourceUrl());
        if (hdBaseFile) newOsuTexture.hdBase = PIXI.Texture.from(await hdBaseFile.readAsResourceUrl());

        if (animationName) {
            let i = 0;

            while (true) {
                let name = animationName.replace("{n}", i.toString());

                let sdFile = await directory.getFileByName(`${name}.${extension}`);
                let hdFile: VirtualFile;
                if (hd) hdFile = await directory.getFileByName(`${name}@2x.${extension}`);

                if (!sdFile && !hdFile) break; // No more animation states

                if (sdFile) {
                    let tex = PIXI.Texture.from(await sdFile.readAsResourceUrl());
                    newOsuTexture.sd.push(tex);
                    //if (i === 0 && !newOsuTexture.sdBase) newOsuTexture.sdBase = tex;
                }
                if (hdFile) {
                    let tex = PIXI.Texture.from(await hdFile.readAsResourceUrl());
                    newOsuTexture.hd.push(tex);
                    //if (i === 0 && !newOsuTexture.hdBase) newOsuTexture.hdBase = tex;
                }

                i++;
            }
        }

        return newOsuTexture;
    }
}

export class Skin {
    private directory: VirtualDirectory;
    public config: SkinConfiguration = DEFAULT_SKIN_CONFIG;
    public textures: { [name: string]: OsuTexture };
    public hitCircleNumberTextures: SpriteNumberTextures;
    public scoreNumberTextures: SpriteNumberTextures;
    public comboNumberTextures: SpriteNumberTextures;
    public colors: Color[];

    constructor(directory: VirtualDirectory) {
        this.directory = directory;
        this.textures = {};
        this.hitCircleNumberTextures = null;
        this.scoreNumberTextures = null;
        this.comboNumberTextures = null;
        this.colors = [];
    }

    async init() {
        console.time("Skin init");

        let skinConfigurationFile = await this.directory.getFileByName("skin.ini") || await this.directory.getFileByName("Skin.ini");
        if (skinConfigurationFile) {
            this.config = parseSkinConfiguration(await skinConfigurationFile.readAsText());
        } else {
            this.config.general.version = "latest"; // If the skin.ini file is not present, latest will be used instead.
        }

        for (let i = 1; i <= 8; i++) {
            let color = this.config.colors[("combo" + i) as keyof SkinConfiguration["colors"]];
            if (color === null) break;

            this.colors.push(color);
        }

        this.textures["hitCircle"] = await OsuTexture.fromFiles(this.directory, "hitcircle", "png", true);
        this.textures["hitCircleOverlay"] = await OsuTexture.fromFiles(this.directory, "hitcircleoverlay", "png", true, "hitcircleoverlay-{n}");
        this.textures["sliderStartCircle"] = await OsuTexture.fromFiles(this.directory, "sliderstartcircle", "png", true);
        this.textures["sliderStartCircleOverlay"] = await OsuTexture.fromFiles(this.directory, "sliderstartcircleoverlay", "png", true, "sliderstartcircleoverlay-{n}");
        this.textures["sliderEndCircle"] = await OsuTexture.fromFiles(this.directory, "sliderendcircle", "png", true);
        this.textures["sliderEndCircleOverlay"] = await OsuTexture.fromFiles(this.directory, "sliderendcircleoverlay", "png", true, "sliderendcircleoverlay-{n}");
        this.textures["approachCircle"] = await OsuTexture.fromFiles(this.directory, "approachcircle", "png", true);
        this.textures["sliderBall"] = await OsuTexture.fromFiles(this.directory, "sliderb", "png", true, "sliderb{n}"); // No hyphen
        this.textures["sliderBallBg"] = await OsuTexture.fromFiles(this.directory, "sliderb-nd", "png", false);
        this.textures["sliderBallSpec"] = await OsuTexture.fromFiles(this.directory, "sliderb-spec", "png", false);
        this.textures["followCircle"] = await OsuTexture.fromFiles(this.directory, "sliderfollowcircle", "png", true, "sliderfollowcircle-{n}");
        this.textures["reverseArrow"] = await OsuTexture.fromFiles(this.directory, "reversearrow", "png", true);
        this.textures["sliderTick"] = await OsuTexture.fromFiles(this.directory, "sliderscorepoint", "png", true);
        this.textures["hitCircle"] = await OsuTexture.fromFiles(this.directory, "hitcircle", "png", true);
        this.textures["hit0"] = await OsuTexture.fromFiles(this.directory, "hit0", "png", true, "hit0-{n}");
        this.textures["hit50"] = await OsuTexture.fromFiles(this.directory, "hit50", "png", true, "hit50-{n}");
        this.textures["hit100"] = await OsuTexture.fromFiles(this.directory, "hit100", "png", true, "hit100-{n}");
        this.textures["hit100k"] = await OsuTexture.fromFiles(this.directory, "hit100k", "png", true, "hit100k-{n}");
        this.textures["hit300"] = await OsuTexture.fromFiles(this.directory, "hit300", "png", true, "hit300-{n}");
        this.textures["hit300k"] = await OsuTexture.fromFiles(this.directory, "hit300k", "png", true, "hit300k-{n}");
        this.textures["hit300g"] = await OsuTexture.fromFiles(this.directory, "hit300g", "png", true, "hit300g-{n}");

        // Hit circle numbers
        let tempObj: any = {};
        for (let suffix of HIT_CIRCLE_NUMBER_SUFFIXES) {
            tempObj[suffix as keyof SpriteNumberTextures] = await OsuTexture.fromFiles(this.directory, `${this.config.fonts.hitCirclePrefix}-${suffix}`, "png", true);
        }
        this.hitCircleNumberTextures = tempObj;

        // Score numbers
        tempObj = {};
        for (let suffix of SCORE_NUMBER_SUFFIXES) {
            tempObj[suffix as keyof SpriteNumberTextures] = await OsuTexture.fromFiles(this.directory, `${this.config.fonts.scorePrefix}-${suffix}`, "png", true);
        }
        this.scoreNumberTextures = tempObj;

        // Combo numbers
        tempObj = {};
        for (let suffix of SCORE_NUMBER_SUFFIXES) { // Combo uses the same suffixes as score
            tempObj[suffix as keyof SpriteNumberTextures] = await OsuTexture.fromFiles(this.directory, `${this.config.fonts.comboPrefix}-${suffix}`, "png", true);
        }
        this.comboNumberTextures = tempObj;

        console.timeEnd("Skin init");
    }

    async load() {
        await this.directory.loadShallow();
    }
}

export let currentSkin = new Skin(currentSkinDirectory);