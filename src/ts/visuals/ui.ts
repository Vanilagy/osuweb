import { mainCanvas, renderer } from "./rendering";

function onResize() {
    let width = window.innerWidth,
        height = window.innerHeight;

    mainCanvas.setAttribute('width', String(width));
    mainCanvas.setAttribute('height', String(height));

    renderer.resize(width, height);
}
onResize();

window.addEventListener('resize', onResize);