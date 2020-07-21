import { SongSelect } from "../song_select";
import { InteractionGroup, InteractionRegistration } from "../../../input/interactivity";
import { BeatmapSet } from "../../../datamodel/beatmap/beatmap_set";
import { BeatmapHeaderPanel } from "../../components/beatmap_header_panel";
import { TabSelector } from "../../components/tab_selector";
import { InterpolatedValueChanger, Interpolator } from "../../../util/interpolation";
import { BeatmapDetailsTab } from "./beatmap_details_tab";
import { BeatmapRankingTab } from "./beatmap_ranking_tab";
import { EaseType } from "../../../util/math_util";
import { BasicBeatmapData } from "../../../util/beatmap_util";
import { BeatmapEntry } from "../../../datamodel/beatmap/beatmap_entry";
import { VirtualFile } from "../../../file_system/virtual_file";
import { globalState } from "../../../global_state";
import { calculateRatioBasedScalingFactor } from "../../../util/graphics_util";
import { currentWindowDimensions, REFERENCE_SCREEN_HEIGHT } from "../../../visuals/ui";

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
	private fadeInInterpolator: Interpolator;

	constructor(songSelect: SongSelect) {
		this.songSelect = songSelect;
		this.container = new PIXI.Container();
		this.interactionGroup = new InteractionGroup();

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

		this.fadeInInterpolator = new Interpolator({
			duration: 500,
			ease: EaseType.EaseOutQuart,
			reverseEase: EaseType.EaseInQuint,
			beginReversed: true,
			defaultToFinished: true
		});

		this.selectTab(0);
		this.initInteraction();
		this.hide();
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

	async loadBeatmapSet(beatmapSet: BeatmapSet, basicData: BasicBeatmapData) {
		if (this.currentBeatmapSet === beatmapSet) return;
		this.currentBeatmapSet = beatmapSet;

		this.header.updateText(basicData, false, true);
	}

	async loadBeatmapData(entry: BeatmapEntry) {
		this.show();
		this.header.updateText(entry.extendedMetadata, true, false);

		let detailsTab = this.tabs[0] as BeatmapDetailsTab;
		detailsTab.loadBeatmapData(entry.extendedMetadata);

		let imageFile = await entry.beatmapSet.directory.getFileByPath(entry.extendedMetadata.imageName);
		await this.loadImage(imageFile);
	}

	private async loadImage(imageFile: VirtualFile) {
		globalState.backgroundManager.setImage(imageFile);
		await this.header.loadImage(imageFile);
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
		let fadeInCompletion = this.fadeInInterpolator.getCurrentValue(now);
		this.container.alpha = fadeInCompletion;
		this.container.pivot.x = (1 - fadeInCompletion) * 50 * this.scalingFactor;

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

	show() {
		this.fadeInInterpolator.setReversedState(false, performance.now());
		this.interactionGroup.enable();
	}

	hide() {
		this.fadeInInterpolator.setReversedState(true, performance.now());
		this.interactionGroup.disable();
	}
}