import { SettingsElement } from "./settings_element";
import { SettingsPanel, SETTINGS_PANEL_WIDTH, SETTINGS_PANEL_PADDING } from "./settings_panel";
import { colorToHexNumber, lerpColors, Colors } from "../../util/graphics_util";
import { KeybindName, keybindDescription, KeyDescription, keyLayoutMap } from "../../input/key_bindings";
import { InteractionGroup, InteractionRegistration } from "../../input/interactivity";
import { createPolygonTexture } from "../../util/pixi_util";
import { THEME_COLORS } from "../../util/constants";
import { last, EMPTY_FUNCTION } from "../../util/misc_util";
import { globalState } from "../../global_state";
import { Interpolator } from "../../util/interpolation";
import { EaseType, MathUtil } from "../../util/math_util";

export class KeybindElement extends SettingsElement {
	private titleElement: PIXI.Text;
	private keyElements: KeyElement[] = [];
	public keybindName: KeybindName;

	constructor(parent: SettingsPanel, keybindName: KeybindName) {
		super(parent);

		this.keybindName = keybindName;
		let description = keybindDescription[keybindName];

		this.titleElement = new PIXI.Text(description.displayName, {
			fontFamily: 'Exo2-Light',
			fill: colorToHexNumber({r: 220, g: 220, b: 220})
		});
		this.container.addChild(this.titleElement);

		for (let i = 0; i < description.count; i++) {
			let keyElement = new KeyElement(this, i);
			this.keyElements.push(keyElement);
			this.container.addChild(keyElement.container);
			this.interactionGroup.add(keyElement.interactionGroup);
		}
	}

	get scalingFactor() {
		return this.parent.scalingFactor;
	}

	resize() {
		for (let e of this.keyElements) e.resize();

		this.titleElement.style.fontSize = Math.floor(12 * this.parent.scalingFactor);
		this.titleElement.y = Math.floor((this.keyElements[0].container.height - this.titleElement.height) / 2);
	}

	update(now: number) {
		// Build it up from the right side
		let currentX = (SETTINGS_PANEL_WIDTH - SETTINGS_PANEL_PADDING*2) * this.parent.scalingFactor;
		for (let i = this.keyElements.length-1; i >= 0; i--) {
			let element = this.keyElements[i];
			element.update(now);

			currentX -= element.container.width;
			element.container.x = Math.floor(currentX);
		}
	}

	getHeight() {
		return 16 * this.parent.scalingFactor;
	}

	getBottomMargin(now: number) {
		return 10 * this.parent.scalingFactor;
	}

	deselectAll() {
		for (let e of this.keyElements) e.deselect();
	}
}

const HEIGHT = 20;
const MIN_WIDTH = 60;
/** How much padding there should be to the left and right of the text. This is used to determine the size of the key element. */
const MIN_PADDING = 10;

class KeyElement {
	public container: PIXI.Container;
	public interactionGroup: InteractionGroup;

	private parent: KeybindElement;
	private keyIndex: number;

	private background: PIXI.Sprite;
	private text: PIXI.Text;

	private hoverInterpolator: Interpolator;
	private selectionInterpolator: Interpolator;
	private inSelection = false;
	/** Stores the currently pressed modifiers. */
	private currentModifiers: {
		shift: boolean,
		ctrl: boolean,
		meta: boolean,
		alt: boolean
	} = null;

	constructor(parent: KeybindElement, keyIndex: number) {
		this.parent = parent;
		this.keyIndex = keyIndex;

		this.container = new PIXI.Container();
		this.interactionGroup = new InteractionGroup();

		this.background = new PIXI.Sprite();
		this.background.tint = 0x000000;
		this.background.alpha = 0.8;
		this.container.addChild(this.background);

		this.text = new PIXI.Text("", {
			fontFamily: 'FredokaOne-Regular',
			fill: 0xffffff
		});
		this.container.addChild(this.text);

		this.hoverInterpolator = new Interpolator({
			duration: 150,
			ease: EaseType.EaseOutCubic,
			reverseEase: EaseType.EaseInCubic,
			reverseDuration: 400,
			beginReversed: true,
			defaultToFinished: true
		});
		this.selectionInterpolator = new Interpolator({
			duration: 100,
			beginReversed: true,
			defaultToFinished: true
		});

		this.setText(this.getKeybindValue());

		let registration = new InteractionRegistration(this.background);
		registration.addButtonHandlers(
			EMPTY_FUNCTION,
			() => this.hoverInterpolator.setReversedState(false, performance.now()),
			() => this.hoverInterpolator.setReversedState(true, performance.now()),
			EMPTY_FUNCTION,
			EMPTY_FUNCTION
		);
		registration.allowAllMouseButtons();
		registration.addListener('mouseDown', (e) => {
			if (this.inSelection) {
				e.preventDefault();
				// Create mouse binding
				this.completeSelection('MB' + e.button);

				return true;
			} else {
				if (e.button === 0) {
					if (e.shiftKey) {
						// Reset to default
						globalState.keybindings[this.parent.keybindName][this.keyIndex] = keybindDescription[this.parent.keybindName].default[this.keyIndex];
						this.setText(this.getKeybindValue());
					} else {
						this.select();
					}
				} else if (e.button === 2) {
					// Clear
					globalState.keybindings[this.parent.keybindName][this.keyIndex] = "";
					this.setText("");
				}
			}
		});
		registration.addListener('wheel', (e) => {
			if (this.inSelection) {
				// Create scroll wheel binding
				this.completeSelection(e.dy > 0? 'WheelDown' : 'WheelUp');
				return true;
			}
		});
		registration.addListener('keyDown', (e) => {
			if (!this.inSelection) return;

			e.preventDefault();

			// Remember the modifiers
			if (e.key === 'Shift') this.currentModifiers.shift = true;
			else if (e.key === 'Control') this.currentModifiers.ctrl = true;
			else if (e.key === 'Meta') this.currentModifiers.meta = true;
			else if (e.key === 'Alt') this.currentModifiers.alt = true;
			else {
				this.completeSelection(e.code);
				return true;
			}

			this.setText(this.stringifyCurrentSelection());

			return true;
		});
		registration.addListener('keyUp', (e) => {
			if (!this.inSelection) return;

			// As soon as a key goes up, conclude the key binding process.
			e.preventDefault();
			this.completeSelection(null);
		});

		this.interactionGroup.add(registration);
	}

	private getKeybindValue() {
		return globalState.keybindings[this.parent.keybindName][this.keyIndex];
	}

	private stringifyCurrentSelection() {
		let modifiers: string[] = [];

		// This also ensures consistent modifier order, independent of pressing order
		if (this.currentModifiers.shift) modifiers.push('Shift'); 
		if (this.currentModifiers.ctrl) modifiers.push('Ctrl'); 
		if (this.currentModifiers.meta) modifiers.push('Meta'); 
		if (this.currentModifiers.alt) modifiers.push('Alt');

		// The selection can only contain modifiers anyway, since the last finish element would've already ended the selection process.
		return modifiers.join(' ');
	}

	private completeSelection(finalElement: string) {
		let modifierPart = this.stringifyCurrentSelection();
		if (!modifierPart && !finalElement) {
			this.deselect();
			return;
		}

		let keyDescription: string;
		if (modifierPart.length > 0) {
			if (finalElement) keyDescription = modifierPart + ' ' + finalElement;
			else keyDescription = modifierPart;
		} else {
			keyDescription = finalElement;
		}

		this.setText(keyDescription);
		globalState.keybindings[this.parent.keybindName][this.keyIndex] = keyDescription;

		this.inSelection = false;
		this.currentModifiers = null;
		this.selectionInterpolator.setReversedState(true, performance.now());
	}

	resize() {
		this.text.style.fontSize = Math.floor(11 * this.parent.scalingFactor);
		let adjustedTextWidth = this.text.width / this.parent.scalingFactor;
		let width = Math.max(adjustedTextWidth + MIN_PADDING*2, MIN_WIDTH);

		let slantWidth = HEIGHT/5;
		this.background.texture = createPolygonTexture(width + slantWidth, HEIGHT, [
			new PIXI.Point(0, 0), new PIXI.Point(width, 0), new PIXI.Point(width + slantWidth, HEIGHT), new PIXI.Point(slantWidth, HEIGHT)
		], this.parent.scalingFactor, 0, false, 3);

		this.text.x = Math.floor((this.background.width - this.text.width) / 2 - 1);
		this.text.y = Math.floor((this.background.height - this.text.height) / 2 - 1);
	}

	update(now: number) {
		let hoverValue = this.hoverInterpolator.getCurrentValue(now);
		let selectionValue = this.selectionInterpolator.getCurrentValue(now);
		
		this.background.tint = colorToHexNumber(lerpColors(lerpColors(Colors.Black, Colors.White, hoverValue * 0.15), THEME_COLORS.PrimaryViolet, selectionValue));
		this.background.alpha = MathUtil.lerp(0.8, 1.0, selectionValue);
		this.text.tint = colorToHexNumber(lerpColors(THEME_COLORS.PrimaryViolet, Colors.White, selectionValue));
	}

	setText(input: KeyDescription) {
		this.stringifyKeyDescription(input).then(result => {
			this.text.text = result;
			this.resize();
		});
	}

	/** Turns a key description into a more human-friendly format while being keyboard layout-aware. */
	private async stringifyKeyDescription(input: KeyDescription) {
		let parts = input.split(' ');
		if (parts.length === 0) return '';

		// Just isolate the last part, since the modifiers can stay unchanged.
		let lastPart = last(parts);
		let lastPartConverted: string;

		let map = await keyLayoutMap;
		let value = map.get(lastPart);
		if (value) {
			// Use the value from the keyboard map. This maps things like KeyZ to Y for German keyboards, for example.
			lastPartConverted = value.toUpperCase();
		} else {
			if (lastPart.startsWith('Key')) lastPartConverted = lastPart.slice(3);
			else if (lastPart.startsWith('Digit')) lastPartConverted = lastPart.slice(5);
			else if (lastPart.startsWith('Escape')) lastPartConverted = "Esc";
			else if (lastPart.startsWith('Arrow')) lastPartConverted = lastPart.slice(5);
			else if (lastPart.startsWith('MB')) {
				let button = Number(lastPart.slice(2));

				if (button === 0) lastPartConverted = 'LMB';
				else if (button === 1) lastPartConverted = 'MMB';
				else if (button === 2) lastPartConverted = 'RMB';
				else lastPartConverted = 'MB' + (button + 1);
			}
			else lastPartConverted = lastPart;
		}

		return parts.slice(0, -1).join(' ') + ' ' + lastPartConverted;
	}

	select() {
		this.selectionInterpolator.setReversedState(false, performance.now());
		this.inSelection = true;

		// No modifiers are selected at the started
		this.currentModifiers = {
			shift: false,
			ctrl: false,
			meta: false,
			alt: false
		};
		this.setText("");
	}

	deselect() {
		this.inSelection = false;
		this.currentModifiers = null;
		this.selectionInterpolator.setReversedState(true, performance.now());
		this.setText(this.getKeybindValue());
	}
}