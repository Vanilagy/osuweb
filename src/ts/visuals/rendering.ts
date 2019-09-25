export const mainCanvas = document.querySelector('#mainCanvas') as HTMLCanvasElement;

const mainContext = mainCanvas.getContext('webgl2', {
    stencil: true,
    alpha: true,
    powerPreference: 'high-performance',
    desynchronized: true // Tells browser to send canvas data directly to the GPU. Breaks the FPS meter ;)
});

// PIXI.settings.CREATE_IMAGE_BITMAP = true; // ehh? good or not?

export let renderer = new PIXI.Renderer({
    width: window.innerWidth,
    height: window.innerHeight,
    context: mainContext,
    antialias: true
});
export let stage = new PIXI.Container();

(renderer.framebuffer as any).writeDepthTexture = true; // OKAY SO. WHAT THE FUCK. WHY IS THIS FALSE IN THE FIRST PLACE. Absolute hack. Don't know if this has any side-effects. Maybe it's how the renderer is created?

export function mainRender() {
    renderer.render(stage);
}

// TODO: Maybe disable PIXI GC?
export function uploadTexture(tex: PIXI.Texture) {
    renderer.texture.bind(tex, 15); // Use slot 15 for all texture uploaded in this way. While that means that only the last uploaded texture will still be bound, all uploaded textures still remain in video memory.
}

export let softwareCursor = new PIXI.Sprite(PIXI.Texture.from("./assets/img/cursor.png"));
softwareCursor.anchor.set(0.5, 0.5);
softwareCursor.visible = false;

let softwareCursorContainer = new PIXI.Container();
softwareCursorContainer.addChild(softwareCursor);

export let mainHitObjectContainer = new PIXI.Container();
export let approachCircleContainer = new PIXI.Container();
export let sliderBodyContainer = new PIXI.Container();
export let followPointContainer = new PIXI.Container();
export let scorePopupContainer = new PIXI.Container();
export let hudContainer = new PIXI.Container();

// The order of these is important, 'cause z-index 'n' stuff.
stage.addChild(scorePopupContainer);
stage.addChild(followPointContainer);
stage.addChild(sliderBodyContainer);
stage.addChild(mainHitObjectContainer);
stage.addChild(approachCircleContainer);
stage.addChild(hudContainer);
stage.addChild(softwareCursorContainer);