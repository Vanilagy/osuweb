import { VirtualDirectory } from "../../file_system/virtual_directory";
import { BeatmapSet } from "../../datamodel/beatmap_set";
import { stage, addRenderingTask } from "../../visuals/rendering";
import { inputEventEmitter } from "../../input/input";
import { getGlobalScalingFactor, uiEventEmitter, REFERENCE_SCREEN_HEIGHT } from "../../visuals/ui";
import { beatmapSetPanels, BEATMAP_CAROUSEL_RIGHT_MARGIN, beatmapCarouselContainer, BEATMAP_CAROUSEL_RADIUS_FACTOR } from "./song_select_data";
import { BeatmapSetPanel } from "./beatmap_set_panel";
import { updateDarkeningOverlay, updateBeatmapSetPanelMask, updateBeatmapPanelMask } from "./beatmap_panel_components";
import { NormalizedWheelEvent, assert } from "../../util/misc_util";
import { Interpolator } from "../../util/graphics_util";
import { EaseType, MathUtil } from "../../util/math_util";

const songFolderSelect = document.querySelector('#songs-folder-select') as HTMLInputElement;
stage.addChild(beatmapCarouselContainer);

let thrust = 0;

let referencePanelHeight = 0;
let referencePanel: BeatmapSetPanel = null;

let yesss = new Interpolator({
	from: 0,
	to: 0,
	duration: 750,
	ease: EaseType.EaseOutElastic,
	k: 0.9,
	defaultToFinished: true
});
let intervened = true;

export function fuuck(a: BeatmapSetPanel, b: number) {
	referencePanel = a;
	referencePanelHeight = b;

	yesss.setValueRange(b, 250);
	yesss.start();
	intervened = false;
	thrust = 0;
}

songFolderSelect.addEventListener('change', () => {
	let directory = VirtualDirectory.fromFileList(songFolderSelect.files);
	
	directory.forEach((entry) => {
		if (!(entry instanceof VirtualDirectory)) return;

		let beatmapSet = new BeatmapSet(entry);
		let panel = new BeatmapSetPanel(beatmapSet);
		beatmapCarouselContainer.addChild(panel.container);

		beatmapSetPanels.push(panel);
	});

	referencePanel = beatmapSetPanels[0];
});

addRenderingTask(() => {
	if (!referencePanel) return;

	let referenceIndex = beatmapSetPanels.indexOf(referencePanel);

	if (thrust !== 0) intervened = true;
	if (!intervened) {
		referencePanelHeight = yesss.getCurrentValue();
	}

	referencePanelHeight -= thrust;
	thrust *= 0.9;
	if (Math.abs(thrust) < 0.1) thrust = 0;

	referencePanel.update(referencePanelHeight, referencePanel.getTotalHeight());

	let currentHeight = referencePanelHeight;
	for (let i = referenceIndex-1; i >= 0; i--) {
		let panel = beatmapSetPanels[i];
		let height = panel.getTotalHeight();
		currentHeight -= height;

		panel.container.visible = true;
		panel.update(currentHeight, height);
	}

	currentHeight = referencePanelHeight;
	for (let i = referenceIndex+1; i < beatmapSetPanels.length; i++) {
		let prevPanel = beatmapSetPanels[i-1];
		let panel = beatmapSetPanels[i];
		let height = prevPanel.getTotalHeight();
		currentHeight += height;
		
		panel.container.visible = true;
		panel.update(currentHeight, panel.getTotalHeight());
	}
});

inputEventEmitter.addListener('wheel', (data) => {
	let wheelEvent = data as NormalizedWheelEvent;

	thrust += wheelEvent.dy / 10;
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

export function getNormalizedOffsetOnCarousel(normalizedYPosition: number) {
	// -1.0 for top of the screen, 0.0 for middle, 1.0 for bottom
	let normalizedDistanceToCenter = (normalizedYPosition - REFERENCE_SCREEN_HEIGHT/2) / (REFERENCE_SCREEN_HEIGHT/2);
	let circleHeight = MathUtil.unitCircleContour(normalizedDistanceToCenter / BEATMAP_CAROUSEL_RADIUS_FACTOR);
	if (isNaN(circleHeight)) circleHeight = 1.0;

	return circleHeight * (REFERENCE_SCREEN_HEIGHT/2 * BEATMAP_CAROUSEL_RADIUS_FACTOR);
}