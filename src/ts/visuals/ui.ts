import { mainCanvas, renderer } from "./rendering";

const MAIN_BACKGROUND_IMAGE_CONTAINER: HTMLImageElement = document.querySelector('#mainBackgroundImage');

export function loadMainBackgroundImage(url: string) {
    MAIN_BACKGROUND_IMAGE_CONTAINER.src = url;
    MAIN_BACKGROUND_IMAGE_CONTAINER.style.opacity = "0.1";
}

function onResize() {
    let width = window.innerWidth,
        height = window.innerHeight;

    mainCanvas.setAttribute('width', String(width));
    mainCanvas.setAttribute('height', String(height));

    renderer.resize(width, height);
}
onResize();

window.addEventListener('resize', onResize);