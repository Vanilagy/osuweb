import { UNSCALED_NUMBER_HEIGHT } from "../util/constants";
import { OsuTexture } from "../game/skin";

export interface SpriteNumberTextures {
    0: OsuTexture,
    1: OsuTexture,
    2: OsuTexture,
    3: OsuTexture,
    4: OsuTexture,
    5: OsuTexture,
    6: OsuTexture,
    7: OsuTexture,
    8: OsuTexture,
    9: OsuTexture,
    comma?: OsuTexture,
    dot?: OsuTexture,
    percent?: OsuTexture,
    x?: OsuTexture
}

export interface SpriteNumberOptions {
    textures: SpriteNumberTextures,
    horizontalAlign: "left" | "center" | "right",
    verticalAlign: "top" | "middle" | "bottom",
    digitHeight: number,
    overlap: number,
    leftPad?: number,
    fixedDecimals?: number,
    hasX?: boolean // append the "x" sprite,
    hasPercent?: boolean // append the "percent" sprite
}

export class SpriteNumber {
    public container: PIXI.Container;
    private options: SpriteNumberOptions;
    private sprites: PIXI.Sprite[];

    constructor(options: SpriteNumberOptions) {
        this.options = options;
        if (this.options.leftPad === undefined) this.options.leftPad = 0;

        this.container = new PIXI.Container();
        this.sprites = [];

        switch (this.options.verticalAlign) {
            case "top": {
                this.container.pivot.y = 0;
            }; break;
            case "middle": {
                this.container.pivot.y = this.options.digitHeight/2;
            }; break;
            case "bottom": {
                this.container.pivot.y = this.options.digitHeight;
            }; break;
        }
    }

    setValue(num: number) {
        let str: string;
        if (this.options.fixedDecimals !== undefined) {
            str = num.toFixed(this.options.fixedDecimals);
        } else {
            str = num.toString();
        }

        if (this.options.leftPad) {
            let nonDecimalLength = Math.floor(num).toString().length;

            if (this.options.leftPad > nonDecimalLength) {
                str = "0000000000000000000000000000".slice(0, this.options.leftPad - nonDecimalLength) + str;
            }
        }

        let osuTextures: OsuTexture[] = [];
        for (let i = 0; i < str.length; i++) {
            let char = str.charAt(i);

            if (char === ".") {
                osuTextures.push(this.options.textures.dot);
                continue;
            }

            let weakTextures = this.options.textures as any; // "weak" as in "not type-checked"
            let texture = weakTextures[char] as OsuTexture;

            osuTextures.push(texture);
        }
        if (this.options.hasX) {
            osuTextures.push(this.options.textures.x);
        }
        if (this.options.hasPercent) {
            osuTextures.push(this.options.textures.percent);
        }

        // Add or remove sprites from the sprite pool
        if (osuTextures.length < this.sprites.length) {
            while (osuTextures.length !== this.sprites.length) {
                let last = this.sprites.pop();

                this.container.removeChild(last);
            }
        } else if (osuTextures.length > this.sprites.length) {
            while (osuTextures.length !== this.sprites.length) {
                let newSprite = new PIXI.Sprite();

                this.sprites.push(newSprite);
                this.container.addChild(newSprite);
            }
        }

        let totalWidth = 0;
        let currentX = 0;
        let overlapX = (this.options.overlap / 2) / UNSCALED_NUMBER_HEIGHT * this.options.digitHeight;
        
        let referenceHeight = osuTextures[0].getHeight(); // The height of the digit 0
        for (let i = 0; i < osuTextures.length; i++) {
            let osuTexture = osuTextures[i];
            let texture = osuTexture.getDynamic(this.options.digitHeight);

            let sprite = this.sprites[i];
            sprite.texture = texture;
            sprite.height = (osuTexture.getHeight() / referenceHeight) * this.options.digitHeight;
        
            let ratio = texture.width / texture.height;
            sprite.width = sprite.height * ratio;
            totalWidth += sprite.width;

            sprite.position.x = currentX;
            currentX += sprite.width - overlapX;
        }

        totalWidth -= (str.length - 1) * overlapX;

        switch (this.options.horizontalAlign) {
            case "left": {
                this.container.pivot.x = 0;
            }; break;
            case "center": {
                this.container.pivot.x = totalWidth/2;
            }; break;
            case "right": {
                this.container.pivot.x = totalWidth;
            }; break;
        }
    }
}