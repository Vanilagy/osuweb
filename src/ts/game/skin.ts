import { SpriteNumberTextures } from "../visuals/sprite_number";
import { VirtualDirectory } from "../file_system/virtual_directory";
import { VirtualFile } from "../file_system/virtual_file";
import { SkinConfiguration, DEFAULT_SKIN_CONFIG, parseSkinConfiguration } from "../datamodel/skin_configuration";

// This is all temp:
let currentSkinPath = "./assets/current_skin/";
let currentSkinDirectory = new VirtualDirectory("root");

const HIT_CIRCLE_NUMBER_SUFFIXES = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
const SCORE_NUMBER_SUFFIXES = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "comma", "dot", "percent", "x"];

let wantedFiles = ["skin.ini", "hitcircle@2x.png", "hitcircleoverlay@2x.png", "approachcircle.png", "sliderb@2x.png", "sliderfollowcircle@2x.png", "reversearrow@2x.png", "sliderscorepoint.png"];
for (let suffix of HIT_CIRCLE_NUMBER_SUFFIXES) {
    wantedFiles.push(`default-${suffix}@2x.png`);
}
for (let suffix of SCORE_NUMBER_SUFFIXES) {
    wantedFiles.push(`score-${suffix}@2x.png`);
}

wantedFiles.forEach((fileName) => {
    currentSkinDirectory.addEntry(VirtualFile.fromUrl(currentSkinPath + fileName, fileName));
});

export class Skin {
    private directory: VirtualDirectory;
    public config: SkinConfiguration = DEFAULT_SKIN_CONFIG;
    public textures: { [name: string]: PIXI.Texture };
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
        await this.load();

        let skinConfigurationFile = this.directory.getFileByName("skin.ini") || this.directory.getFileByName("Skin.ini");
        if (skinConfigurationFile) {
            this.config = parseSkinConfiguration(await skinConfigurationFile.readAsText());
        } else {
            this.config.general.version = "latest"; // If the skin.ini file is not present, latest will be used instead.
        }

        this.textures["hitCircle"] = PIXI.Texture.from(await this.directory.getFileByName("hitcircle@2x.png").readAsResourceUrl());
        this.textures["hitCircleOverlay"] = PIXI.Texture.from(await this.directory.getFileByName("hitcircleoverlay@2x.png").readAsResourceUrl());
        this.textures["approachCircle"] = PIXI.Texture.from(await this.directory.getFileByName("approachcircle.png").readAsResourceUrl());
        this.textures["sliderBall"] = PIXI.Texture.from(await this.directory.getFileByName("sliderb@2x.png").readAsResourceUrl());
        this.textures["followCircle"] = PIXI.Texture.from(await this.directory.getFileByName("sliderfollowcircle@2x.png").readAsResourceUrl());
        this.textures["reverseArrow"] = PIXI.Texture.from(await this.directory.getFileByName("reversearrow@2x.png").readAsResourceUrl());
        this.textures["sliderTick"] = PIXI.Texture.from(await this.directory.getFileByName("sliderscorepoint.png").readAsResourceUrl());
        this.textures["sliderEndCircle"] = PIXI.Texture.EMPTY;
        this.textures["sliderEndCircleOverlay"] = PIXI.Texture.EMPTY;

        // Hit circle numbers
        let tempObj: any = {};
        for (let suffix of HIT_CIRCLE_NUMBER_SUFFIXES) {
            let tex: PIXI.Texture;
            let file = this.directory.getFileByName(`${this.config.fonts.hitCirclePrefix}-${suffix}@2x.png`);
            if (file) {
                tex = PIXI.Texture.from(await file.readAsResourceUrl());
            } else {
                tex = PIXI.Texture.EMPTY;
            }

            tempObj[suffix] = tex;
        }
        this.hitCircleNumberTextures = tempObj;

        // Score numbers
        tempObj = {};
        for (let suffix of SCORE_NUMBER_SUFFIXES) {
            let tex: PIXI.Texture;
            let file = this.directory.getFileByName(`${this.config.fonts.scorePrefix}-${suffix}@2x.png`);
            if (file) {
                tex = PIXI.Texture.from(await file.readAsResourceUrl());
            } else {
                tex = PIXI.Texture.EMPTY;
            }
            
            tempObj[suffix] = tex;
        }
        this.scoreNumberTextures = tempObj;

        // Combo numbers
        tempObj = {};
        for (let suffix of SCORE_NUMBER_SUFFIXES) { // Uses the same suffixes as score
            let tex: PIXI.Texture;
            let file = this.directory.getFileByName(`${this.config.fonts.comboPrefix}-${suffix}@2x.png`);
            if (file) {
                tex = PIXI.Texture.from(await file.readAsResourceUrl());
            } else {
                tex = PIXI.Texture.EMPTY;
            }
            
            tempObj[suffix] = tex;
        }
        this.comboNumberTextures = tempObj;
    }

    async load() {
        await this.directory.loadShallow();
    }
}

export let currentSkin = new Skin(currentSkinDirectory);