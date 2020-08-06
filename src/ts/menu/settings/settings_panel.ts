import { InteractionGroup, InteractionRegistration, fullscreenHitRec } from "../../input/interactivity";
import { KeyCode } from "../../input/input";
import { Interpolator } from "../../util/interpolation";
import { EaseType, MathUtil } from "../../util/math_util";
import { globalState } from "../../global_state";
import { currentWindowDimensions, REFERENCE_SCREEN_HEIGHT } from "../../visuals/ui";
import { SettingsElement } from "./settings_element";
import { RangeElement } from "./range_element";
import { settingsDescription, SettingType } from "./settings_description";
import { ScrollContainer } from "../components/scroll_container";
import { SectionHeader } from "./section_header";
import { SettingName } from "./settings";
import { CheckboxElement } from "./checkbox_element";
import { SelectionElement } from "./selection_element";
import { TextElement } from "./text_element";
import { KeybindName } from "../../input/key_bindings";
import { KeybindElement } from "./keybind_element";
import { Color } from "../../util/graphics_util";
import { HorizontalLine } from "./horizontal_line";

export const SETTINGS_PANEL_WIDTH = 300;
export const SETTINGS_PANEL_PADDING = 12;

enum LayoutElementType {
	SectionHeader,
	Setting,
	Text,
	Keybinding,
	HorizontalLine
}

interface SectionHeaderLayoutElement {
	type: LayoutElementType.SectionHeader,
	title: string
}

interface SettingLayoutElement {
	type: LayoutElementType.Setting,
	setting: SettingName
}

interface TextLayoutElement {
	type: LayoutElementType.Text,
	text: string,
	identifier: string,
	color?: Color
}

interface KeybindingLayoutElement {
	type: LayoutElementType.Keybinding,
	keybindName: KeybindName
}

interface HorizontalLineLayoutElement {
	type: LayoutElementType.HorizontalLine
}

type LayoutElement = SectionHeaderLayoutElement | SettingLayoutElement | TextLayoutElement | KeybindingLayoutElement | HorizontalLineLayoutElement;

const layout: LayoutElement[] = [
	{ type: LayoutElementType.SectionHeader, title: 'audio' },
	{ type: LayoutElementType.Setting, setting: 'masterVolume' },
	{ type: LayoutElementType.Setting, setting: 'musicVolume' },
	{ type: LayoutElementType.Setting, setting: 'soundEffectsVolume' },
	{ type: LayoutElementType.Setting, setting: 'backgroundAudioBehavior' },
	{ type: LayoutElementType.SectionHeader, title: 'video' },
	{ type: LayoutElementType.Setting, setting: 'showFpsMeter' },
	{ type: LayoutElementType.Setting, setting: 'menuFpsLimit' },
	{ type: LayoutElementType.Setting, setting: 'gameplayFpsLimit' },
	{ type: LayoutElementType.SectionHeader, title: 'skin' },
	{ type: LayoutElementType.Setting, setting: 'ignoreBeatmapSkin' },
	{ type: LayoutElementType.Setting, setting: 'ignoreBeatmapHitSounds' },
	{ type: LayoutElementType.Setting, setting: 'cursorSize' },
	{ type: LayoutElementType.SectionHeader, title: 'gameplay' },
	{ type: LayoutElementType.Setting, setting: 'backgroundDim' },
	{ type: LayoutElementType.Setting, setting: 'enableVideo' },
	{ type: LayoutElementType.Setting, setting: 'enableStoryboard' },
	{ type: LayoutElementType.Setting, setting: 'snakingSliders' },
	{ type: LayoutElementType.Setting, setting: 'showApproachCircleOnFirstHiddenObject' },
	{ type: LayoutElementType.Setting, setting: 'audioOffset' },
	{ type: LayoutElementType.SectionHeader, title: 'input' },
	{ type: LayoutElementType.Setting, setting: 'useSoftwareCursor' },
	{ type: LayoutElementType.Setting, setting: 'mouseSensitivity' },
	{ type: LayoutElementType.Text, text: "A sensitivity factor smaller than 1.0 is only effective in raw input mode.", identifier: 'lowSensitivityWarning' },
	{ type: LayoutElementType.Setting, setting: 'mouseInputMode' },
	{ type: LayoutElementType.Setting, setting: 'showKeyOverlay' },
	{ type: LayoutElementType.Setting, setting: 'disableMouseButtonsDuringGameplay' },
	{ type: LayoutElementType.SectionHeader, title: 'key configuration' },
	{ type: LayoutElementType.Text, text: "Left-click to change, right-click to clear, left-click + shift to reset to default", color: {r: 128, g: 128, b: 128}, identifier: null },
	{ type: LayoutElementType.HorizontalLine },
	{ type: LayoutElementType.Keybinding, keybindName: 'gameButtonA' },
	{ type: LayoutElementType.Keybinding, keybindName: 'gameButtonB' },
	{ type: LayoutElementType.Keybinding, keybindName: 'smoke' },
	{ type: LayoutElementType.HorizontalLine },
	{ type: LayoutElementType.Keybinding, keybindName: 'pause' },
	{ type: LayoutElementType.Keybinding, keybindName: 'restartPlay' },
	{ type: LayoutElementType.Keybinding, keybindName: 'skipBreak' },
	{ type: LayoutElementType.Keybinding, keybindName: 'toggleMouseButtons' },
	{ type: LayoutElementType.Keybinding, keybindName: 'audioOffsetSubtract' },
	{ type: LayoutElementType.Keybinding, keybindName: 'audioOffsetAdd' },
	{ type: LayoutElementType.HorizontalLine },
	{ type: LayoutElementType.Keybinding, keybindName: 'increaseVolume' },
	{ type: LayoutElementType.Keybinding, keybindName: 'decreaseVolume' },
	{ type: LayoutElementType.Keybinding, keybindName: 'playPause' },
	{ type: LayoutElementType.HorizontalLine },
	{ type: LayoutElementType.Keybinding, keybindName: 'toggleSettings' },
	{ type: LayoutElementType.Keybinding, keybindName: 'toggleNotifications' },
	{ type: LayoutElementType.Keybinding, keybindName: 'toggleModSelect' },
	{ type: LayoutElementType.Keybinding, keybindName: 'randomBeatmap' },
	{ type: LayoutElementType.Keybinding, keybindName: 'playBeatmap' },
	{ type: LayoutElementType.Keybinding, keybindName: 'playBeatmapAuto' },
	{ type: LayoutElementType.Keybinding, keybindName: 'playBeatmapCinema' },
	{ type: LayoutElementType.Keybinding, keybindName: 'scrollCarouselUp' },
	{ type: LayoutElementType.Keybinding, keybindName: 'scrollCarouselDown' },
	{ type: LayoutElementType.Keybinding, keybindName: 'searchRemoveWord' },
	{ type: LayoutElementType.Keybinding, keybindName: 'clearSearch' },
];

export class SettingsPanel {
	public container: PIXI.Container;
	public interactionGroup: InteractionGroup;
	public scalingFactor: number = 1.0;

	private panelContainer: PIXI.Container;
	private panelBackground: PIXI.Sprite;

	private scrollContainer: ScrollContainer;

	private fadeInInterpolator: Interpolator;
	private elements: SettingsElement[];

	constructor() {
		this.container = new PIXI.Container();
		this.interactionGroup = new InteractionGroup();

		this.panelContainer = new PIXI.Container();
		this.container.addChild(this.panelContainer);

		let panelRegistration = new InteractionRegistration(this.panelContainer);
		panelRegistration.enableEmptyListeners();
		this.interactionGroup.add(panelRegistration);

		let keyRegistration = new InteractionRegistration(fullscreenHitRec);
		keyRegistration.setZIndex(1);
		keyRegistration.passThrough = true;
		keyRegistration.addListener('keyDown', (e) => {
			if (e.keyCode === KeyCode.Escape) this.hide();
		});
		this.interactionGroup.add(keyRegistration);

		this.panelBackground = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.panelBackground.tint = 0x101010;
		this.panelBackground.alpha = 0.95;
		this.panelContainer.addChild(this.panelBackground);

		this.fadeInInterpolator = new Interpolator({
			duration: 500,
			reverseDuration: 350,
			ease: EaseType.EaseOutQuint,
			reverseEase: EaseType.EaseInQuint,
			beginReversed: true,
			defaultToFinished: true
		});

		this.scrollContainer = new ScrollContainer();
		this.panelContainer.addChild(this.scrollContainer.container);
		this.scrollContainer.interactionGroup.setZIndex(2);
		this.interactionGroup.add(this.scrollContainer.interactionGroup);

		this.elements = this.createElements();
		for (let e of this.elements) {
			this.scrollContainer.contentContainer.addChild(e.container);
			this.scrollContainer.contentInteractionGroup.add(e.interactionGroup);
		}

		this.resize();
		this.hide();
	}

	private createElements() {
		let elements: SettingsElement[] = [];

		for (let layoutElement of layout) {
			switch (layoutElement.type) {
				case LayoutElementType.SectionHeader:
					elements.push(new SectionHeader(this, layoutElement.title)); break;
				case LayoutElementType.Setting: {
					let desc = settingsDescription[layoutElement.setting];
					let setting = layoutElement.setting as any; // 'cause TypeScript

					switch (desc.type) {
						case SettingType.Range: elements.push(new RangeElement(this, setting)); break;
						case SettingType.Checkbox: elements.push(new CheckboxElement(this, setting)); break;
						case SettingType.Selection: elements.push(new SelectionElement(this, setting)); break;
					}
				}; break;
				case LayoutElementType.Text:
					elements.push(new TextElement(this, layoutElement.text, layoutElement.identifier, layoutElement.color)); break;
				case LayoutElementType.Keybinding:
					elements.push(new KeybindElement(this, layoutElement.keybindName)); break;
				case LayoutElementType.HorizontalLine:
					elements.push(new HorizontalLine(this)); break;
			}
		}

		return elements;
	}

	resize() {
		this.scalingFactor = currentWindowDimensions.height / REFERENCE_SCREEN_HEIGHT;

		this.panelContainer.y = globalState.toolbar.currentHeight;
		this.panelBackground.width = Math.floor(SETTINGS_PANEL_WIDTH * this.scalingFactor);
		this.panelBackground.height = currentWindowDimensions.height - this.panelContainer.y;

		this.scrollContainer.setHeight(this.panelBackground.height);
		this.scrollContainer.setWidth(this.panelBackground.width);
		this.scrollContainer.setPadding(Math.floor(SETTINGS_PANEL_PADDING * this.scalingFactor));
		this.scrollContainer.setScrollScalingFactor(this.scalingFactor);
		this.scrollContainer.setScrollbarScalingFactor(this.scalingFactor);

		for (let e of this.elements) e.resize();
	}

	update(now: number) {
		let fadeInCompletion = this.fadeInInterpolator.getCurrentValue(now);
		if (fadeInCompletion === 0) {
			this.container.visible = false;
			return;
		}
		this.container.visible = true;

		this.panelContainer.x = MathUtil.lerp(-this.panelBackground.width, 0, fadeInCompletion);

		let currentY = 0;
		for (let e of this.elements) {
			e.update(now);

			if (currentY > 0) currentY += e.getTopMargin(now);
			e.container.y = Math.floor(currentY);
			currentY += e.getHeight(now) + e.getBottomMargin(now);
		}

		this.scrollContainer.update(now);
	}

	show() {
		this.fadeInInterpolator.setReversedState(false, performance.now());
		this.interactionGroup.enable();

		globalState.notificationPanel.hide();
		globalState.toolbar.enableDim();
	}

	hide() {
		this.fadeInInterpolator.setReversedState(true, performance.now());
		this.interactionGroup.disable();

		globalState.toolbar.disableDim();
		this.deselectAllKeybinds();
	}

	toggle() {
		if (this.interactionGroup.enabled) this.hide();
		else this.show();
	}

	enableElement(name: string) {
		this.elements.find(x => x.identifier === name)?.enable();
	}

	disableElement(name: string) {
		this.elements.find(x => x.identifier === name)?.disable();
	}

	refreshElement(name: string) {
		this.elements.find(x => x.identifier === name)?.refresh();
	}

	private deselectAllKeybinds() {
		for (let e of this.elements) {
			if (e instanceof KeybindElement) {
				e.deselectAll();
			}
		}
	}
}