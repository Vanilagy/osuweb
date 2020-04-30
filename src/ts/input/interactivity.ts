import { inputEventEmitter, getCurrentMousePosition, getCurrentMouseButtonState, MouseButton } from "./input";
import { Point, Vector2, subtractFromPoint, clonePoint, scaleVector2 } from "../util/point";
import { addRenderingTask } from "../visuals/rendering";
import { insertItem, removeItem, pushItemUnique, EMPTY_FUNCTION, NormalizedWheelEvent, jsonClone } from "../util/misc_util";

interface InteractionEventMap {
	mouseDown: MouseEvent,
	mouseUp: MouseEvent,
	mouseClick: MouseEvent,
	mouseEnter: MouseEvent,
	mouseLeave: MouseEvent,
	mouseMove: MouseEvent,
	wheel: NormalizedWheelEvent,
	keyDown: KeyboardEvent,
	keyUp: KeyboardEvent
}

interface DragAction {
	registration: InteractionRegistration,
	startPos: Point,
	startTime: number,
	lastPos: Point,
	lastTime: number,
	lastDragMoveData: DragMoveData,
	onDragMove: (data?: DragMoveData) => any,
	onDragEnd: (data?: DragMoveData) => any
}

interface DragMoveData {
	readonly newPoint: Readonly<Point>,
	readonly movement: Readonly<Vector2>,
	readonly dt: number,
	/** Projected velocity per second */
	readonly velocity: Readonly<Vector2>,
	readonly distanceFromStart: Readonly<Vector2>,
	readonly elapsedTime: number
}

const zIndexComparator = (a: InteractionUnit, b: InteractionUnit) => b.getZIndex() - a.getZIndex();

type Interaction = 'mouseDown' | 'mouseUp' | 'mouseClick' | 'mouseEnter' | 'mouseLeave' | 'mouseMove' | 'wheel' | 'keyDown' | 'keyUp';
let mouseInteractionArray: Interaction[] = ['mouseDown', 'mouseUp', 'mouseClick', 'mouseEnter', 'mouseLeave', 'mouseMove', 'wheel'];
export let rootInteractionGroup: InteractionGroup;
let currentDragActions: DragAction[] = [];

abstract class InteractionUnit {
	public enabled: boolean = true;
	public parent: InteractionGroup = null;
	public passThrough = false;
	private zIndex = 0;

	abstract releaseAllPresses(): void;

	enable() {
		if (this.enabled) return;
		this.enabled = true;

		if (this.parent) insertItem(this.parent.active, this, zIndexComparator);
	}

	disable() {
		if (!this.enabled) return;
		this.enabled = false;

		if (this.parent) removeItem(this.parent.active, this);
	}

	detach() {
		if (this.parent) this.parent.remove(this);
	}

	getZIndex() {
		return this.zIndex;
	}

	setZIndex(newZIndex: number) {
		if (newZIndex === this.zIndex) return;

		this.zIndex = newZIndex;
		if (this.enabled && this.parent) {
			removeItem(this.parent.active, this);
			insertItem(this.parent.active, this, zIndexComparator);
		}
	}
}

export class InteractionRegistration extends InteractionUnit {
	public obj: PIXI.DisplayObject;
	private listeners: Map<Interaction, ((data?: any) => any)[]> = new Map();
	public mouseInside = false;
	public pressedDown: {[button: number]: boolean} = {
		// A necessary flag in order to make clicking work (CLICKING, not mouse-downing!!)
		[MouseButton.Left]: false,
		[MouseButton.Middle]: false,
		[MouseButton.Right]: false
	};
	private allMouseButtons = false;
	private dragInitiationListener: () => void = null;

	constructor(obj?: PIXI.DisplayObject, enabled = true) {
		super();

		this.obj = obj;

		if (enabled) {
			this.enabled = false;
			this.enable();
		} else {
			this.disable();
		}
	}

	// TODO: Maybe extend CustomEventEmitter? Idk... :S
	addListener<K extends keyof InteractionEventMap>(interaction: K, func: (data?: InteractionEventMap[K]) => any) {
		let arr = this.listeners.get(interaction);
		if (!arr) {
			arr = [];
			this.listeners.set(interaction, arr);
		}

		pushItemUnique(arr, func);
	}

	removeListener(interaction: Interaction, func: (data?: any) => any) {
		let arr = this.listeners.get(interaction);
		if (!arr) return;

		removeItem(arr, func);
	}

	/** Adds empty listeners to every interaction type. The point of this is that this allows a non-passthrough object to basically "catch" all interactions and not let anything pass through (good for backgrounds of containers or popups, for example) */
	enableEmptyListeners(exclude: Interaction[] = []) {
		for (let interaction of mouseInteractionArray) {
			if (!exclude.includes(interaction)) this.addListener(interaction, EMPTY_FUNCTION);
		}
	}

	disableEmptyListeners(exclude: Interaction[] = []) {
		for (let interaction of mouseInteractionArray) {
			if (!exclude.includes(interaction)) this.removeListener(interaction, EMPTY_FUNCTION);
		}
	}

	makeDraggable(onDragStart?: Function, onDragMove?: (data?: DragMoveData) => any, onDragEnd?: (data?: DragMoveData) => any) {
		if (this.dragInitiationListener) return;

		this.dragInitiationListener = () => {
			let mousePos = getCurrentMousePosition();
			let now = performance.now();

			currentDragActions.push({
				registration: this,
				startPos: mousePos,
				startTime: now,
				lastPos: mousePos,
				lastTime: now,
				lastDragMoveData: null,
				onDragMove: onDragMove,
				onDragEnd: onDragEnd
			});

			if (onDragStart) onDragStart();
		}

		this.addListener('mouseDown', this.dragInitiationListener);
	}

	removeDraggable() {
		if (this.dragInitiationListener) {
			this.removeListener('mouseDown', this.dragInitiationListener);
			this.dragInitiationListener = null;
		}
	}

	overlaps(x: number, y: number) {
		if (!this.obj) return false;

		if (this.obj.hitArea) {
			let pos = this.obj.getGlobalPosition();
			return this.obj.hitArea.contains(x - pos.x, y - pos.y);
		} else {
			return this.obj.getBounds().contains(x, y);
		}
	}

	trigger<K extends Interaction>(interaction: K, event: InteractionEventMap[K]) {
		let arr = this.listeners.get(interaction);
		if (!arr) return;

		for (let i = 0; i < arr.length; i++) {
			arr[i](event);
		}
	}

	handlesInteraction<K extends Interaction>(interaction: K, event: InteractionEventMap[K]) {
		let arr = this.listeners.get(interaction);
		if (!arr) return false;
		if (arr.length === 0) return false;

		if (interaction === 'mouseDown' || interaction === 'mouseUp' || interaction === 'mouseClick') {
			let mouseEvent = event as MouseEvent;
			if (!this.allMouseButtons && mouseEvent.button !== MouseButton.Left) return false;
		}

		return true;
	}

	releaseAllPresses() {
		if (this.pressedDown[0] || this.pressedDown[1] || this.pressedDown[2]) {
			for (let key in this.pressedDown) this.pressedDown[key] = false;

			let mousePosition = getCurrentMousePosition();
			if (this.overlaps(mousePosition.x, mousePosition.y)) {
				this.trigger('mouseUp', null);
			}
		}
	}

	/** Buttons typically have the following handlers: One for when it's clicked, then one for hover, one for unhover, one for pressing it down and one for releasing it. However, buttons typically connect these handlers, for example: When a button is held down, but then the mouse is moved out of it, then that should release the button. Similarly then, when the mouse moves back into the button area, that should run the press-down code again. This method takes care of that. */
	addButtonHandlers(onclick: (data?: InteractionEventMap["mouseClick"]) => any, onmousenter: (data?: InteractionEventMap["mouseEnter"]) => any, onmouseleave: (data?: InteractionEventMap["mouseLeave"]) => any, onpressdown: (data?: InteractionEventMap["mouseDown"]) => any, onrelease: (data?: InteractionEventMap["mouseUp"]) => any, button: MouseButton = MouseButton.Left) {
		this.addListener('mouseClick', (e) => {
			if (e.button !== button) return;
			onclick();
		});
		this.addListener('mouseEnter', (e) => {
			onmousenter();
			if (this.pressedDown[button] === true) onpressdown();
		});
		this.addListener('mouseLeave', (e) => {
			onmouseleave();
			onrelease();
		});
		this.addListener('mouseDown', (e) => {
			if (e.button !== button) return;
			onpressdown();
		});
		this.addListener('mouseUp', (e) => {
			if (e && e.button !== button) return;
			onrelease();
		});
	}

	setDisplayObject(obj: PIXI.DisplayObject) {
		this.obj = obj;
	}

	/** Allow all mouse buttons (left, middle, right) to be handled. */
	allowAllMouseButtons() {
		this.allMouseButtons = true;
	}
	
	/** Only let left-clicks pass through. Default. */
	disallowAllMouseButtons() {
		this.allMouseButtons = false;
	}
}

export class InteractionGroup extends InteractionUnit {
	public children: InteractionUnit[] = [];
	public active: InteractionUnit[] = [];

	constructor() {
		super();
	}

	add(...newChildren: InteractionUnit[]) {
		for (let i = 0; i < newChildren.length; i++) {
			let newChild = newChildren[i];
			if (newChild.parent === this) continue;
			
			if (newChild.parent !== null) {
				newChild.parent.remove(newChild);
			}

			let doReenable = false;
			if (newChild.enabled) {
				doReenable = true;
				newChild.disable();
			}

			this.children.push(newChild);
			newChild.parent = this;
			
			if (doReenable) newChild.enable();
		}
	}

	remove(...children: InteractionUnit[]) {
		for (let i = 0; i < children.length; i++) {
			let child = children[i];
			if (child.parent !== this) continue;

			removeItem(this.children, child);
			removeItem(this.active, child);
			child.parent = null;
		}
	}

	removeAll() {
		this.remove(...this.children);
	}

	releaseAllPresses() {
		for (let i = 0; i < this.children.length; i++) {
			this.children[i].releaseAllPresses();
		}
	}

	triggerAll<K extends Interaction>(interaction: K, event: InteractionEventMap[K]) {
		let toTrigger: InteractionRegistration[] = [];
		this.getAllRegistrations(toTrigger, interaction, event);

		for (let i = 0; i < toTrigger.length; i++) {
			toTrigger[i].trigger(interaction, event);
		}
	}

	private getAllRegistrations<K extends Interaction>(acc: InteractionRegistration[], interaction: K, event: InteractionEventMap[K]) {
		for (let i = 0; i < this.active.length; i++) {
			let unit = this.active[i];

			if (unit instanceof InteractionGroup) {
				unit.getAllRegistrations(acc, interaction, event);
			} else if (unit instanceof InteractionRegistration) {
				if (!unit.handlesInteraction(interaction, event)) continue;
				acc.push(unit);
			}
		}
	}

	handleMouseInteraction<K extends Interaction>(interaction: K, event: InteractionEventMap[K], func: (mousePosition: Point, registration: InteractionRegistration) => boolean) {
		let toTrigger: InteractionRegistration[] = [];
		this.findTriggeredMouseRegistrations(toTrigger, interaction, event, getCurrentMousePosition(), func);

		// Then, one after another, we trigger them. This separation happens so that the interaction doesn't trigger additional registrations that could be added as a SIDE-EFFECT of a trigger.
		for (let i = 0; i < toTrigger.length; i++) {
			toTrigger[i].trigger(interaction, event);
		}
	}

	// Returns true if it caused an interaction
	private findTriggeredMouseRegistrations<K extends Interaction>(acc: InteractionRegistration[], interaction: K, event: InteractionEventMap[K], mousePosition: Point, func: (mousePosition: Point, registration: InteractionRegistration) => boolean): boolean {
		let interactionUnits = this.active;
		let causedInteraction = false;
	
		// We determine first which registrations need to be triggered.
		for (let i = 0; i < interactionUnits.length; i++) {
			let unit = interactionUnits[i];

			if (unit instanceof InteractionGroup) {
				let result = unit.findTriggeredMouseRegistrations(acc, interaction, event, mousePosition, func);
				if (!result) continue;

				causedInteraction = true;
				if (!unit.passThrough) break;
			} else if (unit instanceof InteractionRegistration) {
				if (!unit.handlesInteraction(interaction, event)) continue;
	
				let result = func(mousePosition, unit);
				if (!result) continue;
		
				acc.push(unit);
				causedInteraction = true;
				if (!unit.passThrough) break;
			}
		}

		return causedInteraction;
	}

	handleMouseEnterAndLeave(acc: Map<InteractionRegistration, Interaction>, mousePosition: Point, collided: boolean) {
		let interactionUnits = this.active;

		for (let i = 0; i < interactionUnits.length; i++) {
			let unit = interactionUnits[i];

			if (unit instanceof InteractionGroup) {
				let causedAction = unit.handleMouseEnterAndLeave(acc, mousePosition, collided);
				if (causedAction && !unit.passThrough) collided = true;
			} else if (unit instanceof InteractionRegistration) {
				if (!collided && unit.handlesInteraction('mouseEnter', null)) {
					let overlaps = unit.overlaps(mousePosition.x, mousePosition.y);

					if (overlaps) {
						if (!unit.mouseInside) acc.set(unit, 'mouseEnter');
						if (!unit.passThrough) collided = true;
						unit.mouseInside = true;
					} else {
						if (unit.mouseInside) acc.set(unit, 'mouseLeave');
						unit.mouseInside = false;
					}
				} else {
					if (unit.mouseInside) acc.set(unit, 'mouseLeave');
					unit.mouseInside = false;
				}
			}
		}

		return collided;
	}
}
rootInteractionGroup = new InteractionGroup();

inputEventEmitter.addListener('mouseDown', (e) => rootInteractionGroup.handleMouseInteraction('mouseDown', e, (pos, reg) => {
	return reg.overlaps(pos.x, pos.y);
}));

inputEventEmitter.addListener('mouseDown', (e) => rootInteractionGroup.handleMouseInteraction('mouseClick', e, (pos, reg) => {
	let overlaps = reg.overlaps(pos.x, pos.y);
	if (overlaps) reg.pressedDown[e.button] = true;

	return false; // Never trigger mouseClick, just set the flag.
}));

inputEventEmitter.addListener('mouseUp', (e) => rootInteractionGroup.handleMouseInteraction('mouseUp', e, (pos, reg) => {
	return reg.overlaps(pos.x, pos.y);
}));

inputEventEmitter.addListener('mouseUp', (e) => rootInteractionGroup.handleMouseInteraction('mouseClick', e, (pos, reg) => {
	let success = false;
	let overlaps = reg.overlaps(pos.x, pos.y);
	if (overlaps && reg.pressedDown[e.button] === true) success = true;

	reg.pressedDown[e.button] = false;

	return success;
}));

inputEventEmitter.addListener('mouseMove', (e) => rootInteractionGroup.handleMouseInteraction('mouseMove', e, (pos, reg) => {
	return reg.overlaps(pos.x, pos.y);
}));

let lastMouseMoveHandleTime = -Infinity;
function onMouseMove(e: MouseEvent) {
	lastMouseMoveHandleTime = performance.now();

	let acc = new Map<InteractionRegistration, Interaction>();
	rootInteractionGroup.handleMouseEnterAndLeave(acc, getCurrentMousePosition(), false);

	acc.forEach((interaction, reg) => {
		reg.trigger(interaction, e);
	});
}
inputEventEmitter.addListener('mouseMove', onMouseMove);

addRenderingTask((now) => {
	if (now - lastMouseMoveHandleTime >= 1000/30) onMouseMove(null); // Call it, even though the mouse didn't move, so that we catch objects having moved out of or into the cursor.
});

inputEventEmitter.addListener('wheel', (e) => rootInteractionGroup.handleMouseInteraction('wheel', e, (pos, reg) => {
	return reg.overlaps(pos.x, pos.y);
}));

inputEventEmitter.addListener('mouseMove', () => {
	if (!getCurrentMouseButtonState().lmb) return;

	let mousePos = getCurrentMousePosition();
	let now = performance.now();

	for (let i = 0; i < currentDragActions.length; i++) {
		let action = currentDragActions[i];
		let dt = now - action.lastTime;
		let movementVec = subtractFromPoint(clonePoint(mousePos), action.lastPos);
		let velocityVec = scaleVector2(clonePoint(movementVec), 1000 / dt);
		let distanceFromStart = subtractFromPoint(clonePoint(mousePos), action.startPos);

		let dragMoveData: DragMoveData = {
			newPoint: mousePos,
			movement: movementVec,
			dt: dt,
			velocity: velocityVec,
			distanceFromStart: distanceFromStart,
			elapsedTime: now - action.startTime
		};

		if (action.onDragMove) action.onDragMove(dragMoveData);

		action.lastPos = mousePos;
		action.lastTime = now;
		action.lastDragMoveData = dragMoveData;
	}
});

inputEventEmitter.addListener('mouseUp', () => {
	let now = performance.now();

	for (let i = 0; i < currentDragActions.length; i++) {
		let action = currentDragActions[i];

		if (action.onDragEnd) {
			let data: DragMoveData;

			if (!action.lastDragMoveData) {
				data = {
					newPoint: action.startPos,
					movement: {x: 0, y: 0},
					dt: now - action.startTime,
					velocity: {x: 0, y: 0},
					distanceFromStart: {x: 0, y: 0},
					elapsedTime: now - action.startTime
				};
			} else {
				let thresholdReached = (now - action.lastTime) > 1000/60;

				data = {
					newPoint: action.lastPos,
					movement: thresholdReached? {x: 0, y: 0} : action.lastDragMoveData.movement,
					dt: thresholdReached? now - action.lastTime + 1000/60 : action.lastDragMoveData.dt, // TODO: Is this sensible?
					velocity: thresholdReached? {x: 0, y: 0} : action.lastDragMoveData.velocity,
					distanceFromStart: action.lastDragMoveData.distanceFromStart,
					elapsedTime: thresholdReached? now - action.startTime : action.lastDragMoveData.elapsedTime
				};
			}

			action.onDragEnd(data);
		}
	}

	currentDragActions.length = 0;
});

inputEventEmitter.addListener('keyDown', (e) => {
	rootInteractionGroup.triggerAll('keyDown', e);
});

inputEventEmitter.addListener('keyUp', (e) => {
	rootInteractionGroup.triggerAll('keyUp', e);
});