import { charIsDigit } from "../util/misc_util";
import { OsuTexture, OsuTextureResolution } from "../game/skin/texture";

export const USUAL_SCORE_DIGIT_HEIGHT = 46;

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
    scaleFactor: number,
    equalWidthDigits?: boolean,
    overlap: number,
    overlapAtEnd?: boolean,
    leftPad?: number,
    fixedDecimals?: number,
    hasX?: boolean // append the "x" sprite,
    hasPercent?: boolean // append the "percent" sprite
}

export class SpriteNumber {
    public container: PIXI.Container;
    private options: SpriteNumberOptions;
    private sprites: PIXI.Sprite[];
    private maxDigitWidth: number = 0;
    /** The resolution used for all sprites in the number. This is done so that we don't mix SD/HD for differently-sized textures. */
    private resolution: OsuTextureResolution = 'sd';
    public lastComputedWidth: number = null;
    public lastComputedHeight: number = null;

    constructor(options: SpriteNumberOptions) {
        this.options = options;
        if (this.options.leftPad === undefined) this.options.leftPad = 0;

        this.container = new PIXI.Container();
        this.sprites = [];

        for (let i = 0; i <= 9; i++) {
            let texture = this.options.textures[i as keyof SpriteNumberTextures];

            // If any texture would end up in HD with the current scaling factor, make all textures use HD.
            if (texture.getOptimalResolution(texture.getBiggestDimension(this.options.scaleFactor)) === 'hd') this.resolution = 'hd';
        }

        if (this.options.equalWidthDigits) {
            for (let i = 0; i <= 9; i++) {
                let texture = this.options.textures[i as keyof SpriteNumberTextures];

                // Find the width of the digit with the biggest width. We'll use that for spacing.
                this.maxDigitWidth = Math.max(this.maxDigitWidth, texture.getWidthForResolution(this.resolution));
            }

            this.maxDigitWidth = Math.floor(this.maxDigitWidth)
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

            let texture = this.options.textures[char as keyof SpriteNumberTextures];
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
        let totalHeight = 0;
        let currentX = 0;

        for (let i = 0; i < osuTextures.length; i++) {
            let isDigit = charIsDigit(str.charAt(i));

            let osuTexture = osuTextures[i];
            let texture = osuTexture.getForResolution(this.resolution);
            let textureWidth = osuTexture.getWidthForResolution(this.resolution);
            let textureHeight = osuTexture.getHeightForResolution(this.resolution);

            let sprite = this.sprites[i];

            sprite.texture = texture;
            sprite.width = Math.floor(textureWidth * this.options.scaleFactor);
            sprite.height = Math.floor(textureHeight * this.options.scaleFactor);

            totalHeight = Math.max(totalHeight, sprite.height);

            sprite.position.x = currentX;

            if (this.options.equalWidthDigits && isDigit) {
                sprite.position.x += (this.maxDigitWidth - textureWidth) / 2 * this.options.scaleFactor;
                currentX += (this.maxDigitWidth - this.options.overlap) * this.options.scaleFactor;
                totalWidth += this.maxDigitWidth * this.options.scaleFactor;
            } else {
                if (i === osuTextures.length-1 && this.options.hasPercent) {
                    textureWidth = osuTexture.getWidth(); // The percent width is always the width of the sd version. Aaaah. This code is the result of one long and annoying evening of trying shit out.
                }

                currentX += (Math.floor(textureWidth) - this.options.overlap) * this.options.scaleFactor;
                totalWidth += Math.floor(textureWidth) * this.options.scaleFactor;
            }

            sprite.position.x = Math.floor(sprite.position.x);
        }

        totalWidth -= (osuTextures.length - 1) * this.options.overlap * this.options.scaleFactor;

        // Add another overlap at the end, if specified
        if (this.options.overlapAtEnd) totalWidth -= this.options.overlap * this.options.scaleFactor;

        switch (this.options.horizontalAlign) {
            case "left": {
                this.container.pivot.x = 0;
            }; break;
            case "center": {
                this.container.pivot.x = Math.floor(totalWidth/2);
            }; break;
            case "right": {
                this.container.pivot.x = Math.floor(totalWidth);
            }; break;
        }

        switch (this.options.verticalAlign) {
            case "top": {
                this.container.pivot.y = 0;
            }; break;
            case "middle": {
                this.container.pivot.y = Math.floor(totalHeight/2);
            }; break;
            case "bottom": {
                this.container.pivot.y = Math.floor(totalHeight);
            }; break;
        }

        this.lastComputedWidth = totalWidth;
        this.lastComputedHeight = totalHeight;
    }
}