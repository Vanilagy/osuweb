import { mainCanvas, renderer, addRenderingTask, cursorRippleGraphics } from "./rendering";
import { Point } from "../util/point";
import { getCurrentMousePosition, inputEventEmitter } from "../input/input";
import { MathUtil } from "../util/math_util";
import { CustomEventEmitter } from "../util/custom_event_emitter";

const CURSOR_RIPPLE_DURATION = 1500;
const CURSOR_RIPPLES = false;
export const REFERENCE_SCREEN_HEIGHT = 768; // For a lot of full-screen textures, the reference height is 768.

let globalScaingFactor = 1.0;
export function getGlobalScalingFactor() {
	return globalScaingFactor;
}

export let uiEventEmitter = new CustomEventEmitter();

function onResize() {
	let width = window.innerWidth,
		height = window.innerHeight;

	mainCanvas.setAttribute('width', String(width));
	mainCanvas.setAttribute('height', String(height));

	renderer.resize(width, height);
	
	globalScaingFactor = Math.min(width, height) / REFERENCE_SCREEN_HEIGHT;

	uiEventEmitter.emit('resize');
}
onResize();

window.addEventListener('resize', onResize);

interface CursorRipple {
	time: number,
	position: Point
}
let currentCursorRipples: CursorRipple[] = [];

export function addCursorRipple(position?: Point) {
	if (!CURSOR_RIPPLES) return;

	position = position || getCurrentMousePosition();

	currentCursorRipples.push({
		time: performance.now(),
		position: position
	});
}
inputEventEmitter.addListener('gameButtonDown', addCursorRipple);

addRenderingTask((now) => {
	cursorRippleGraphics.clear();

	for (let i = 0; i < currentCursorRipples.length; i++) {
		let ripple = currentCursorRipples[i];

		let completion = (now - ripple.time) / CURSOR_RIPPLE_DURATION;
		completion = MathUtil.clamp(completion, 0, 1);

		if (completion === 1) {
			currentCursorRipples.splice(i--, 1);
			continue;
		}

		let alpha = 1 - completion;
		let radius = MathUtil.lerp(50, 90, completion);

		cursorRippleGraphics.beginFill(0xffffff, 0.12 * alpha);
		cursorRippleGraphics.drawCircle(ripple.position.x, ripple.position.y, radius);
		cursorRippleGraphics.endFill();
	}
});