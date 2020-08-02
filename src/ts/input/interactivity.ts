import { inputEventEmitter, getCurrentMousePosition, getCurrentMouseButtonState, MouseButton } from "./input";
import { Point, Vector2, subtractFromPoint, clonePoint, scaleVector2 } from "../util/point";
import { addRenderingTask } from "../visuals/rendering";
import { insertItem, removeItem, pushItemUnique, EMPTY_FUNCTION, NormalizedWheelEvent, jsonClone } from "../util/misc_util";
import { KeybindName } from "./key_bindings";
import { globalState } from "../global_state";
import { currentWindowDimensions, uiEventEmitter } from "../visuals/ui";

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

interface KeybindEventData {
	keyIndex: number,
	sourceEvent: InteractionEventMap[keyof InteractionEventMap]
}

const zIndexComparator = (a: InteractionUnit, b: InteractionUnit) => b.getZIndex() - a.getZIndex();

let interactionArray = ['mouseDown', 'mouseUp', 'mouseClick', 'mouseEnter', 'mouseLeave', 'mouseMove', 'wheel', 'keyDown', 'keyUp'] as const;
type Interaction = (typeof interactionArray)[number];
type KeybindAction = 'down' | 'up';
type KeybindListener = (data: KeybindEventData) => void | boolean;

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
	}

	disable() {
		if (!this.enabled) return;
		this.enabled = false;
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
		if (this.parent) {
			removeItem(this.parent.children, this);
			insertItem(this.parent.children, this, zIndexComparator, true);
		}
	}
}

export class InteractionRegistration extends InteractionUnit {
	public obj: PIXI.DisplayObject | PIXI.DisplayObject["hitArea"];

	private listeners: Map<Interaction, ((data?: any) => void | boolean)[]> = new Map();
	private keybindListeners: Map<KeybindName, Map<KeybindAction, KeybindListener[]>> = new Map();

	public mouseInside = false;
	public pressedDown: {[button: number]: boolean} = {
		// A necessary flag in order to make clicking work (CLICKING, not mouse-downing!!)
		[MouseButton.Left]: false,
		[MouseButton.Middle]: false,
		[MouseButton.Right]: false
	};
	private allMouseButtons = false;
	private dragInitiationListener: () => void = null;

	constructor(obj?: InteractionRegistration["obj"], enabled = true) {
		super();

		this.obj = obj;

		if (enabled) this.enable();
		else this.disable();
	}
	
	/** If the listener returns 'true', that means: Stop input event propagation. */
	addListener<K extends keyof InteractionEventMap>(interaction: K, func: (data?: InteractionEventMap[K]) => void | boolean) {
		let arr = this.listeners.get(interaction);
		if (!arr) {
			arr = [];
			this.listeners.set(interaction, arr);
		}

		pushItemUnique(arr, func);
	}

	removeListener(interaction: Interaction, func: (data?: any) => void | boolean) {
		let arr = this.listeners.get(interaction);
		if (!arr) return;

		removeItem(arr, func);
	}

	addKeybindListener(keybind: KeybindName, action: KeybindAction, func: KeybindListener) {
		if (!this.keybindListeners.get(keybind)) this.keybindListeners.set(keybind, new Map());
		let actions = this.keybindListeners.get(keybind);
		if (!actions.get(action)) actions.set(action, []);
		let arr = actions.get(action);

		arr.push(func);
	}

	removeKeybindListener(keybind: KeybindName, action: KeybindAction, func: KeybindListener) {
		let actions = this.keybindListeners.get(keybind);
		if (!actions) return;
		let arr = actions.get(action);
		if (!arr) return;

		removeItem(arr, func);
	}

	/** Adds empty listeners to every interaction type. The point of this is that this allows a non-passthrough object to basically "catch" all interactions and not let anything pass through (good for backgrounds of containers or popups, for example) */
	enableEmptyListeners(exclude: Interaction[] = []) {
		for (let interaction of interactionArray) {
			if (!exclude.includes(interaction)) this.addListener(interaction, EMPTY_FUNCTION);
		}
	}

	disableEmptyListeners(exclude: Interaction[] = []) {
		for (let interaction of interactionArray) {
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

			if (onDragStart) return onDragStart();
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

		let parentOverlaps = this.parent? this.parent.overlaps(x, y) : true;
		if (!parentOverlaps) return false;

		if (this.obj instanceof PIXI.DisplayObject) {
			if (this.obj.hitArea) {
				let pos = this.obj.getGlobalPosition();
				return this.obj.hitArea.contains(x - pos.x, y - pos.y);
			} else {
				let result = this.obj.getBounds().contains(x, y);
				return result;
			}
		} else {
			return this.obj.contains(x, y);
		}
	}

	/** Gets the key combination associated with the event. For example, if it's a keyDown with key R, this will be "KeyR". If it's left click while shift is being held, this will be "Shift MB0". */
	private getKeybindKeyForInteractionEvent<K extends Interaction>(interaction: K, event: InteractionEventMap[K]) {
		if (!event) return null;

		let result: string;

		if (interaction === 'keyDown' || interaction === 'keyUp') {
			let keyboardEvent = event as KeyboardEvent;

			// Incase the pressed-down button is one of these, use the 'key' property, since it doesn't include the "left/right" which we don't care about.
			if (["Shift", "Ctrl", "Meta", "Alt"].includes(keyboardEvent.key)) result = keyboardEvent.key;
			else result = keyboardEvent.code;
		}
		else if (interaction === 'mouseDown' || interaction === 'mouseUp') result = 'MB' + (event as MouseEvent).button;
		else if (interaction === 'wheel') result = ((event as NormalizedWheelEvent).dy > 0)? 'WheelDown' : 'WheelUp';

		if (result) {
			let keyboardEvent = event as KeyboardEvent;
			let modifiers: string[] = [];

			if (keyboardEvent.shiftKey && result !== "Shift") modifiers.push("Shift");
			if (keyboardEvent.ctrlKey && result !== "Ctrl") modifiers.push("Ctrl");
			if (keyboardEvent.metaKey && result !== "Meta") modifiers.push("Meta");
			if (keyboardEvent.altKey && result !== "Alt") modifiers.push("Alt");

			if (modifiers.length > 0) return modifiers.join(' ') + ' ' + result;
			else return result;
		}

		return null;
	}

	/** Returns down or up based on the event. */
	private getKeybindActionForInteractionEvent<K extends Interaction>(interaction: K, event: InteractionEventMap[K]): KeybindAction {
		if (interaction === 'keyDown' || interaction === 'mouseDown' || interaction === 'wheel') return 'down';
		else return 'up';
	}

	handlesInteraction<K extends Interaction>(interaction: K, event: InteractionEventMap[K]) {
		if (this.keybindListeners.size > 0) {
			let key = this.getKeybindKeyForInteractionEvent(interaction, event);
			if (key) {
				let action = this.getKeybindActionForInteractionEvent(interaction, event);
				for (let [keybindName, actions] of this.keybindListeners) {
					if (!globalState.keybindings[keybindName].includes(key)) continue;
					if (actions.get(action) && actions.get(action).length > 0) return true; // This interaction would cause a keybind to trigger
				}
			}
		}

		let arr = this.listeners.get(interaction);
		if (!arr) return false;
		if (arr.length === 0) return false;

		if (interaction === 'mouseDown' || interaction === 'mouseUp' || interaction === 'mouseClick') {
			let mouseEvent = event as MouseEvent;
			if (!this.allMouseButtons && mouseEvent.button !== MouseButton.Left) return false;
		}

		return true;
	}
	
	/** Note: If this method returns 'true', then that means that one of the called listeners returned true, which signals to stop the input event from propagating. */
	trigger<K extends Interaction>(interaction: K, event: InteractionEventMap[K]) {
		// Execute keybinds before the rest
		if (this.keybindListeners.size > 0) {
			let key = this.getKeybindKeyForInteractionEvent(interaction, event);
			if (key) {
				let action = this.getKeybindActionForInteractionEvent(interaction, event);
				for (let [keybindName, actions] of this.keybindListeners) {
					let keyIndex = globalState.keybindings[keybindName].indexOf(key);
					if (keyIndex === -1) continue;
	
					let arr = actions.get(action);
					if (arr && arr.length > 0) {
						let eventData: KeybindEventData = {
							keyIndex,
							sourceEvent: event
						};

						// Make keybinds cancel default browser behavior. This allows something like Ctrl S not to bring up the built-in "save the website" popup.
						(event as KeyboardEvent).preventDefault();
 
						for (let i = 0; i < arr.length; i++) {
							let result = arr[i](eventData);
							if (result === true) return true;
						}
					}
				}
			}
		}

		let arr = this.listeners.get(interaction);
		if (!arr) return;

		for (let i = 0; i < arr.length; i++) {
			let result = arr[i](event);
			if (result === true) return true;
		}

		return false;
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
	/** The interactive area of the group can be constrained by setting this. */
	public hitArea: PIXI.DisplayObject["hitArea"] = null;

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

			insertItem(this.children, newChild, zIndexComparator, true);
			newChild.parent = this;
		}
	}

	remove(...children: InteractionUnit[]) {
		for (let i = 0; i < children.length; i++) {
			let child = children[i];
			if (child.parent !== this) continue;

			removeItem(this.children, child);
			child.parent = null;
		}
	}

	removeAll() {
		this.remove(...this.children);
	}

	overlaps(x: number, y: number): boolean {
		let parentOverlaps = this.parent? this.parent.overlaps(x, y) : true;
		return parentOverlaps && (this.hitArea? this.hitArea.contains(x, y) : true);
	}

	releaseAllPresses() {
		for (let i = 0; i < this.children.length; i++) {
			this.children[i].releaseAllPresses();
		}
	}

	/**
	 * Handles interactions.
	 * @param event The event triggering this interaction.
	 * @param func A function to run for each registration, which should then return an array of interactions triggered by this event.
	 */
	handleInteraction(event: InteractionEventMap[keyof InteractionEventMap], func: (mousePosition: Point, registration: InteractionRegistration) => Interaction[]) {
		let toTrigger: [InteractionRegistration, Interaction][] = [];

		// First, find all the triggered interactions.
		this.findTriggeredRegistrations(toTrigger, event, getCurrentMousePosition(), func);

		// Then, one after another, we trigger them. This separation happens so that the interaction doesn't trigger additional registrations that could be added as a SIDE-EFFECT of a trigger.
		for (let i = 0; i < toTrigger.length; i++) {
			let result = toTrigger[i][0].trigger(toTrigger[i][1], event);
			if (result) break;
		}
	}

	// Returns true if the interaction was "absorbed" by a non-passthrough interaction unit.
	private findTriggeredRegistrations(acc: [InteractionRegistration, Interaction][], event: InteractionEventMap[keyof InteractionEventMap], mousePosition: Point, func: (mousePosition: Point, registration: InteractionRegistration) => Interaction[]): boolean {
		let interactionUnits = this.children;
	
		// Determine which registrations need to be triggered, recursively
		for (let i = 0; i < interactionUnits.length; i++) {
			let unit = interactionUnits[i];
			if (!unit.enabled) continue;

			if (unit instanceof InteractionGroup) {
				let absorbed = unit.findTriggeredRegistrations(acc, event, mousePosition, func);

				if (absorbed && !unit.passThrough) return true;
			} else if (unit instanceof InteractionRegistration) {
				let triggeredInteractions = func(mousePosition, unit);
				let oneOrMoreHandled = false; // Will be set to true if one or more interactions will be dispatched for this registration.

				for (let j = 0; j < triggeredInteractions.length; j++) {
					let interaction = triggeredInteractions[j];

					if (unit.handlesInteraction(interaction, event)) {
						acc.push([unit, interaction]);
						oneOrMoreHandled = true;
					}
				}

				if (oneOrMoreHandled && !unit.passThrough) return true;
			}
		}

		return false;
	}

	handleMouseEnterAndLeave(acc: Map<InteractionRegistration, Interaction>, mousePosition: Point, collided: boolean) {
		let interactionUnits = this.children;
		
		// Note! At no point in this loop do we break. This is because we wanted to update the mouse enter/leave state for every registration and not terminate early.

		for (let i = 0; i < interactionUnits.length; i++) {
			let unit = interactionUnits[i];
			if (!unit.enabled) continue;

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

inputEventEmitter.addListener('mouseDown', (e) => rootInteractionGroup.handleInteraction(e, (pos, reg) => {
	let overlaps = reg.overlaps(pos.x, pos.y);

	if (overlaps) reg.pressedDown[e.button] = true; // Remember that the button is pressed

	return overlaps? ['mouseDown'] : [];
}));

inputEventEmitter.addListener('mouseUp', (e) => rootInteractionGroup.handleInteraction(e, (pos, reg) => {
	let overlaps = reg.overlaps(pos.x, pos.y);

	// Based on if the corresponding button was pressed down, either dispatch mouseClick or don't.
	let returnValue: Interaction[] = (reg.pressedDown[e.button] === true)? ['mouseUp', 'mouseClick'] : ['mouseUp'];
	reg.pressedDown[e.button] = false; // Set to false always

	if (!overlaps) return [];
	return returnValue;
}));

inputEventEmitter.addListener('mouseMove', (e) => rootInteractionGroup.handleInteraction(e, (pos, reg) => {
	return reg.overlaps(pos.x, pos.y)? ['mouseMove'] : [];
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

inputEventEmitter.addListener('wheel', (e) => rootInteractionGroup.handleInteraction(e, (pos, reg) => {
	return reg.overlaps(pos.x, pos.y)? ['wheel'] : [];
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

inputEventEmitter.addListener('keyDown', (e) => rootInteractionGroup.handleInteraction(e, (pos, reg) => {
	let overlaps = reg.overlaps(pos.x, pos.y);
	return overlaps? ['keyDown'] : [];
}));

inputEventEmitter.addListener('keyUp', (e) => rootInteractionGroup.handleInteraction(e, (pos, reg) => {
	let overlaps = reg.overlaps(pos.x, pos.y);
	return overlaps? ['keyUp'] : [];
}));

/** A utility rectangle whose dimensions are always as big as the window itself. */
export const fullscreenHitRec = new PIXI.Rectangle(0, 0, currentWindowDimensions.width, currentWindowDimensions.height);
uiEventEmitter.addListener('resize', () => {
	fullscreenHitRec.width = currentWindowDimensions.width;
	fullscreenHitRec.height = currentWindowDimensions.height;
});