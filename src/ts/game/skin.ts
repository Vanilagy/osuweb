import { SpriteNumberTextures } from "../visuals/sprite_number";
import { VirtualDirectory } from "../file_system/virtual_directory";
import { VirtualFile } from "../file_system/virtual_file";
import { SkinConfiguration, DEFAULT_SKIN_CONFIG, parseSkinConfiguration } from "../datamodel/skin_configuration";

// This is all temp:
let currentSkinPath = "./assets/current_skin";
let currentSkinDirectory = new VirtualDirectory("root");
currentSkinDirectory.networkFallbackUrl = currentSkinPath;

const HIT_CIRCLE_NUMBER_SUFFIXES = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
const SCORE_NUMBER_SUFFIXES = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "comma", "dot", "percent", "x"];

export class OsuTexture {
    private sd: PIXI.Texture[] = [];
    private hd: PIXI.Texture[] = [];

    constructor() { }

    getBest(animationIndex = 0) {
        let hd = this.hd[animationIndex];
        if (hd) return hd;
        return this.sd[animationIndex] || null;
    }

    getWorst(animationIndex = 0) {
        let sd = this.sd[animationIndex];
        if (sd) return sd;
        return this.hd[animationIndex] || null;
    }

    getDynamic(size: number, animationIndex = 0) {
        let sd = this.sd[animationIndex],
            hd = this.hd[animationIndex];

        if (!sd && !hd) return null;
        if (!sd) return hd;
        if (!hd) return sd;

        if (size <= sd.width && size <= sd.height) return sd;
        else return hd;
    }

    /** Returns the width of the standard definition version. */
    getWidth() {
        let sd = this.sd[0];
        if (sd) return sd.width;
        let hd = this.hd[0];
        if (hd) return hd.width/2;
        
        return null;
    }

    /** Returns the height of the standard definition version. */
    getHeight() {
        let sd = this.sd[0];
        if (sd) return sd.height;
        let hd = this.hd[0];
        if (hd) return hd.height/2;
        
        return null;
    }

    static async fromFiles(directory: VirtualDirectory, name: string, extension: string, hd = false, animationName: string = null) {
        let newOsuTexture = new OsuTexture();

        let sdBaseFile = await directory.getFileByName(`${name}.${extension}`);
        let hdBaseFile: VirtualFile;
        if (hd) hdBaseFile = await directory.getFileByName(`${name}@2x.${extension}`);

        if (sdBaseFile) newOsuTexture.sd.push(PIXI.Texture.from(await sdBaseFile.readAsResourceUrl()));
        if (hdBaseFile) newOsuTexture.hd.push(PIXI.Texture.from(await hdBaseFile.readAsResourceUrl()));

        if (animationName && !sdBaseFile && !hdBaseFile) {
            let i = 0;

            while (true) {
                let name = animationName.replace("{n}", i.toString());

                let sdFile = await directory.getFileByName(`${name}.${extension}`);
                let hdFile: VirtualFile;
                if (hd) hdFile = await directory.getFileByName(`${name}@2x.${extension}`);

                if (!sdFile && !hdFile) break; // No more animation states

                if (sdFile) newOsuTexture.sd.push(PIXI.Texture.from(await sdFile.readAsResourceUrl()));
                if (hdFile) newOsuTexture.hd.push(PIXI.Texture.from(await sdFile.readAsResourceUrl()));

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