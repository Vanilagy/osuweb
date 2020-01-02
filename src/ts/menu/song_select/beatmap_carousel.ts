import { VirtualDirectory } from "../../file_system/virtual_directory";
import { BeatmapSet } from "../../datamodel/beatmap_set";
import { stage, addRenderingTask } from "../../visuals/rendering";
import { inputEventEmitter } from "../../input/input";
import { getGlobalScalingFactor, uiEventEmitter } from "../../visuals/ui";
import { beatmapSetPanels, BEATMAP_CAROUSEL_RIGHT_MARGIN, beatmapCarouselContainer } from "./song_select_data";
import { BeatmapSetPanel } from "./beatmap_set_panel";
import { updateDarkeningOverlay, updateBeatmapSetPanelMask, updateBeatmapPanelMask } from "./beatmap_panel_components";

const songFolderSelect = document.querySelector('#songs-folder-select') as HTMLInputElement;
stage.addChild(beatmapCarouselContainer);

let scroll = 0;
let thrust = 0;

songFolderSelect.addEventListener('change', () => {
	let directory = VirtualDirectory.fromFileList(songFolderSelect.files);
	
	directory.forEach((entry) => {
		if (!(entry instanceof VirtualDirectory)) return;

		let beatmapSet = new BeatmapSet(entry);
		let panel = new BeatmapSetPanel(beatmapSet);
		beatmapCarouselContainer.addChild(panel.container);

		beatmapSetPanels.push(panel);
	});
});

addRenderingTask(() => {
	scroll += thrust;
	thrust *= 0.9;

	let currentHeight = 0;
	let scalingFactor = getGlobalScalingFactor();

	for (let i = 0; i < beatmapSetPanels.length; i++) {
		let panel = beatmapSetPanels[i];

		panel.container.y = Math.floor((currentHeight - scroll) * scalingFactor);
		currentHeight += panel.update();
	}
});

inputEventEmitter.addListener('wheel', (data) => {
	let wheelEvent = data as WheelEvent;

	thrust += wheelEvent.deltaY / 10;
});

inputEventEmitter.addListener('mousedown', (data) => {
	let mouseEvent = data as MouseEvent;

	if (beatmapCarouselContainer.visible === false) return; // eh yes duh

	for (let i = 0; i < beatmapSetPanels.length; i++) {
		let panel = beatmapSetPanels[i];

		let actionTaken = panel.click(mouseEvent.clientX, mouseEvent.clientY);
		if (actionTaken) break;
	}
});

function onResize() {
	beatmapCarouselContainer.x = Math.floor(window.innerWidth - BEATMAP_CAROUSEL_RIGHT_MARGIN * getGlobalScalingFactor());

	updateDarkeningOverlay();
	updateBeatmapSetPanelMask();
	updateBeatmapPanelMask();

	for (let i = 0; i < beatmapSetPanels.length; i++) {
		let panel = beatmapSetPanels[i];

		panel.resize();
	}
}
uiEventEmitter.addListener('resize', onResize);
onResize();