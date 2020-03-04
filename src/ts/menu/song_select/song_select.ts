import { VirtualDirectory } from "../../file_system/virtual_directory";
import { defaultBeatmapCarouselSortingType, BeatmapCarousel } from "./beatmap_carousel";
import { BeatmapInfoPanel } from "./beatmap_info_panel";
import { Interactivity, InteractionGroup, rootInteractionGroup } from "../../input/interactivity";
import { SongSelectSideControlPanel } from "./side_control_panel";
import { VirtualFile } from "../../file_system/virtual_file";
import { Beatmap } from "../../datamodel/beatmap";
import { startPlayFromBeatmap } from "../../game/play";
import { BeatmapSet } from "../../datamodel/beatmap_set";
import { SearchBar } from "./search_bar";
import { ExtendedBeatmapData } from "../../util/beatmap_util";
import { mainMusicMediaPlayer } from "../../audio/media_player";
import { stage, addRenderingTask } from "../../visuals/rendering";
import { uiEventEmitter } from "../../visuals/ui";

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

	constructor() {
		this.container = new PIXI.Container();
		this.interactionGroup = Interactivity.createGroup();

		this.carousel = new BeatmapCarousel(this);
		this.infoPanel = new BeatmapInfoPanel(this);
		this.sideControlPanel = new SongSelectSideControlPanel(this);
		this.searchBar = new SearchBar(this);

		this.container.addChild(this.carousel.container, this.infoPanel.container, this.sideControlPanel.container, this.searchBar.container);
		this.interactionGroup.add(this.carousel.interactionGroup, this.infoPanel.interactionGroup, this.sideControlPanel.interactionGroup, this.searchBar.interactionGroup);

		this.resize();
		this.hide();
	}

	update(now: number, dt: number) {
		// TODO DON'T LIKE RUN THIS IF SONG SELECT NOT VISIBLE :()

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
		mainMusicMediaPlayer.pause();
	
		this.selectedBeatmapFile.readAsText().then((text) => {
			let map = new Beatmap({
				text: text,
				beatmapSet: this.selectedBeatmapSet,
				metadataOnly: false
			});
	
			startPlayFromBeatmap(map);
		});
	}

	show() {
		this.container.visible = true;
		this.interactionGroup.enable();
	}

	hide() {
		this.container.visible = false;
		this.interactionGroup.disable();
	}
}

let songSelect = new SongSelect(); // TEMP man.
stage.addChild(songSelect.container);
rootInteractionGroup.add(songSelect.interactionGroup);

uiEventEmitter.addListener('resize', () => songSelect.resize());
addRenderingTask((now, dt) => songSelect.update(now, dt));

const songFolderSelect = document.querySelector('#songs-folder-select') as HTMLInputElement;
songFolderSelect.addEventListener('change', async () => {
	(document.querySelector('#tempControls') as HTMLElement).style.display = 'none';

	let directory = VirtualDirectory.fromFileList(songFolderSelect.files);
	let promises: Promise<unknown>[] = [];

	directory.forEach((entry) => {
		if (!(entry instanceof VirtualDirectory)) return;

		let beatmapSet = new BeatmapSet(entry);
		songSelect.loadedBeatmapSets.push(beatmapSet);
		promises.push(beatmapSet.init());
	});

	await Promise.all(promises);

	songSelect.carousel.showBeatmapSets(songSelect.loadedBeatmapSets, defaultBeatmapCarouselSortingType);
	songSelect.show();
});