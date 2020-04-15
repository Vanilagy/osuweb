import { Point, clonePoint } from "../util/point";
import { CustomEventEmitter } from "../util/custom_event_emitter";
import { normalizeWheelEvent, NormalizedWheelEvent } from "../util/misc_util";
import { tickAll } from "../util/ticker";

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

export function getCurrentMousePosition() {
	return clonePoint(currentMousePosition);
}

export function getCurrentMouseButtonState() {
	return currentMouseButtonState;
}

window.onmousemove = (e: MouseEvent) => {
	tickAll();

	currentMousePosition.x = e.clientX;
	currentMousePosition.y = e.clientY;

	inputEventEmitter.emit('mouseMove', e);
};

window.onkeydown = (e: KeyboardEvent) => {
	tickAll();
	inputEventEmitter.emit('keyDown', e);
};

window.onkeyup = (e: KeyboardEvent) => {
	tickAll();
	inputEventEmitter.emit('keyUp', e);
};

// TODO: Eventually add touch support. Eventually.
window.onmousedown = (e: MouseEvent) => {
	tickAll();

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

// Prevent context menu from opening on right click
window.oncontextmenu = (e: MouseEvent) => {
	tickAll();
	if (PREVENT_NATIVE_CONTEXT_MENU) e.preventDefault();
};

window.onwheel = (ev: WheelEvent) => {
	tickAll();
	inputEventEmitter.emit('wheel', normalizeWheelEvent(ev));
};