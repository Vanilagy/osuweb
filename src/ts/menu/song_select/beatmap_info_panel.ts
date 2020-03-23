import { BeatmapSet } from "../../datamodel/beatmap_set";
import { Beatmap } from "../../datamodel/beatmap";
import { BeatmapDetailsTab } from "./beatmap_details_tab";
import { addRenderingTask } from "../../visuals/rendering";
import { getBitmapFromImageFile, BitmapQuality } from "../../util/image_util";
import { fitSpriteIntoContainer, createPolygonTexture, createLinearGradientTexture } from "../../util/pixi_util";
import { calculateRatioBasedScalingFactor } from "../../util/graphics_util";
import { EaseType, MathUtil } from "../../util/math_util";
import { TabSelector } from "../components/tab_selector";
import { BeatmapRankingTab } from "./beatmap_ranking_tab";
import { REFERENCE_SCREEN_HEIGHT, currentWindowDimensions } from "../../visuals/ui";
import { Interpolator, InterpolatedValueChanger } from "../../util/interpolation";
import { InteractionGroup, InteractionRegistration } from "../../input/interactivity";
import { ExtendedBeatmapData } from "../../util/beatmap_util";
import { SongSelect } from "./song_select";
import { BeatmapHeaderPanel } from "../components/beatmap_header_panel";

export const INFO_PANEL_WIDTH = 520;
export const INFO_PANEL_HEADER_HEIGHT = 260;

export interface BeatmapInfoPanelTab {
	resize: Function;
	update: (now: number) => any;
	focus: Function;

	container: PIXI.Container;
}

export class BeatmapInfoPanel {
	public songSelect: SongSelect;
	public container: PIXI.Container;
	public interactionGroup: InteractionGroup;
	public scalingFactor: number = 1.0;

	private currentBeatmapSet: BeatmapSet = null;

	private header: BeatmapHeaderPanel;

	private tabSelector: TabSelector;
	private tabBackground: PIXI.Sprite;
	private tabBackgroundHeightInterpolator: InterpolatedValueChanger;
	private tabs: BeatmapInfoPanelTab[] = [];
	private currentTabIndex: number = null;
	private tabFadeInterpolators = new WeakMap<BeatmapInfoPanelTab, Interpolator>();

	constructor(songSelect: SongSelect) {
		this.songSelect = songSelect;
		this.container = new PIXI.Container();
		this.interactionGroup = new InteractionGroup();
		this.interactionGroup.setZIndex(2);

		this.header = new BeatmapHeaderPanel(INFO_PANEL_WIDTH, INFO_PANEL_HEADER_HEIGHT, true, true);
		this.container.addChild(this.header.container);

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
	}

	private initInteraction() {
		let reg = new InteractionRegistration(this.container);
		reg.enableEmptyListeners(['wheel']);
		reg.setZIndex(-1);
		this.interactionGroup.add(reg);

		this.tabSelector.addListener('selection', (index: number) => this.selectTab(index));
		this.interactionGroup.add(this.tabSelector.interactionGroup);
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
		this.currentBeatmapSet = beatmapSet;

		let imageFile = await representingBeatmap.getBackgroundImageFile();
		await this.header.loadImage(imageFile);
		this.header.updateText(representingBeatmap, false, true);
	}

	async loadBeatmapData(extendedData: ExtendedBeatmapData) {
		this.header.updateText(extendedData, true, false);

		let detailsTab = this.tabs[0] as BeatmapDetailsTab;
		detailsTab.loadBeatmapData(extendedData);
	}

	resize() {
		this.scalingFactor = calculateRatioBasedScalingFactor(currentWindowDimensions.width, currentWindowDimensions.height, 16/9, REFERENCE_SCREEN_HEIGHT);

		this.container.x = Math.floor(40 * this.scalingFactor);
		this.container.y = Math.floor(currentWindowDimensions.height/2 - 240 * this.scalingFactor);

		this.header.resize(this.scalingFactor);

		this.tabSelector.resize(this.scalingFactor);
		this.tabSelector.container.y = Math.floor((INFO_PANEL_HEADER_HEIGHT + 25) * this.scalingFactor);
		this.tabSelector.container.x = Math.floor((INFO_PANEL_HEADER_HEIGHT/5 + 10) * this.scalingFactor);

		let tabX = Math.floor((INFO_PANEL_HEADER_HEIGHT/5) * this.scalingFactor);
		let tabY = Math.floor((INFO_PANEL_HEADER_HEIGHT + 25) * this.scalingFactor);

		for (let t of this.tabs) {
			t.resize();
			t.container.position.set(tabX, tabY);
		}

		this.tabBackground.width = Math.floor(INFO_PANEL_WIDTH * this.scalingFactor);
		this.tabBackground.position.set(tabX, tabY);
	}

	update(now: number) {
		this.header.update(now, this.scalingFactor);

		this.tabSelector.update(now);
		this.tabs[this.currentTabIndex].update(now);

		for (let t of this.tabs) {
			let interpolator = this.tabFadeInterpolators.get(t);
			let value = interpolator.getCurrentValue(now);

			t.container.alpha = value;
			t.container.visible = value !== 0;
		}

		this.tabBackground.height = Math.floor(this.tabBackgroundHeightInterpolator.getCurrentValue(now) * this.scalingFactor);
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