import { VirtualDirectory } from "../../file_system/virtual_directory";
import { defaultBeatmapCarouselSortingType, BeatmapCarousel } from "./beatmap_carousel";
import { BeatmapInfoPanel } from "./beatmap_info_panel";
import { Interactivity, InteractionGroup, rootInteractionGroup } from "../../input/interactivity";
import { SongSelectSideControlPanel } from "./side_control_panel";
import { VirtualFile } from "../../file_system/virtual_file";
import { Beatmap } from "../../datamodel/beatmap";
import { BeatmapSet } from "../../datamodel/beatmap_set";
import { SearchBar } from "./search_bar";
import { ExtendedBeatmapData } from "../../util/beatmap_util";
import { globalState } from "../../global_state";
import { Interpolator } from "../../util/interpolation";
import { EaseType } from "../../util/math_util";

export class SongSelect {
	public container: PIXI.Container;
	public interactionGroup: InteractionGroup;
	
	public loadedBeatmapSets: BeatmapSet[] = [];
	public selectedBeatmapFile: VirtualFile = null;
	public selectedBeatmapSet: BeatmapSet = null;
	public selectedExtendedBeatmapData: ExtendedBeatmapData = null;

	public carousel: BeatmapCarousel;
	public infoPanel: BeatmapInfoPanel;
	public sideControlPanel: SongSelectSideControlPanel;
	public searchBar: SearchBar;

	private fadeInterpolator: Interpolator;

	constructor() {
		this.container = new PIXI.Container();
		this.interactionGroup = Interactivity.createGroup();

		this.carousel = new BeatmapCarousel(this);
		this.infoPanel = new BeatmapInfoPanel(this);
		this.sideControlPanel = new SongSelectSideControlPanel(this);
		this.searchBar = new SearchBar(this);

		this.container.addChild(this.carousel.container, this.infoPanel.container, this.sideControlPanel.container, this.searchBar.container);
		this.interactionGroup.add(this.carousel.interactionGroup, this.infoPanel.interactionGroup, this.sideControlPanel.interactionGroup, this.searchBar.interactionGroup);

		this.fadeInterpolator = new Interpolator({
			duration: 300,
			ease: EaseType.EaseOutQuad,
			reverseEase: EaseType.EaseInQuad,
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

		this.carousel.update(now, dt);
		this.infoPanel.update(now);
		this.sideControlPanel.update(now);
		this.searchBar.update(now);
	}

	resize() {
		this.carousel.resize();
		this.infoPanel.resize();
		this.sideControlPanel.resize();
		this.searchBar.resize();
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
	
			globalState.gameplayController.startPlayFromBeatmap(map);
		});
	}

	show() {
		this.fadeInterpolator.setReversedState(false, performance.now());
		this.interactionGroup.enable();
	}

	hide() {
		this.fadeInterpolator.setReversedState(true, performance.now());
		this.interactionGroup.disable();
	}
}