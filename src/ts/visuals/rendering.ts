export const mainCanvas = document.querySelector('#mainCanvas') as HTMLCanvasElement;

const mainContext = mainCanvas.getContext('webgl2', {
    stencil: true,
    alpha: true,
    powerPreference: 'high-performance',
    desynchronized: true // Tells browser to send canvas data directly to the GPU. Breaks the FPS meter ;)
});

export let renderer = new PIXI.Renderer({
    width: window.innerWidth,
    height: window.innerHeight,
    context: mainContext,
    antialias: false
});
export let stage = new PIXI.Container();

export function mainRender() {
    renderer.render(stage);
}

// TODO: Maybe disable PIXI GC?
export function uploadTexture(tex: PIXI.Texture) {
    renderer.texture.bind(tex, 15); // Use slot 15 for all texture uploaded in this way. While that means that only the last uploaded texture will still be bound, all uploaded textures still remain in video memory.
}

export let mainHitObjectContainer = new PIXI.Container();
export let approachCircleContainer = new PIXI.Container();
export let followPointContainer = new PIXI.Container();
export let scorePopupContainer = new PIXI.Container();
export let hudContainer = new PIXI.Container();

// The order of these is important, 'cause z-index 'n' stuff.
stage.addChild(scorePopupContainer);
stage.addChild(followPointContainer);
stage.addChild(mainHitObjectContainer);
stage.addChild(approachCircleContainer);
stage.addChild(hudContainer);