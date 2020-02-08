import { BeatmapSet } from "../../datamodel/beatmap_set";
import { Beatmap } from "../../datamodel/beatmap";
import { songSelectContainer, songSelectInteractionGroup } from "./song_select";
import { BeatmapDetailsTab } from "./beatmap_details_tab";
import { addRenderingTask } from "../../visuals/rendering";
import { getBitmapFromImageFile, BitmapQuality } from "../../util/image_util";
import { fitSpriteIntoContainer } from "../../util/pixi_util";
import { calculateRatioBasedScalingFactor } from "../../util/graphics_util";
import { EaseType, MathUtil } from "../../util/math_util";
import { ExtendedBeatmapData } from "../../datamodel/beatmap_util";
import { TabSelector } from "../components/tab_selector";
import { BeatmapRankingTab } from "./beatmap_ranking_tab";
import { REFERENCE_SCREEN_HEIGHT, currentWindowDimensions } from "../../visuals/ui";
import { Interpolator, InterpolatedValueChanger } from "../../util/interpolation";
import { Interactivity } from "../../input/interactivity";

export const INFO_PANEL_WIDTH = 520;
export const INFO_PANEL_HEIGHT = 260;
const IMAGE_FADE_IN_TIME = 333;
const beatmapInfoPanelInteractionGroup = Interactivity.createGroup();
beatmapInfoPanelInteractionGroup.setZIndex(2);
setTimeout(() => songSelectInteractionGroup.add(beatmapInfoPanelInteractionGroup)); // TEMP OMFGG

let infoPanelMask = document.createElement('canvas');
let infoPanelMaskCtx = infoPanelMask.getContext('2d');
let infoPanelGradient = document.createElement('canvas');
let infoPanelGradientCtx = infoPanelGradient.getContext('2d');
export let beatmapInfoPanel: BeatmapInfoPanel = null;

export function initBeatmapInfoPanel() {
	beatmapInfoPanel = new BeatmapInfoPanel();
	songSelectContainer.addChild(beatmapInfoPanel.container);

	updateBeatmapInfoPanelSizing();
}

let beatmapInfoPanelScalingFactor = 1.0;
export function getBeatmapInfoPanelScalingFactor() {
	return beatmapInfoPanelScalingFactor;
}

function updateInfoPanelMask() {
	let scalingFactor = getBeatmapInfoPanelScalingFactor();
	let slantWidth = INFO_PANEL_HEIGHT/5;

	infoPanelMask.setAttribute('width', String(Math.ceil((INFO_PANEL_WIDTH + slantWidth) * scalingFactor)));
	infoPanelMask.setAttribute('height', String(Math.ceil(INFO_PANEL_HEIGHT * scalingFactor)));

	infoPanelMaskCtx.clearRect(0, 0, infoPanelMask.width, infoPanelMask.height);

	infoPanelMaskCtx.beginPath();
	infoPanelMaskCtx.moveTo(0, 0);
	infoPanelMaskCtx.lineTo(Math.floor(slantWidth * scalingFactor), Math.floor(INFO_PANEL_HEIGHT * scalingFactor));
	infoPanelMaskCtx.lineTo(Math.floor((slantWidth + INFO_PANEL_WIDTH) * scalingFactor), Math.floor(INFO_PANEL_HEIGHT * scalingFactor));
	infoPanelMaskCtx.lineTo(Math.floor(INFO_PANEL_WIDTH * scalingFactor), 0);
	infoPanelMaskCtx.closePath();

	infoPanelMaskCtx.fillStyle = '#ffffff';
	infoPanelMaskCtx.fill();
}

function updateInfoPanelGradient() {
	let scalingFactor = getBeatmapInfoPanelScalingFactor();
	let slantWidth = INFO_PANEL_HEIGHT/5;

	infoPanelGradient.setAttribute('width', String(Math.ceil((INFO_PANEL_WIDTH + slantWidth) * scalingFactor)));
	infoPanelGradient.setAttribute('height', String(Math.ceil(INFO_PANEL_HEIGHT * scalingFactor)));

	infoPanelGradientCtx.clearRect(0, 0, infoPanelGradient.width, infoPanelGradient.height);

	let gradient = infoPanelGradientCtx.createLinearGradient(0, infoPanelGradient.height, 0, 0);
	gradient.addColorStop(0, 'rgba(0,0,0,0.55)');
	gradient.addColorStop(0.38, 'rgba(0,0,0,0.0)');
	infoPanelGradientCtx.fillStyle = gradient;
	infoPanelGradientCtx.fillRect(0, 0, infoPanelGradient.width, infoPanelGradient.height);
}

export function updateBeatmapInfoPanelSizing() {
	if (!beatmapInfoPanel) return;

	beatmapInfoPanelScalingFactor = calculateRatioBasedScalingFactor(currentWindowDimensions.width, currentWindowDimensions.height, 16/9, REFERENCE_SCREEN_HEIGHT);

	let scalingFactor = getBeatmapInfoPanelScalingFactor();

	beatmapInfoPanel.container.x = Math.floor(40 * scalingFactor);
	beatmapInfoPanel.container.y = Math.floor(currentWindowDimensions.height/2 - 240 * scalingFactor);

	beatmapInfoPanel.resize();
}

addRenderingTask((now) => {
	if (!beatmapInfoPanel) return;
	beatmapInfoPanel.update(now);
});

export interface BeatmapInfoPanelTab {
	resize: Function;
	update: (now: number) => any;
	focus: Function;

	container: PIXI.Container;
}

export class BeatmapInfoPanel {
	private currentBeatmapSet: BeatmapSet = null;

	public container: PIXI.Container;
	private upperPanelContainer: PIXI.Container;
	private mask: PIXI.Sprite;
	private backgroundImageContainer: PIXI.Container;
	private markedForDeletionImages = new WeakSet<PIXI.Container>();
	private imageInterpolators = new WeakMap<PIXI.Container, Interpolator>();
	private darkening: PIXI.Sprite;
	private titleText: PIXI.Text;
	private artistText: PIXI.Text;
	private mapperTextPrefix: PIXI.Text; // Need to have two separate text thingeys because they have different styling, and PIXI isn't flexible enough
	private mapperText: PIXI.Text;
	private difficultyText: PIXI.Text;
	private detailsFadeIn: Interpolator;
	private tabSelector: TabSelector;
	private tabBackground: PIXI.Sprite;
	private tabBackgroundHeightInterpolator: InterpolatedValueChanger;
	private tabs: BeatmapInfoPanelTab[] = [];
	private currentTabIndex: number = null;
	private tabFadeInterpolators = new WeakMap<BeatmapInfoPanelTab, Interpolator>();

	constructor() {
		this.container = new PIXI.Container();

		this.upperPanelContainer = new PIXI.Container();
		this.container.addChild(this.upperPanelContainer);

		let shadow = new PIXI.filters.DropShadowFilter({
			rotation: 45,
			distance: 6,
			alpha: 0.25,
			blur: 0,
			quality: 10,
			pixelSize: 0.1
		});

		this.detailsFadeIn = new Interpolator({
			duration: 500,
			ease: EaseType.EaseOutCubic,
			defaultToFinished: true
		});

		this.mask = new PIXI.Sprite();
		this.upperPanelContainer.addChild(this.mask);
		this.upperPanelContainer.filters = [shadow];
		this.upperPanelContainer.mask = this.mask;

		this.backgroundImageContainer = new PIXI.Container();
		this.upperPanelContainer.addChild(this.backgroundImageContainer);

		this.darkening = new PIXI.Sprite();
		this.upperPanelContainer.addChild(this.darkening);

		this.titleText = new PIXI.Text('');
		this.upperPanelContainer.addChild(this.titleText);
		this.artistText = new PIXI.Text('');
		this.upperPanelContainer.addChild(this.artistText);
		this.mapperTextPrefix = new PIXI.Text('');
		this.upperPanelContainer.addChild(this.mapperTextPrefix);
		this.mapperText = new PIXI.Text('');
		this.upperPanelContainer.addChild(this.mapperText);
		this.difficultyText = new PIXI.Text('');
		this.difficultyText.anchor.set(1.0, 0.0);
		this.upperPanelContainer.addChild(this.difficultyText);

		this.tabSelector = new TabSelector(["Details", "Ranking"]);
		this.container.addChild(this.tabSelector.container);

		this.tabBackground = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.tabBackground.tint = 0x000000;
		this.tabBackground.alpha = 0.4;
		this.container.addChild(this.tabBackground);

		this.tabs = [new BeatmapDetailsTab(this), new BeatmapRankingTab(this)];
		for (let t of this.tabs) {
			this.container.addChild(t.container);

			let interpolator = new Interpolator({
				duration: 150,
				ease: EaseType.EaseOutCubic,
				reverseEase: EaseType.EaseInCubic,
				beginReversed: true,
				defaultToFinished: true
			});
			this.tabFadeInterpolators.set(t, interpolator);
		}

		this.selectTab(0);
		this.initInteraction();
		this.resize();
	}

	private initInteraction() {
		let reg = Interactivity.registerDisplayObject(this.container);
		reg.enableEmptyListeners(['wheel']);
		reg.setZIndex(-1);
		beatmapInfoPanelInteractionGroup.add(reg);

		this.tabSelector.addListener('selection', (index: number) => this.selectTab(index));
		beatmapInfoPanelInteractionGroup.add(this.tabSelector.interactionGroup);
	}
	
	private selectTab(index: number) {
		if (index === this.currentTabIndex) return;
		this.currentTabIndex = index;

		let now = performance.now();

		for (let i = 0; i < this.tabs.length; i++) {
			let tab = this.tabs[i];
			let isSelected = i === this.currentTabIndex;
			let interpolator = this.tabFadeInterpolators.get(tab);

			if (isSelected) {
				interpolator.setReversedState(false, now);
				tab.focus();
			} else {
				interpolator.setReversedState(true, now);
			}
		}
	}

	async loadBeatmapSet(representingBeatmap: Beatmap) {
		let beatmapSet = representingBeatmap.beatmapSet;
		if (this.currentBeatmapSet === beatmapSet) return;

		let now = performance.now();

		let imageFile = await representingBeatmap.getBackgroundImageFile();
		if (imageFile) {
			let bitmap = await getBitmapFromImageFile(imageFile, BitmapQuality.Medium);
			let texture = PIXI.Texture.from(bitmap as any);

			let newSprite = new PIXI.Sprite(texture);
			fitSpriteIntoContainer(newSprite, this.mask.width, this.mask.height);

			let spriteContainer = new PIXI.Container();
			spriteContainer.addChild(newSprite);
			spriteContainer.pivot.set(this.mask.width / 2, this.mask.height / 2);
			spriteContainer.position.copyFrom(spriteContainer.pivot);

			for (let obj of this.backgroundImageContainer.children) {
				let container = obj as PIXI.Container;
				if (this.markedForDeletionImages.has(container)) continue;

				this.markedForDeletionImages.add(container);
				setTimeout(() => this.backgroundImageContainer.removeChild(container), IMAGE_FADE_IN_TIME);
			}

			this.backgroundImageContainer.addChild(spriteContainer);

			let interpolator = new Interpolator({
				duration: 333,
				ease: EaseType.EaseOutCubic
			});
			interpolator.start(now);
			this.imageInterpolators.set(spriteContainer, interpolator);
		}

		this.updateText(representingBeatmap, false);
		this.detailsFadeIn.start(now);
	}

	private updateText(beatmap: Beatmap | ExtendedBeatmapData, showDifficulty = true) {
		this.titleText.text = beatmap.title + ' ';
		this.artistText.text = beatmap.artist + ' ';
		this.mapperTextPrefix.text = 'Mapped by ';
		this.mapperText.text = beatmap.creator + ' ';
		this.difficultyText.text = (showDifficulty)? beatmap.version + ' ' : '';

		this.positionMapperText();
	}

	async loadBeatmapData(extendedData: ExtendedBeatmapData) {
		this.updateText(extendedData);

		let detailsTab = this.tabs[0] as BeatmapDetailsTab;
		detailsTab.loadBeatmapData(extendedData);
	}

	private positionMapperText() {
		this.mapperText.x = Math.floor(this.mapperTextPrefix.x + this.mapperTextPrefix.width);
		this.mapperText.y = Math.floor(this.mapperTextPrefix.y - (this.mapperText.height - this.mapperTextPrefix.height) / 2);
	}

	resize() {
		let scalingFactor = getBeatmapInfoPanelScalingFactor();

		updateInfoPanelMask();
		this.mask.texture = PIXI.Texture.from(infoPanelMask);
		this.mask.texture.update();

		updateInfoPanelGradient();
		this.darkening.texture = PIXI.Texture.from(infoPanelGradient);
		this.darkening.texture.update();

		for (let obj of this.backgroundImageContainer.children) {
			let container = obj as PIXI.Container;
			let sprite = container.children[0] as PIXI.Sprite;

			fitSpriteIntoContainer(sprite, this.mask.width, this.mask.height);
			container.pivot.set(this.mask.width / 2, this.mask.height / 2);
			container.position.copyFrom(container.pivot);
		}

		this.titleText.style = {
			fontFamily: 'Exo2-Regular',
			fill: 0xffffff,
			fontStyle: 'italic',
			fontSize: Math.floor(22 * scalingFactor),
			dropShadow: true,
			dropShadowDistance: 1,
			dropShadowBlur: 0
		};
		this.titleText.position.set((INFO_PANEL_HEIGHT/5 + 12) * scalingFactor, (INFO_PANEL_HEIGHT - 80) * scalingFactor);
		this.titleText.x = Math.floor(this.titleText.x);
		this.titleText.y = Math.floor(this.titleText.y);

		this.artistText.style = {
			fontFamily: 'Exo2-Regular',
			fill: 0xffffff,
			fontStyle: 'italic',
			fontSize: Math.floor(14 * scalingFactor),
			dropShadow: true,
			dropShadowDistance: 1,
			dropShadowBlur: 0
		};
		this.artistText.position.set((INFO_PANEL_HEIGHT/5 + 12) * scalingFactor, (INFO_PANEL_HEIGHT - 57) * scalingFactor);
		this.artistText.x = Math.floor(this.artistText.x);
		this.artistText.y = Math.floor(this.artistText.y);

		this.mapperTextPrefix.style = {
			fontFamily: 'Exo2-Light',
			fill: 0xffffff,
			fontStyle: 'italic',
			fontSize: Math.floor(12 * scalingFactor),
			dropShadow: true,
			dropShadowDistance: 1,
			dropShadowBlur: 0
		};
		this.mapperTextPrefix.position.set((INFO_PANEL_HEIGHT/5 + 12) * scalingFactor, (INFO_PANEL_HEIGHT - 27) * scalingFactor);
		this.mapperTextPrefix.x = Math.floor(this.mapperTextPrefix.x);
		this.mapperTextPrefix.y = Math.floor(this.mapperTextPrefix.y);

		this.mapperText.style = {
			fontFamily: 'Exo2-Bold',
			fill: 0xffffff,
			fontStyle: 'italic',
			fontSize: Math.floor(12 * scalingFactor),
			dropShadow: true,
			dropShadowDistance: 1,
			dropShadowBlur: 0
		};
		this.mapperText.position.set((INFO_PANEL_HEIGHT/5 + 12) * scalingFactor, (INFO_PANEL_HEIGHT - 27) * scalingFactor);
		this.mapperText.x = Math.floor(this.mapperText.x);
		this.mapperText.y = Math.floor(this.mapperText.y);

		this.positionMapperText();

		this.difficultyText.style = {
			fontFamily: 'Exo2-Regular',
			fill: 0xffffff,
			fontStyle: 'italic',
			fontSize: Math.floor(12 * scalingFactor),
			dropShadow: true,
			dropShadowDistance: 1,
			dropShadowBlur: 0
		};
		this.difficultyText.position.set((INFO_PANEL_WIDTH + INFO_PANEL_HEIGHT/5 - 20) * scalingFactor, (INFO_PANEL_HEIGHT - 27) * scalingFactor);
		this.difficultyText.x = Math.floor(this.difficultyText.x);
		this.difficultyText.y = Math.floor(this.difficultyText.y);

		this.tabSelector.resize(scalingFactor);
		this.tabSelector.container.y = Math.floor((INFO_PANEL_HEIGHT + 25) * scalingFactor);
		this.tabSelector.container.x = Math.floor((INFO_PANEL_HEIGHT/5 + 10) * scalingFactor);

		let tabX = Math.floor((INFO_PANEL_HEIGHT/5) * scalingFactor);
		let tabY = Math.floor((INFO_PANEL_HEIGHT + 25) * scalingFactor);

		for (let t of this.tabs) {
			t.resize();
			t.container.position.set(tabX, tabY);
		}

		this.tabBackground.width = Math.floor(INFO_PANEL_WIDTH * scalingFactor);
		this.tabBackground.position.set(tabX, tabY);
	}

	update(now: number) {
		let scalingFactor = getBeatmapInfoPanelScalingFactor();
		let fadeInValue = this.detailsFadeIn.getCurrentValue(now);

		this.difficultyText.alpha = fadeInValue;

		this.titleText.pivot.x = -(1 - fadeInValue) * 10 * scalingFactor;
		this.artistText.pivot.x = this.titleText.pivot.x * 0.666;
		this.mapperText.pivot.x = this.mapperTextPrefix.pivot.x = this.titleText.pivot.x * 0.333;

		for (let obj of this.backgroundImageContainer.children) {
			let container = obj as PIXI.Container;
			let interpolator = this.imageInterpolators.get(container);
			let value = interpolator.getCurrentValue(now);

			container.alpha = value;
			container.scale.set(MathUtil.lerp(1.07, 1.0, value));
		}

		this.tabSelector.update(now);
		this.tabs[this.currentTabIndex].update(now);

		for (let t of this.tabs) {
			let interpolator = this.tabFadeInterpolators.get(t);
			let value = interpolator.getCurrentValue(now);

			t.container.alpha = value;
			t.container.visible = value !== 0;
		}

		this.tabBackground.height = Math.floor(this.tabBackgroundHeightInterpolator.getCurrentValue(now) * scalingFactor);
	}

	setTabBackgroundNormalizedHeight(executer: BeatmapInfoPanelTab, height: number) {
		if (executer !== this.tabs[this.currentTabIndex]) return;

		if (!this.tabBackgroundHeightInterpolator) {
			this.tabBackgroundHeightInterpolator = new InterpolatedValueChanger({
				initial: height,
				ease: EaseType.EaseOutCubic,
				duration: 150
			});
		} else {
			this.tabBackgroundHeightInterpolator.setGoal(height, performance.now());
		}
	}
}