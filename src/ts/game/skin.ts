import { fetchAsArrayBuffer } from "../util/network_util";
import { SpriteNumberTextures } from "../visuals/sprite_number";

export let hitCircleArrayBuffer: ArrayBuffer;
export let hitCircleImage: HTMLImageElement;
export let hitCircleTexture: PIXI.Texture;
export let hitCircleOverlayArrayBuffer: ArrayBuffer;
export let hitCircleOverlayImage: HTMLImageElement;
export let hitCircleOverlayTexture: PIXI.Texture;
export let approachCircleTexture: PIXI.Texture;
export let sliderBallTexture: PIXI.Texture;
export let followCircleTexture: PIXI.Texture;
export let reverseArrowTexture: PIXI.Texture;
export let digitTextures: SpriteNumberTextures;
export let sliderTickTexture: PIXI.Texture;
export let sliderEndCircleTexture = PIXI.Texture.EMPTY;
export let sliderEndCircleOverlayTexture = PIXI.Texture.EMPTY;

export async function initSkin() {
    hitCircleArrayBuffer = await fetchAsArrayBuffer("./assets/temp/hitcircle@2x.png");
    hitCircleOverlayArrayBuffer = await fetchAsArrayBuffer("./assets/temp/hitcircleoverlay@2x.png");
    approachCircleTexture = PIXI.Texture.from("./assets/temp/approachcircle.png")
    sliderBallTexture = PIXI.Texture.from("./assets/temp/sliderb@2x.png");
    followCircleTexture = PIXI.Texture.from("./assets/temp/sliderfollowcircle@2x.png");
    reverseArrowTexture = PIXI.Texture.from("./assets/temp/reversearrow@2x.png");
    sliderTickTexture = PIXI.Texture.from("./assets/temp/sliderscorepoint.png");

    let thang: any = {};
    for (let i = 0; i <= 9; i++) {
        let tex = PIXI.Texture.from(`./assets/temp/default-${i}@2x.png`);
        thang[i] = tex;
    }
    digitTextures = thang;

    hitCircleImage = document.createElement('img');
    hitCircleImage.src = URL.createObjectURL(new Blob([hitCircleArrayBuffer]));
    hitCircleTexture = PIXI.Texture.from(hitCircleImage);

    hitCircleOverlayImage = document.createElement('img');
    hitCircleOverlayImage.src = URL.createObjectURL(new Blob([hitCircleOverlayArrayBuffer]));
    hitCircleOverlayTexture = PIXI.Texture.from(hitCircleOverlayImage);
}