import { fetchAsArrayBuffer } from "../util/network_util";

export let hitCircleArrayBuffer: ArrayBuffer;
export let hitCircleImage: HTMLImageElement;
export let hitCircleOverlayArrayBuffer: ArrayBuffer;
export let hitCircleOverlayImage: HTMLImageElement;
export let approachCircleTexture: PIXI.Texture;

export async function initSkin() {
    hitCircleArrayBuffer = await fetchAsArrayBuffer("./assets/temp/hitcircle@2x.png");
    hitCircleOverlayArrayBuffer = await fetchAsArrayBuffer("./assets/temp/hitcircleoverlay@2x.png");
    approachCircleTexture = PIXI.Texture.from("./assets/temp/approachcircle.png")

    hitCircleImage = document.createElement('img');
    hitCircleImage.src = URL.createObjectURL(new Blob([hitCircleArrayBuffer]));

    hitCircleOverlayImage = document.createElement('img');
    hitCircleOverlayImage.src = URL.createObjectURL(new Blob([hitCircleOverlayArrayBuffer]));
}