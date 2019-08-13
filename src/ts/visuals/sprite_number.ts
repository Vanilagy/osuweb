import { UNSCALED_NUMBER_HEIGHT } from "../util/constants";

export interface SpriteNumberTextures {
    0: PIXI.Texture,
    1: PIXI.Texture,
    2: PIXI.Texture,
    3: PIXI.Texture,
    4: PIXI.Texture,
    5: PIXI.Texture,
    6: PIXI.Texture,
    7: PIXI.Texture,
    8: PIXI.Texture,
    9: PIXI.Texture,
    comma?: PIXI.Texture,
    dot?: PIXI.Texture,
    percent?: PIXI.Texture,
    x?: PIXI.Texture
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

        let textures: PIXI.Texture[] = [];
        for (let i = 0; i < str.length; i++) {
            let char = str.charAt(i);

            if (char === ".") {
                textures.push(this.options.textures.dot);
                continue;
            }

            let weakTextures = this.options.textures as any; // "weak" as in "not type-checked"
            let texture = weakTextures[char] as PIXI.Texture;

            textures.push(texture);
        }
        if (this.options.hasX) {
            textures.push(this.options.textures.x);
        }
        if (this.options.hasPercent) {
            textures.push(this.options.textures.percent);
        }

        // Add or remove sprites from the sprite pool
        if (textures.length < this.sprites.length) {
            while (textures.length !== this.sprites.length) {
                let last = this.sprites.pop();

                this.container.removeChild(last);
            }
        } else if (textures.length > this.sprites.length) {
            while (textures.length !== this.sprites.length) {
                let newSprite = new PIXI.Sprite();

                this.sprites.push(newSprite);
                this.container.addChild(newSprite);
            }
        }

        let totalWidth = 0;
        let currentX = 0;
        let overlapX = (this.options.overlap / 2) / UNSCALED_NUMBER_HEIGHT * this.options.digitHeight;
        
        for (let i = 0; i < textures.length; i++) {
            let texture = textures[i];

            let sprite = this.sprites[i];
            sprite.texture = texture;
            sprite.height = this.options.digitHeight;

            if (texture === this.options.textures.x || texture === this.options.textures.percent) {
                // These values are completely eyeballed. Is this fine, though?

                sprite.position.y = this.options.digitHeight * 0.05;
                sprite.height *= 0.83;
                
            } else {
                sprite.position.y = 0;
            }
        
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