import { SpriteNumberTextures } from "../visuals/sprite_number";
import { VirtualDirectory } from "../file_system/virtual_directory";
import { VirtualFile } from "../file_system/virtual_file";
import { SkinConfiguration, DEFAULT_SKIN_CONFIG, parseSkinConfiguration } from "../datamodel/skin_configuration";
import { Dimensions } from "../util/graphics_util";

// This is all temp:
let currentSkinPath = "./assets/skins/default";
let currentSkinDirectory = new VirtualDirectory("root");
currentSkinDirectory.networkFallbackUrl = currentSkinPath;

const HIT_CIRCLE_NUMBER_SUFFIXES = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
const SCORE_NUMBER_SUFFIXES = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "comma", "dot", "percent", "x"];

export class OsuTexture {
    private sdBase: PIXI.Texture = null;
    private hdBase: PIXI.Texture = null;
    private sd: PIXI.Texture[] = [];
    private hd: PIXI.Texture[] = [];

    constructor() { }

    getBest(animationIndex?: number) {
        let hd = (animationIndex === undefined)? this.hdBase : (this.hd[animationIndex] || this.hdBase);
        if (hd) return hd;
        return ((animationIndex === undefined)? this.sdBase : (this.sd[animationIndex] || this.sdBase)) || null;
    }

    getWorst(animationIndex?: number) {
        let sd = (animationIndex === undefined)? this.sdBase : (this.sd[animationIndex] || this.sdBase);
        if (sd) return sd;
        return ((animationIndex === undefined)? this.hdBase : (this.hd[animationIndex] || this.hdBase)) || null;
    }

    getDynamic(size: number, animationIndex?: number) {
        let sd = (animationIndex === undefined)? this.hdBase : (this.hd[animationIndex] || this.hdBase),
            hd = (animationIndex === undefined)? this.sdBase : (this.sd[animationIndex] || this.sdBase);

        if (!sd && !hd) return null;
        if (!sd) return hd;
        if (!hd) return sd;

        if (size <= sd.width && size <= sd.height) return sd;
        else return hd;
    }

    /** Returns the width of the standard definition version. */
    getWidth() {
        let sd = this.sdBase;
        if (sd) return sd.width;
        let hd = this.hdBase;
        if (hd) return hd.width/2;
        
        return null;
    }

    /** Returns the height of the standard definition version. */
    getHeight() {
        let sd = this.sdBase;
        if (sd) return sd.height;
        let hd = this.hdBase;
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
                    if (i === 0 && !newOsuTexture.sdBase) newOsuTexture.sdBase = tex;
                }
                if (hdFile) {
                    let tex = PIXI.Texture.from(await hdFile.readAsResourceUrl());
                    newOsuTexture.hd.push(tex);
                    if (i === 0 && !newOsuTexture.hdBase) newOsuTexture.hdBase = tex;
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

    constructor(directory: VirtualDirectory) {
        this.directory = directory;
        this.textures = {};
        this.hitCircleNumberTextures = null;
        this.scoreNumberTextures = null;
        this.comboNumberTextures = null;
    }

    async init() {
        console.time("Skin init");

        let skinConfigurationFile = await this.directory.getFileByName("skin.ini") || await this.directory.getFileByName("Skin.ini");
        if (skinConfigurationFile) {
            this.config = parseSkinConfiguration(await skinConfigurationFile.readAsText());
        } else {
            this.config.general.version = "latest"; // If the skin.ini file is not present, latest will be used instead.
        }

        this.textures["hitCircle"] = await OsuTexture.fromFiles(this.directory, "hitcircle", "png", true);
        this.textures["hitCircleOverlay"] = await OsuTexture.fromFiles(this.directory, "hitcircleoverlay", "png", true, "hitcircleoverlay-{n}");
        this.textures["sliderStartCircle"] = await OsuTexture.fromFiles(this.directory, "sliderstartcircle", "png", true);
        this.textures["sliderStartCircleOverlay"] = await OsuTexture.fromFiles(this.directory, "sliderstartcircleoverlay", "png", true, "sliderstartcircleoverlay-{n}");
        this.textures["sliderEndCircle"] = await OsuTexture.fromFiles(this.directory, "sliderendcircle", "png", true);
        this.textures["sliderEndCircleOverlay"] = await OsuTexture.fromFiles(this.directory, "sliderendcircleoverlay", "png", true, "sliderendcircleoverlay-{n}");
        this.textures["approachCircle"] = await OsuTexture.fromFiles(this.directory, "approachcircle", "png", true);
        this.textures["sliderBall"] = await OsuTexture.fromFiles(this.directory, "sliderb", "png", true, "sliderb{n}"); // No hyphen
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
            tempObj[suffix] = await OsuTexture.fromFiles(this.directory, `${this.config.fonts.hitCirclePrefix}-${suffix}`, "png", true);
        }
        this.hitCircleNumberTextures = tempObj;

        // Score numbers
        tempObj = {};
        for (let suffix of SCORE_NUMBER_SUFFIXES) {
            tempObj[suffix] = await OsuTexture.fromFiles(this.directory, `${this.config.fonts.scorePrefix}-${suffix}`, "png", true);
        }
        this.scoreNumberTextures = tempObj;

        // Combo numbers
        tempObj = {};
        for (let suffix of SCORE_NUMBER_SUFFIXES) { // Combo uses the same suffixes as score
            tempObj[suffix] = await OsuTexture.fromFiles(this.directory, `${this.config.fonts.comboPrefix}-${suffix}`, "png", true);
        }
        this.comboNumberTextures = tempObj;

        console.timeEnd("Skin init");
    }

    async load() {
        await this.directory.loadShallow();
    }
}

export let currentSkin = new Skin(currentSkinDirectory);