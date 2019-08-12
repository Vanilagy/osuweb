import { SpriteNumberTextures, SpriteNumber } from "../visuals/sprite_number";
import { VirtualDirectory } from "../file_system/virtual_directory";
import { VirtualFile } from "../file_system/virtual_file";

// This is all temp:
let currentSkinPath = "./assets/current_skin/";
let currentSkinDirectory = new VirtualDirectory("root");

let wantedFiles = ["hitcircle@2x.png", "hitcircleoverlay@2x.png", "approachcircle.png", "sliderb@2x.png", "sliderfollowcircle@2x.png", "reversearrow@2x.png", "sliderscorepoint.png"];
for (let i = 0; i <= 9; i++) {
    wantedFiles.push(`default-${i}@2x.png`);
}

wantedFiles.forEach((fileName) => {
    currentSkinDirectory.addEntry(VirtualFile.fromUrl(currentSkinPath + fileName, fileName));
});

export class Skin {
    private directory: VirtualDirectory;
    public textures: { [name: string]: PIXI.Texture };
    public defaultDigitTextures: SpriteNumberTextures;

    constructor(directory: VirtualDirectory) {
        this.directory = directory;
        this.textures = {};
        this.defaultDigitTextures = null;
    }

    async init() {
        await this.load();

        this.textures["hitCircle"] = PIXI.Texture.from(await this.directory.getFileByName("hitcircle@2x.png").readAsResourceUrl());
        this.textures["hitCircleOverlay"] = PIXI.Texture.from(await this.directory.getFileByName("hitcircleoverlay@2x.png").readAsResourceUrl());
        this.textures["approachCircle"] = PIXI.Texture.from(await this.directory.getFileByName("approachcircle.png").readAsResourceUrl());
        this.textures["sliderBall"] = PIXI.Texture.from(await this.directory.getFileByName("sliderb@2x.png").readAsResourceUrl());
        this.textures["followCircle"] = PIXI.Texture.from(await this.directory.getFileByName("sliderfollowcircle@2x.png").readAsResourceUrl());
        this.textures["reverseArrow"] = PIXI.Texture.from(await this.directory.getFileByName("reversearrow@2x.png").readAsResourceUrl());
        this.textures["sliderTick"] = PIXI.Texture.from(await this.directory.getFileByName("sliderscorepoint.png").readAsResourceUrl());
        this.textures["sliderEndCircle"] = PIXI.Texture.EMPTY;
        this.textures["sliderEndCircleOverlay"] = PIXI.Texture.EMPTY;

        let thang: any = {};
        for (let i = 0; i <= 9; i++) {
            let tex = PIXI.Texture.from(await this.directory.getFileByName(`default-${i}@2x.png`).readAsResourceUrl());
            thang[i] = tex;
        }
        this.defaultDigitTextures = thang;
    }

    async load() {
        await this.directory.loadShallow();
    }
}

export let currentSkin = new Skin(currentSkinDirectory);