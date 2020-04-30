import { BeatmapCarousel } from "./beatmap_carousel";
import { BeatmapInfoPanel } from "./beatmap_info_panel";
import { InteractionGroup, InteractionRegistration } from "../../input/interactivity";
import { SongSelectSideControlPanel } from "./side_control_panel";
import { BeatmapSet } from "../../datamodel/beatmap_set";
import { SearchBar } from "./search_bar";
import { BasicBeatmapData } from "../../util/beatmap_util";
import { globalState } from "../../global_state";
import { Interpolator } from "../../util/interpolation";
import { EaseType, MathUtil } from "../../util/math_util";
import { currentWindowDimensions, getGlobalScalingFactor } from "../../visuals/ui";
import { ModSelectionPanel } from "./mod_selection_panel";
import { KeyCode } from "../../input/input";
import { Scrollbar } from "../components/scrollbar";
import { BeatmapEntry } from "../../datamodel/beatmap_entry";
import { BeatmapParser } from "../../datamodel/beatmap_parser";

export class SongSelect {
	public container: PIXI.Container;
	public interactionGroup: InteractionGroup;
	public keyInteraction: InteractionRegistration;
	
	public loadedBeatmapSets: BeatmapSet[] = [];
	public selectedEntry: BeatmapEntry = null;
	public currentAudioBeatmapSet: BeatmapSet;
	public currentAudioBasicData: BasicBeatmapData;

	public carousel: BeatmapCarousel;
	public infoPanel: BeatmapInfoPanel;
	public sideControlPanel: SongSelectSideControlPanel;
	public searchBar: SearchBar;
	public modSelector: ModSelectionPanel;
	public scrollbar: Scrollbar;

	private fadeInterpolator: Interpolator;
	public visible = false;

	constructor() {
		this.container = new PIXI.Container();
		
		this.interactionGroup = new InteractionGroup();
		this.initKeyInteraction();

		this.carousel = new BeatmapCarousel(this);
		this.infoPanel = new BeatmapInfoPanel(this);
		this.sideControlPanel = new SongSelectSideControlPanel(this);
		this.searchBar = new SearchBar(this);
		this.modSelector = new ModSelectionPanel(this);
		this.scrollbar = new Scrollbar();

		this.container.addChild(this.scrollbar.container, this.carousel.container, this.infoPanel.container, this.sideControlPanel.container, this.searchBar.container, this.modSelector.container);
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
	
	private initKeyInteraction() {
		this.keyInteraction = new InteractionRegistration();
		this.interactionGroup.add(this.keyInteraction);

		this.keyInteraction.addListener('keyDown', (e) => {
			switch (e.keyCode) {
				case KeyCode.Enter: {
					this.triggerSelectedBeatmap();
				}; break;
				case KeyCode.LeftArrow: {
					this.carousel.skipSet(false, false);
				}; break;
				case KeyCode.RightArrow: {
					this.carousel.skipSet(true, false);
				}; break;
				case KeyCode.UpArrow: {
					this.carousel.skipDifficulty(false);
				}; break;
				case KeyCode.DownArrow: {
					this.carousel.skipDifficulty(true);
				}; break;
			}
		});
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
		this.scrollbar.update();
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

		this.scrollbar.setScaling(currentWindowDimensions.height, getGlobalScalingFactor());
		this.scrollbar.setPageHeight(500);
		this.scrollbar.setScrollHeight(5000);
	}

	selectBeatmapEntry(entry: BeatmapEntry) {
		this.selectedEntry = entry;
	
		this.infoPanel.loadBeatmapData(entry);
	}

	triggerSelectedBeatmap() {
		if (!this.selectedEntry) return;
		
		this.hide();
		globalState.basicSongPlayer.pause();
	
		this.selectedEntry.resource.readAsText().then((text) => {
			let map = BeatmapParser.parse(text, this.selectedEntry.beatmapSet, false);
			let mods = this.modSelector.getSelectedMods();
	
			globalState.gameplayController.startPlayFromBeatmap(map, mods);
		});
	}

	async startAudio(beatmapSet: BeatmapSet, basicData: BasicBeatmapData) {
		let songPlayer = globalState.basicSongPlayer;

		// The same audio is already playing, let's not start it again.
		if (songPlayer.isPlaying() && this.currentAudioBeatmapSet === beatmapSet) return;

		let audioFile = await beatmapSet.directory.getFileByPath(basicData.audioName);
		if (!audioFile) return;

		this.currentAudioBeatmapSet = beatmapSet;
		this.currentAudioBasicData = basicData;

		await songPlayer.loadFile(audioFile);

		let startTime = basicData.audioPreviewTime;
		songPlayer.start(startTime)
		songPlayer.setLoopBehavior(true, startTime);
		this.sideControlPanel.resetLastBeatTime();
	}

	show() {
		this.fadeInterpolator.setReversedState(false, performance.now());
		this.interactionGroup.enable();
		this.visible = true;

		if (this.currentAudioBeatmapSet) this.startAudio(this.currentAudioBeatmapSet, this.currentAudioBasicData);
	}

	hide() {
		this.fadeInterpolator.setReversedState(true, performance.now());
		this.interactionGroup.disable();
		this.visible = false;
	}
}