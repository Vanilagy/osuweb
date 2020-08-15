import { Point, clonePoint } from "../util/point";
import { CustomEventEmitter } from "../util/custom_event_emitter";
import { normalizeWheelEvent, NormalizedWheelEvent, EMPTY_FUNCTION } from "../util/misc_util";
import { tickAll } from "../util/ticker";
import { currentWindowDimensions, isFullscreen, windowFocused } from "../visuals/ui";
import { globalState } from "../global_state";
import { MathUtil } from "../util/math_util";

const PREVENT_NATIVE_CONTEXT_MENU = true;

export enum KeyCode {
	Backspace = 8,
	Enter = 13,
	Escape = 27,
	Space = 32,
	LeftArrow = 37,
	UpArrow = 38,
	RightArrow = 39,
	DownArrow = 40,
	C = 67,
	X = 88,
	Y = 89
}

export enum MouseButton {
	Left = 0,
	Middle = 1,
	Right = 2
}

export let inputEventEmitter = new CustomEventEmitter<{
	mouseMove: MouseEvent,
	mouseDown: MouseEvent,
	mouseUp: MouseEvent,
	wheel: NormalizedWheelEvent,
	keyDown: KeyboardEvent,
	keyUp: KeyboardEvent
}>();

let currentMousePosition: Point = {
	// Before any events, just center the mouse:
	x: window.innerWidth / 2,
	y: window.innerHeight / 2
};
let currentMouseButtonState = {
	lmb: false,
	rmb: false,
	mmb: false
};
let mouseSensitivity = 1.0;
/** The mouse can sometimes spasm around a bit when exiting and immediately entering pointer lock - this variable tries to mitigate that. */
let mouseMoveImmunityEnd = -Infinity;

export function setMouseSensitivity(value: number) {
	mouseSensitivity = value;
}

export function getCurrentMousePosition() {
	return clonePoint(currentMousePosition);
}

export function getCurrentMouseButtonState() {
	return currentMouseButtonState;
}

window.onmousemove = (e: MouseEvent) => {
	tickAll();

	if (performance.now() < mouseMoveImmunityEnd) return;

	if (!globalState.settings?.['useSoftwareCursor']) {
		// When using a hardware cursor, just copy the pure mouse position.
		currentMousePosition.x = e.clientX;
		currentMousePosition.y = e.clientY;
	} else {
		let mode = globalState.settings['mouseInputMode']

		if (mode === 'absolute') {
			// Project the mouse position around the center of the window (the center is always a fixed point)
			currentMousePosition.x = MathUtil.clamp(currentWindowDimensions.width/2 + (e.clientX - currentWindowDimensions.width/2) * Math.max(1, mouseSensitivity), 0, currentWindowDimensions.width-1);
			currentMousePosition.y = MathUtil.clamp(currentWindowDimensions.height/2 + (e.clientY - currentWindowDimensions.height/2) * Math.max(1, mouseSensitivity), 0, currentWindowDimensions.height-1);
		} else if (mode === 'raw') {
			if (!document.pointerLockElement) return;

			// Simply advance the cursor based on movement
			currentMousePosition.x += e.movementX * mouseSensitivity;
			currentMousePosition.y += e.movementY * mouseSensitivity;

			currentMousePosition.x = MathUtil.clamp(currentMousePosition.x, 0, currentWindowDimensions.width-1);
			currentMousePosition.y = MathUtil.clamp(currentMousePosition.y, 0, currentWindowDimensions.height-1);
		}
	}

	inputEventEmitter.emit('mouseMove', e);
};

// Simulated a fake mousedown event to trick the browser into thinking something is "user gesture-initiated"
function simulateMouseDown() {
	let evt = document.createEvent("MouseEvents");
	evt.initMouseEvent("mousedown", true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
	document.body.dispatchEvent(evt);
}

// TODO: Eventually add touch support. Eventually.
window.onmousedown = (e: MouseEvent) => {
	tickAll();

	if (globalState.settings?.['useSoftwareCursor'] && globalState.settings['mouseInputMode'] === 'raw' && !document.pointerLockElement) {
		// The user has clicked into the window while they weren't pointer locked.
		document.documentElement.requestPointerLock();
		return;
	}

	let button = e.button;

	if (button === MouseButton.Left) currentMouseButtonState.lmb = true;
	else if (button === MouseButton.Middle) currentMouseButtonState.mmb = true;
	else if (button === MouseButton.Right) currentMouseButtonState.rmb = true;
	inputEventEmitter.emit('mouseDown', e);
};

window.onmouseup = (e: MouseEvent) => {
	tickAll();

	let button = e.button;

	if (button === MouseButton.Left) currentMouseButtonState.lmb = false;
	else if (button === MouseButton.Middle) currentMouseButtonState.mmb = false;
	else if (button === MouseButton.Right) currentMouseButtonState.rmb = false;
	inputEventEmitter.emit('mouseUp', e);
};

window.onkeydown = (e: KeyboardEvent) => {
	tickAll();
	inputEventEmitter.emit('keyDown', e);
};

window.onkeyup = (e: KeyboardEvent) => {
	tickAll();
	inputEventEmitter.emit('keyUp', e);
};

// Prevent context menu from opening on right click
window.oncontextmenu = (e: MouseEvent) => {
	tickAll();
	if (PREVENT_NATIVE_CONTEXT_MENU) e.preventDefault();
};

window.onwheel = (ev: WheelEvent) => {
	tickAll();
	inputEventEmitter.emit('wheel', normalizeWheelEvent(ev));
};

document.onpointerlockchange = () => {
	if (!document.pointerLockElement && globalState.settings?.['useSoftwareCursor'] && globalState.settings['mouseInputMode'] === 'raw' && windowFocused) {
		if (!isFullscreen()) {
			// If the cursor is on the very side of the screen, assume the user has pressed ESC and wanted to exit pointer lock on purpose.
			let mouseOnSide = currentMousePosition.x === 0 || currentMousePosition.x === currentWindowDimensions.width-1 || currentMousePosition.y === 0 || currentMousePosition.y === currentWindowDimensions.height-1;
			if (mouseOnSide) return;
		}

		simulateMouseDown();
		// If we're here, then the window is focussed, so we assume ESC was pressed to exit pointer lock, in which case we replicate the ESC event since it was dropped.
		window.onkeydown({keyCode: KeyCode.Escape, key: 'Escape', code: 'Escape', shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, preventDefault: EMPTY_FUNCTION} as KeyboardEvent);

		mouseMoveImmunityEnd = performance.now() + 100;
	}
};