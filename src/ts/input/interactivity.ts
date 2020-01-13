import { inputEventEmitter, getCurrentMousePosition, getCurrentMouseButtonState } from "./input";
import { Point } from "../util/point";
import { addRenderingTask } from "../visuals/rendering";

type Interaction = 'mouseDown' | 'mouseUp' | 'mouseClick' | 'mouseEnter' | 'mouseLeave' | 'mouseMove';
let registrations: InteractionRegistration[] = [];

interface InteractionEventData {
	pressedDown: boolean,
	triggeringEvent?: MouseEvent
}

abstract class InteractionUnit {
	public enabled: boolean = true;
	protected parent: InteractionGroup = null;
	public blocked: boolean = false;

	abstract enable(): void;
	abstract disable(): void;
	abstract setBlocked(state: boolean): void;
	abstract releaseAllPresses(): void;

	detach() {
		if (this.parent !== null) this.parent.remove(this);
	}

	performDetach() {
		this.setBlocked(false);
		this.parent = null;
	}

	setParent(newParent: InteractionGroup) {
		this.detach();
		this.parent = newParent;
	}
}

export class InteractionRegistration extends InteractionUnit {
	public obj: PIXI.DisplayObject;
	private listeners: Map<Interaction, ((data?: InteractionEventData) => any)[]> = new Map();
	public mouseInside = false;
	private destroyed = false;
	public pressedDown = false; // A necessary flag in order to make clicking work (CLICKING, not mouse-downing!!)

	constructor(obj: PIXI.DisplayObject, enabled: boolean) {
		super();

		this.obj = obj;

		if (enabled) {
			this.enabled = false;
			this.enable();
		} else {
			this.disable();
		}
	}

	public addListener(interaction: Interaction, func: (data?: InteractionEventData) => any) {
		if (this.destroyed) return;

		let arr = this.listeners.get(interaction);
		if (!arr) {
			arr = [];
			this.listeners.set(interaction, arr);
		}

		arr.push(func);
	}

	overlaps(x: number, y: number) {
		if (this.destroyed) return;

		if (this.obj.hitArea) {
			let pos = this.obj.getGlobalPosition();
			return this.obj.hitArea.contains(x - pos.x, y - pos.y);
		} else {
			return this.obj.getBounds().contains(x, y);
		}
	}

	trigger(interaction: Interaction, event: MouseEvent) {
		if (this.destroyed) return;

		let arr = this.listeners.get(interaction);
		if (!arr) return;

		let data: InteractionEventData = {
			pressedDown: this.pressedDown,
			triggeringEvent: event
		};

		// OMFG TILT. TODO clean up this addedData shit

		for (let i = 0; i < arr.length; i++) {
			arr[i](data);
		}
	}

	enable() {
		if (this.enabled) return;
		this.enabled = true;

		if (!this.blocked) this.performEnable();
	}

	disable() {
		if (!this.enabled) return;
		this.enabled = false;

		if (!this.blocked) this.performDisable();
	}

	performEnable() {
		registrations.push(this);
	}

	performDisable() {
		let index = registrations.indexOf(this);
		if (index !== -1) registrations.splice(index, 1);
	}

	handlesInteraction(interaction: Interaction) {
		if (this.destroyed) return false;

		let arr = this.listeners.get(interaction);
		if (!arr) return false;
		if (arr.length === 0) return false;

		return true;
	}

	destroy() {
		this.obj = null;
		this.listeners = null;
		this.destroyed = true;
		this.parent = null;
		this.disable();
	}

	setBlocked(state: boolean) {
		if (state === this.blocked) return;
		this.blocked = state;

		if (this.blocked && this.enabled) this.performDisable();
		else if (!this.blocked && this.enabled) this.performEnable();
	}

	releaseAllPresses() {
		if (this.pressedDown) {
			this.pressedDown = false;

			let mousePosition = getCurrentMousePosition();
			if (this.overlaps(mousePosition.x, mousePosition.y)) {
				this.trigger('mouseUp', null);
			}
		}
	}
}

export class InteractionGroup extends InteractionUnit {
	private children: InteractionUnit[] = [];

	constructor() {
		super();
	}

	add(...newChildren: InteractionUnit[]) {
		this.children.push(...newChildren);

		for (let i = 0; i < newChildren.length; i++) {
			newChildren[i].setParent(this);
		}
		
		this.propagateBlocked(this.blocked || !this.enabled, newChildren);
	}

	remove(...children: InteractionUnit[]) {
		for (let i = 0; i < children.length; i++) {
			let index = this.children.indexOf(children[i]);
			if (index === -1) continue;

			this.children.splice(index, 1);
			children[i].performDetach();
		}
	}

	removeAll() {
		for (let i = 0; i < this.children.length; i++) {
			this.children[i].performDetach();
		}

		this.children.length = 0;
	}

	destroyChildren() {
		for (let i = 0; i < this.children.length; i++) {
			let child = this.children[i];

			if (child instanceof InteractionGroup) child.destroyChildren();
			else if (child instanceof InteractionRegistration) child.destroy();
		}

		this.children.length = 0;
	}

	enable() {
		if (this.enabled) return;
		this.enabled = true;

		if (!this.blocked) this.propagateBlocked(false, this.children);
	}

	disable() {
		if (!this.enabled) return;
		this.enabled = false;

		if (!this.blocked) this.propagateBlocked(true, this.children);
	}

	setBlocked(state: boolean) {
		if (state === this.blocked) return;
		this.blocked = state;

		if (this.enabled) this.propagateBlocked(this.blocked, this.children);
	}

	propagateBlocked(state: boolean, children: InteractionUnit[]) {
		for (let i = 0; i < children.length; i++) {
			let child = children[i];
			child.setBlocked(state);
		}
	}

	releaseAllPresses() {
		for (let i = 0; i < this.children.length; i++) {
			this.children[i].releaseAllPresses();
		}
	}
}

export abstract class Interactivity {
	static registerDisplayObject(obj: PIXI.DisplayObject, disableByDefault = false) {
		let registration = new InteractionRegistration(obj, !disableByDefault);

		return registration;
	}
}

function handleMouseInteraction(interaction: Interaction, event: MouseEvent, func: (mousePosition: Point, registration: InteractionRegistration) => boolean) {
	let mousePosition = getCurrentMousePosition();
	let toTrigger: InteractionRegistration[] = [];

	// We determine first which registrations need to be triggered.
	for (let i = 0; i < registrations.length; i++) {
		let reg = registrations[i];
		if (!reg.handlesInteraction(interaction)) continue;

		let result = func(mousePosition, reg);
		if (!result) continue;

		toTrigger.push(reg);
	}

	// Then, one after another, we trigger them. This separation happens so that the interaction doesn't trigger additional registrations that could be added as a SIDE-EFFECT of a trigger.
	for (let i = 0; i < toTrigger.length; i++) {
		toTrigger[i].trigger(interaction, event);
	}
}

inputEventEmitter.addListener('mouseDown', (e) => handleMouseInteraction('mouseDown', e, (pos, reg) => {
	return reg.overlaps(pos.x, pos.y);
}));

inputEventEmitter.addListener('mouseDown', (e) => handleMouseInteraction('mouseClick', e, (pos, reg) => {
	let overlaps = reg.overlaps(pos.x, pos.y);
	if (overlaps) reg.pressedDown = true;

	return false; // Never trigger mouseClick, just set the flag.
}));

inputEventEmitter.addListener('mouseUp', (e) => handleMouseInteraction('mouseUp', e, (pos, reg) => {
	return reg.overlaps(pos.x, pos.y);
}));

inputEventEmitter.addListener('mouseUp', (e) => handleMouseInteraction('mouseClick', e, (pos, reg) => {
	let success = false;
	let overlaps = reg.overlaps(pos.x, pos.y);
	if (overlaps && reg.pressedDown) success = true;

	reg.pressedDown = false;

	return success;
}));

inputEventEmitter.addListener('mouseMove', (e) => handleMouseInteraction('mouseMove', e, (pos, reg) => {
	return reg.overlaps(pos.x, pos.y);
}));

let lastMouseMoveHandleTime = -Infinity;
function onMouseMove(e: MouseEvent) {
	lastMouseMoveHandleTime = performance.now();

	handleMouseInteraction('mouseEnter', e, (pos, reg) => {
		let overlaps = reg.overlaps(pos.x, pos.y);
		if (!overlaps) return false;
		if (reg.mouseInside) return false;
	
		reg.mouseInside = true;
		return true;
	});

	handleMouseInteraction('mouseLeave', e, (pos, reg) => {
		let overlaps = reg.overlaps(pos.x, pos.y);
		if (overlaps) return false;
		if (!reg.mouseInside) return false;
	
		reg.mouseInside = false;
		return true;
	});
}
inputEventEmitter.addListener('mouseMove', onMouseMove);

addRenderingTask((now) => {
	if (now - lastMouseMoveHandleTime >= 1000/30) onMouseMove(null); // Call it, even though the mouse didn't move, so that we catch objects having moved out of or into the cursor.
});