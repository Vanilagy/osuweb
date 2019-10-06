export const mainCanvas = document.querySelector('#mainCanvas') as HTMLCanvasElement;

const gl = mainCanvas.getContext('webgl2', {
    stencil: true,
    alpha: true,
    powerPreference: 'high-performance',
    desynchronized: true // Tells browser to send canvas data directly to the GPU. Breaks the FPS meter ;)
}) as WebGLRenderingContext; // Technically WebGL2, but idk. Rollup is complaining :S

export const MAX_TEXTURE_SIZE = gl.getParameter(gl.MAX_TEXTURE_SIZE);

PIXI.settings.CREATE_IMAGE_BITMAP = false; // ehh? good or not? OKAY actually it seems like having this on false reduces GC work. Could be some weird placebo shit, tho
PIXI.settings.GC_MODE = PIXI.GC_MODES.MANUAL; // TODO! So... what actually needs to be done manually? Just Texture.destroy()?

export let renderer = new PIXI.Renderer({
    width: window.innerWidth,
    height: window.innerHeight,
    context: gl,
    antialias: true
});
export let stage = new PIXI.Container();

(renderer.framebuffer as any).writeDepthTexture = true; // OKAY SO. WHAT THE FUCK. WHY IS THIS FALSE IN THE FIRST PLACE. Absolute hack. Don't know if this has any side-effects. Maybe it's how the renderer is created?

let renderingTasks: Function[] = [];
export function mainRenderingLoop() {
    requestAnimationFrame(mainRenderingLoop);
    //setTimeout(mainRenderingLoop, 0);

    for (let i = 0; i < renderingTasks.length; i++) {
        renderingTasks[i]();
    }

    renderer.render(stage);
}
requestAnimationFrame(mainRenderingLoop);

export function addRenderingTask(task: Function) {
    let index = renderingTasks.findIndex((a) => a === task);
    if (index !== -1) return;

    renderingTasks.push(task);
}

export function removeRenderingTask(task: Function) {
    let index = renderingTasks.findIndex((a) => a === task);
    if (index === -1) return;

    renderingTasks.splice(index, 1);
}

// TODO: Maybe disable PIXI GC?
export function uploadTexture(tex: PIXI.Texture) {
    renderer.texture.bind(tex, 15); // Use slot 15 for all texture uploaded in this way. While that means that only the last uploaded texture will still be bound, all uploaded textures still remain in video memory.
}

export let softwareCursor = new PIXI.Sprite(PIXI.Texture.from("./assets/img/cursor.png"));
softwareCursor.anchor.set(0.5, 0.5);
softwareCursor.scale.set(1.0, 1.0);
softwareCursor.visible = false;

let softwareCursorContainer = new PIXI.Container();
softwareCursorContainer.addChild(softwareCursor);

export let mainHitObjectContainer = new PIXI.Container();
export let approachCircleContainer = new PIXI.Container();
export let sliderBodyContainer = new PIXI.Container();
export let followPointContainer = new PIXI.Container();
export let scorePopupContainer = new PIXI.Container();
export let hudContainer = new PIXI.Container();
export let cursorRippleGraphics = new PIXI.Graphics();

// The order of these is important, 'cause z-index 'n' stuff.
stage.addChild(scorePopupContainer);
stage.addChild(followPointContainer);
stage.addChild(sliderBodyContainer);
stage.addChild(mainHitObjectContainer);
stage.addChild(approachCircleContainer);
stage.addChild(hudContainer);
stage.addChild(softwareCursorContainer);
stage.addChild(cursorRippleGraphics);