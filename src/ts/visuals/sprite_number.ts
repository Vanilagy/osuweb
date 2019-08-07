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
    dot?: PIXI.Texture,
    comma?: PIXI.Texture
}

export interface SpriteNumberOptions {
    textures: SpriteNumberTextures,
    horizontalAlign: "left" | "center" | "right",
    verticalAlign: "top" | "middle" | "bottom",
    digitHeight: number,
    overlap: number
}

export class SpriteNumber {
    public container: PIXI.Container;
    private options: SpriteNumberOptions;

    constructor(options: SpriteNumberOptions) {
        this.container = new PIXI.Container();
        this.options = options;

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
        let sprites: PIXI.Sprite[] = [];
        let str = num.toString();

        let totalWidth = 0;
        let overlapX = (this.options.overlap / 2) / UNSCALED_NUMBER_HEIGHT * this.options.digitHeight;

        for (let i = 0; i < str.length; i++) {
            let char = str.charAt(i);

            let weakTextures = this.options.textures as any;

            let texture = weakTextures[char];
            let sprite = new PIXI.Sprite(texture);

            let ratio = sprite.width / sprite.height;
            sprite.height = this.options.digitHeight;
            sprite.width = this.options.digitHeight * ratio;

            totalWidth += sprite.width;

            if (i > 0) {
                sprite.position.x += sprite.width * i;
                sprite.position.x -= overlapX;
                totalWidth -= overlapX;
            }

            sprites.push(sprite);
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

        this.container.removeChildren();
        this.container.addChild(...sprites);
    }
}