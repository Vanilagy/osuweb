import { stage } from "../../visuals/rendering";
import { VirtualDirectory } from "../../file_system/virtual_directory";
import { updateCarouselSizing, createCarouselFromBeatmapSets } from "./beatmap_carousel";
import { initBeatmapInfoPanel, updateBeatmapInfoPanelSizing, beatmapInfoPanel } from "./beatmap_info_panel";
import { uiEventEmitter } from "../../visuals/ui";
import { Interactivity } from "../../input/interactivity";
import { initSideControlPanel, updateSideControlPanelSizing } from "./side_control_panel";
import { VirtualFile } from "../../file_system/virtual_file";
import { ExtendedBeatmapData } from "../../datamodel/beatmap_util";
import { Beatmap } from "../../datamodel/beatmap";
import { startPlayFromBeatmap } from "../../game/play";
import { BeatmapSet } from "../../datamodel/beatmap_set";
import { initSearchBar, updateSearchBarSizing } from "./search";

export const songSelectInteractionGroup = Interactivity.createGroup();
songSelectInteractionGroup.disable();

const songFolderSelect = document.querySelector('#songs-folder-select') as HTMLInputElement;

export let songSelectContainer = new PIXI.Container();
stage.addChild(songSelectContainer);

export let loadedBeatmapSets: BeatmapSet[] = [];

songFolderSelect.addEventListener('change', async () => {
	(document.querySelector('#tempControls') as HTMLElement).style.display = 'none';

	let directory = VirtualDirectory.fromFileList(songFolderSelect.files);
	let promises: Promise<unknown>[] = [];

	directory.forEach((entry) => {
		if (!(entry instanceof VirtualDirectory)) return;

		let beatmapSet = new BeatmapSet(entry);
		loadedBeatmapSets.push(beatmapSet);
		promises.push(beatmapSet.init());
	});

	await Promise.all(promises);

	createCarouselFromBeatmapSets(loadedBeatmapSets);
	initBeatmapInfoPanel();
	initSideControlPanel();
	initSearchBar();

	songSelectInteractionGroup.enable();
});

function onResize() {
	updateCarouselSizing();
	updateBeatmapInfoPanelSizing();
	updateSideControlPanelSizing();
	updateSearchBarSizing();
}
uiEventEmitter.addListener('resize', onResize);
setTimeout(onResize); // TODO DO THIS CLEANLY

let selectedBeatmapFile: VirtualFile = null;
let selectedBeatmapSet: BeatmapSet = null;
let selectedExtendedBeatmapData: ExtendedBeatmapData = null;

export function getSelectedExtendedBeatmapData() {
	return selectedExtendedBeatmapData;
}

export function selectBeatmapDifficulty(beatmapFile: VirtualFile, beatmapSet: BeatmapSet,  extendedBeatmapData: ExtendedBeatmapData) {
	selectedBeatmapFile = beatmapFile;
	selectedBeatmapSet = beatmapSet;
	selectedExtendedBeatmapData = extendedBeatmapData;

	beatmapInfoPanel.loadBeatmapData(extendedBeatmapData);
}

export function triggerSelectedBeatmap() {
	if (!selectedBeatmapFile) return;

	songSelectContainer.visible = false;
	songSelectInteractionGroup.disable();

	selectedBeatmapFile.readAsText().then((text) => {
		let map = new Beatmap({
			text: text,
			beatmapSet: selectedBeatmapSet,
			metadataOnly: false
		});

		startPlayFromBeatmap(map);
	});
}