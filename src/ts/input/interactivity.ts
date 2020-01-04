import { inputEventEmitter, getCurrentMousePosition } from "./input";
import { Point } from "../util/point";

type Interaction = 'mouseDown' | 'mouseEnter' | 'mouseLeave';
let registrations: InteractionRegistration[] = [];

abstract class InteractionUnit {
	public enabled: boolean = true;
	protected parent: InteractionGroup = null;
	public blocked: boolean = false;

	abstract enable(): void;
	abstract disable(): void;
	abstract setBlocked(state: boolean): void;

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
	private listeners: Map<Interaction, Function[]> = new Map();
	public mouseInside = false;
	private destroyed = false;

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

	public addListener(interaction: Interaction, func: Function) {
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

		let bounds = this.obj.getBounds();
		return x >= bounds.x && x < bounds.x + bounds.width && y >= bounds.y && y < bounds.y + bounds.height;
	}

	trigger(interaction: Interaction) {
		if (this.destroyed) return;

		let arr = this.listeners.get(interaction);
		if (!arr) return;

		for (let i = 0; i < arr.length; i++) {
			arr[i]();
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
		registrations.splice(registrations.indexOf(this), 1);
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
}

export abstract class Interactivity {
	static registerDisplayObject(obj: PIXI.DisplayObject, disableByDefault = false) {
		let registration = new InteractionRegistration(obj, !disableByDefault);

		return registration;
	}
}

function handleMouseInteraction(interaction: Interaction, func: (mousePosition: Point, registration: InteractionRegistration) => boolean) {
	let mousePosition = getCurrentMousePosition();

	for (let i = 0; i < registrations.length; i++) {
		let reg = registrations[i];
		if (!reg.handlesInteraction(interaction)) continue;

		if (func(mousePosition, reg)) reg.trigger(interaction);
	}
}

inputEventEmitter.addListener('mouseDown', () => handleMouseInteraction('mouseDown', (pos, reg) => {
	return reg.overlaps(pos.x, pos.y);
}));

inputEventEmitter.addListener('mouseMove', () => handleMouseInteraction('mouseEnter', (pos, reg) => {
	let overlaps = reg.overlaps(pos.x, pos.y);
	if (!overlaps) return false;
	if (reg.mouseInside) return false;

	reg.mouseInside = true;
	return true;
}));

inputEventEmitter.addListener('mouseMove', () => handleMouseInteraction('mouseLeave', (pos, reg) => {
	let overlaps = reg.overlaps(pos.x, pos.y);
	if (overlaps) return false;
	if (!reg.mouseInside) return false;

	reg.mouseInside = false;
	return true;
}));