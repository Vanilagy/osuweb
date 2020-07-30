import { MathUtil } from "../util/math_util";
import { pushItemUnique, removeItem } from "../util/misc_util";
import { globalState } from "../global_state";
import { tickAll } from "../util/ticker";

const LOG_RENDER_INFO_INTERVAL = 5000; // In ms

export const mainCanvas = document.querySelector('#main-canvas') as HTMLCanvasElement;
const decoyCanvas = document.querySelector('#decoy_canvas') as HTMLCanvasElement;
const decoyCtx = decoyCanvas.getContext('2d');

const gl = mainCanvas.getContext('webgl2', {
	stencil: true,
	alpha: true,
	powerPreference: 'high-performance',
	// TODO: Remember to turn this off if framerate is uncapped:
	//desynchronized: true // Tells browser to send canvas data directly to the GPU. Breaks the FPS meter ;)
}) as WebGLRenderingContext; // Technically WebGL2, but idk. Rollup is complaining :S

export const MAX_TEXTURE_SIZE = gl.getParameter(gl.MAX_TEXTURE_SIZE);

PIXI.settings.CREATE_IMAGE_BITMAP = false; // ehh? good or not? OKAY actually it seems like having this on false reduces GC work. Could be some weird placebo shit, tho
PIXI.settings.GC_MODE = PIXI.GC_MODES.MANUAL; // TODO! So... what actually needs to be done manually? Just Texture.destroy()?

type RenderingTask = (now?: number, dt?: number) => any;
let renderingTasks: RenderingTask[] = [];
let frameTimes: number[] = [];
let inbetweenFrameTimes: number[] = [];
let lastCallTime: number = null;
let lastFrameTime: number = null; // Differs from lastCallTime in cases where FPS is limited
let lastRenderInfoLogTime: number = null;
let frameBudget = 0;
let logRenderTimeInfo = false;

export let renderer = new PIXI.Renderer({
	width: window.innerWidth,
	height: window.innerHeight,
	context: gl,
	antialias: true,
	//resolution: window.devicePixelRatio || 1.0 // TODO: Make this an option?
});
export let stage = new PIXI.Container();
stage.sortableChildren = true;

(renderer.framebuffer as any).writeDepthTexture = true; // OKAY SO. WHAT THE FUCK. WHY IS THIS FALSE IN THE FIRST PLACE. Absolute hack. Don't know if this has any side-effects. Maybe it's how the renderer is created?

export function enableRenderTimeInfoLog() {
	logRenderTimeInfo = true;
}

export function disableRenderTimeInfoLog() {
	logRenderTimeInfo = false;
}

/** Computes the current target FPS, based on settings and game state. */
export function getCurrentTargetFps() {
	if (!globalState.settings) return 60;

	let isInGameplay = false;
	if (globalState.gameplayController?.currentPlay) {
		let play = globalState.gameplayController.currentPlay;
		if (play.playing && !play.completed) isInGameplay = true;
	}

	return parseFpsSetting(globalState.settings[isInGameplay? 'gameplayFpsLimit' : 'menuFpsLimit']);
}

function parseFpsSetting(setting: string) {
	if (setting[0] === '#') return Number(setting.slice(1)); // If the setting begins with a #, that means the rest is a number literal
	else return 1e6; // "unlimited"
}

function mainRenderingLoop() {
	let startTime = performance.now();

	requestAnimationFrame(mainRenderingLoop);
	tickAll();

	if (lastCallTime === null) {
		lastCallTime = startTime;
		lastFrameTime = startTime;
		return;
	}

	let frameTime = 1000 / getCurrentTargetFps();

	// When FPS is unlocked in the browser but limited in-game, for some browser frames, the game won't draw anything. This makes the browser think it's okay to slow down the rate of requestAnimationFrame, which is not desirable in this case. Therefore we trick the browser into thinking the GPU is doing something by continuously clearing a 1x1 canvas each frame.
	decoyCtx.clearRect(0, 0, 1, 1);

	// Slowly fill up the budget, until it exceeds the frame time. In that case, draw a frame.
	frameBudget += startTime - lastCallTime;
	lastCallTime = startTime;
	if (frameBudget < frameTime) return; // It would be too early to draw a frame, so return.

	frameBudget -= frameTime;
	frameBudget = Math.min(frameBudget, frameTime*2); // To avoid the budget filling up faster than can be removed from it.

	let dt = startTime - lastFrameTime;
	lastFrameTime = startTime;
 
	if (logRenderTimeInfo) inbetweenFrameTimes.push(dt);

	for (let i = 0; i < renderingTasks.length; i++) {
		renderingTasks[i](startTime, dt);
	}

	renderer.render(stage);

	if (!logRenderTimeInfo) return;

	// Frame time logger:
	let now = performance.now();
	let elapsedTime = now - startTime;
	frameTimes.push(elapsedTime);

	if ((now - lastRenderInfoLogTime) >= LOG_RENDER_INFO_INTERVAL && frameTimes.length > 0 && inbetweenFrameTimes.length > 0) {
		let data1 = MathUtil.getAggregateValuesFromArray(frameTimes),
			data2 = MathUtil.getAggregateValuesFromArray(inbetweenFrameTimes);
			
		console.log("---");
		console.log(`Frame time info: Average: ${data1.avg.toFixed(3)}ms, Shortest: ${data1.min.toFixed(3)}ms, Longest: ${data1.max.toFixed(3)}ms`);
		console.log(`Frame period info: Average: ${data2.avg.toFixed(3)}ms, Shortest: ${data2.min.toFixed(3)}ms, Longest: ${data2.max.toFixed(3)}ms`);

		frameTimes.length = 0;
		inbetweenFrameTimes.length = 0;
		lastRenderInfoLogTime = now;
	}

	if (lastRenderInfoLogTime === null) lastRenderInfoLogTime = now;
}
requestAnimationFrame(mainRenderingLoop);

export function addRenderingTask(task: RenderingTask) {
	pushItemUnique(renderingTasks, task);
}

export function removeRenderingTask(task: RenderingTask) {
	removeItem(renderingTasks, task);
}

// TODO: Maybe disable PIXI GC?
export function uploadTexture(tex: PIXI.Texture) {
	renderer.texture.bind(tex, 15); // Use slot 15 for all texture uploaded in this way. While that means that only the last uploaded texture will still be bound, all uploaded textures still remain in video memory.
}