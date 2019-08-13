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
    leftPad?: number
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
        let str = num.toString();

        if (this.options.leftPad) {
            let nonDecimalLength = Math.floor(num).toString().length;

            if (this.options.leftPad > nonDecimalLength) {
                str = "0000000000000000000000000000".slice(0, this.options.leftPad - nonDecimalLength) + str;
            }
        }

        // Add or remove sprites from the sprite pool
        if (str.length < this.sprites.length) {
            while (str.length !== this.sprites.length) {
                let last = this.sprites.pop();

                this.container.removeChild(last);
            }
        } else if (str.length > this.sprites.length) {
            while (str.length !== this.sprites.length) {
                let newSprite = new PIXI.Sprite();

                this.sprites.push(newSprite);
                this.container.addChild(newSprite);
            }
        }

        let totalWidth = 0;
        let overlapX = (this.options.overlap / 2) / UNSCALED_NUMBER_HEIGHT * this.options.digitHeight;

        for (let i = 0; i < str.length; i++) {
            let char = str.charAt(i);
            let weakTextures = this.options.textures as any; // "weak" as in "not type-checked"
            let texture = weakTextures[char] as PIXI.Texture;

            let sprite = this.sprites[i];
            sprite.texture = texture;
            sprite.height = this.options.digitHeight;
        
            let ratio = texture.width / texture.height;
            sprite.width = this.options.digitHeight * ratio;
            totalWidth += sprite.width - overlapX;

            sprite.position.x = (sprite.width - overlapX) * i;
        }

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