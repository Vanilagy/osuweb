import { mainCanvas, renderer } from "./rendering";
import { CustomEventEmitter } from "../util/custom_event_emitter";
import { Dimensions } from "../util/graphics_util";

export const REFERENCE_SCREEN_HEIGHT = 768; // For a lot of full-screen textures, the reference height is 768.

let globalScaingFactor = 1.0;
export function getGlobalScalingFactor() {
	return globalScaingFactor;
}

export let uiEventEmitter = new CustomEventEmitter<{
	resize: void,
	gameButtonDown: void
}>();

// So we don't need to call window.innerWidth/innerHeight all the time
export const currentWindowDimensions: Dimensions = {
	width: window.innerWidth,
	height: window.innerHeight
};

function onResize() {
	let width = window.innerWidth,
		height = window.innerHeight;

	currentWindowDimensions.width = width;
	currentWindowDimensions.height = height;

	mainCanvas.setAttribute('width', String(width));
	mainCanvas.setAttribute('height', String(height));

	renderer.resize(width, height);
	
	globalScaingFactor = Math.min(width, height) / REFERENCE_SCREEN_HEIGHT;

	uiEventEmitter.emit('resize');
}
onResize();

window.addEventListener('resize', onResize);