import { VirtualDirectory } from "../../file_system/virtual_directory";
import { defaultBeatmapCarouselSortingType, BeatmapCarousel } from "./beatmap_carousel";
import { BeatmapInfoPanel } from "./beatmap_info_panel";
import { InteractionGroup, rootInteractionGroup } from "../../input/interactivity";
import { SongSelectSideControlPanel } from "./side_control_panel";
import { VirtualFile } from "../../file_system/virtual_file";
import { Beatmap } from "../../datamodel/beatmap";
import { BeatmapSet } from "../../datamodel/beatmap_set";
import { SearchBar } from "./search_bar";
import { ExtendedBeatmapData } from "../../util/beatmap_util";
import { globalState } from "../../global_state";
import { Interpolator } from "../../util/interpolation";
import { EaseType, MathUtil } from "../../util/math_util";
import { currentWindowDimensions, getGlobalScalingFactor } from "../../visuals/ui";
import { ModSelectionPanel } from "./mod_selection_panel";

export class SongSelect {
	public container: PIXI.Container;
	public interactionGroup: InteractionGroup;
	
	public loadedBeatmapSets: BeatmapSet[] = [];
	public selectedBeatmapFile: VirtualFile = null;
	public selectedBeatmapSet: BeatmapSet = null;
	public selectedExtendedBeatmapData: ExtendedBeatmapData = null;
	public currentAudioBeatmap: Beatmap = null;

	public carousel: BeatmapCarousel;
	public infoPanel: BeatmapInfoPanel;
	public sideControlPanel: SongSelectSideControlPanel;
	public searchBar: SearchBar;
	public modSelector: ModSelectionPanel;

	private fadeInterpolator: Interpolator;
	public visible = false;

	constructor() {
		this.container = new PIXI.Container();
		this.interactionGroup = new InteractionGroup();

		this.carousel = new BeatmapCarousel(this);
		this.infoPanel = new BeatmapInfoPanel(this);
		this.sideControlPanel = new SongSelectSideControlPanel(this);
		this.searchBar = new SearchBar(this);
		this.modSelector = new ModSelectionPanel(this);

		this.container.addChild(this.carousel.container, this.infoPanel.container, this.sideControlPanel.container, this.searchBar.container, this.modSelector.container);
		this.interactionGroup.add(this.carousel.interactionGroup, this.infoPanel.interactionGroup, this.sideControlPanel.interactionGroup, this.searchBar.interactionGroup, this.modSelector.interactionGroup);

		this.fadeInterpolator = new Interpolator({
			duration: 500,
			ease: EaseType.EaseOutQuad,
			reverseEase: EaseType.EaseInCubic,
			beginReversed: true,
			defaultToFinished: true
		});

		this.resize();
		this.hide();
	}

	update(now: number, dt: number) {
		let fadeValue = this.fadeInterpolator.getCurrentValue(now);
		
		this.container.alpha = fadeValue;
		this.container.visible = fadeValue !== 0;

		if (fadeValue === 0) return;

		this.container.scale.set(MathUtil.lerp(1.1, 1.0, fadeValue));
		this.infoPanel.container.pivot.x = MathUtil.lerp(60 * getGlobalScalingFactor(), 0, fadeValue);
		this.carousel.container.pivot.x = MathUtil.lerp(-60 * getGlobalScalingFactor(), 0, fadeValue);

		this.carousel.update(now, dt);
		this.infoPanel.update(now);
		this.sideControlPanel.update(now);
		this.searchBar.update(now);
		this.modSelector.update(now);
	}

	resize() {
		this.container.pivot.x = currentWindowDimensions.width/2;
		this.container.pivot.y = currentWindowDimensions.width/2;
		this.container.position.copyFrom(this.container.pivot);

		this.carousel.resize();
		this.infoPanel.resize();
		this.sideControlPanel.resize();
		this.searchBar.resize();
		this.modSelector.resize();
	}

	selectBeatmapDifficulty(beatmapFile: VirtualFile, beatmapSet: BeatmapSet,  extendedBeatmapData: ExtendedBeatmapData) {
		this.selectedBeatmapFile = beatmapFile;
		this.selectedBeatmapSet = beatmapSet;
		this.selectedExtendedBeatmapData = extendedBeatmapData;
	
		this.infoPanel.loadBeatmapData(extendedBeatmapData);
	}

	triggerSelectedBeatmap() {
		if (!this.selectedBeatmapFile) return;
		
		this.hide();
		globalState.basicMediaPlayer.pause();
	
		this.selectedBeatmapFile.readAsText().then((text) => {
			let map = new Beatmap({
				text: text,
				beatmapSet: this.selectedBeatmapSet,
				metadataOnly: false
			});
			let mods = this.modSelector.getSelectedMods();
	
			globalState.gameplayController.startPlayFromBeatmap(map, mods);
		});
	}

	async startAudio(audioBeatmap: Beatmap) {
		let audioFile = await audioBeatmap.getAudioFile();
		if (!audioFile) return;

		this.currentAudioBeatmap = audioBeatmap;
		let mediaPlayer = globalState.basicMediaPlayer;

		await mediaPlayer.loadFromVirtualFile(audioFile);

		let startTime = audioBeatmap.getAudioPreviewTimeInSeconds();
		mediaPlayer.start(startTime)
		mediaPlayer.setLoopBehavior(true, startTime);
		this.sideControlPanel.resetLastBeatTime();
	}

	show() {
		this.fadeInterpolator.setReversedState(false, performance.now());
		this.interactionGroup.enable();
		this.visible = true;

		if (this.currentAudioBeatmap) this.startAudio(this.currentAudioBeatmap);
	}

	hide() {
		this.fadeInterpolator.setReversedState(true, performance.now());
		this.interactionGroup.disable();
		this.visible = false;
	}
}