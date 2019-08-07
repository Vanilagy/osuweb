import { fetchAsArrayBuffer } from "../util/network_util";

export let hitCircleArrayBuffer: ArrayBuffer;
export let hitCircleImage: HTMLImageElement;
export let hitCircleOverlayArrayBuffer: ArrayBuffer;
export let hitCircleOverlayImage: HTMLImageElement;
export let approachCircleTexture: PIXI.Texture;
export let sliderBallTexture: PIXI.Texture;
export let followCircleTexture: PIXI.Texture;
export let reverseArrowTexture: PIXI.Texture;

export async function initSkin() {
    hitCircleArrayBuffer = await fetchAsArrayBuffer("./assets/temp/hitcircle@2x.png");
    hitCircleOverlayArrayBuffer = await fetchAsArrayBuffer("./assets/temp/hitcircleoverlay@2x.png");
    approachCircleTexture = PIXI.Texture.from("./assets/temp/approachcircle.png")
    sliderBallTexture = PIXI.Texture.from("./assets/temp/sliderb@2x.png");
    followCircleTexture = PIXI.Texture.from("./assets/temp/sliderfollowcircle@2x.png");
    reverseArrowTexture = PIXI.Texture.from("./assets/temp/reversearrow@2x.png");

    hitCircleImage = document.createElement('img');
    hitCircleImage.src = URL.createObjectURL(new Blob([hitCircleArrayBuffer]));

    hitCircleOverlayImage = document.createElement('img');
    hitCircleOverlayImage.src = URL.createObjectURL(new Blob([hitCircleOverlayArrayBuffer]));
}