import { stage } from "../../visuals/rendering";
import { VirtualDirectory } from "../../file_system/virtual_directory";
import { createCarouselFromDirectory, updateCarouselSizing } from "./beatmap_carousel";
import { initBeatmapInfoPanel, updateBeatmapInfoPanelSizing } from "./beatmap_info_panel";
import { uiEventEmitter } from "../../visuals/ui";
import { Interactivity } from "../../input/interactivity";

export const songSelectInteractionGroup = Interactivity.createGroup();
songSelectInteractionGroup.disable();

const songFolderSelect = document.querySelector('#songs-folder-select') as HTMLInputElement;

export let songSelectContainer = new PIXI.Container();
stage.addChild(songSelectContainer);

songFolderSelect.addEventListener('change', () => {
	(document.querySelector('#tempControls') as HTMLElement).style.display = 'none';

	let directory = VirtualDirectory.fromFileList(songFolderSelect.files);

	createCarouselFromDirectory(directory);
	initBeatmapInfoPanel();

	songSelectInteractionGroup.enable();
});

function onResize() {
	updateCarouselSizing();
	updateBeatmapInfoPanelSizing();
}
uiEventEmitter.addListener('resize', onResize);
setTimeout(onResize); // TODO DO THIS CLEANLY