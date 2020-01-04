import { VirtualDirectory } from "../../file_system/virtual_directory";
import { BeatmapSet } from "../../datamodel/beatmap_set";
import { stage, addRenderingTask } from "../../visuals/rendering";
import { inputEventEmitter } from "../../input/input";
import { getGlobalScalingFactor, uiEventEmitter, REFERENCE_SCREEN_HEIGHT } from "../../visuals/ui";
import { BeatmapSetPanel } from "./beatmap_set_panel";
import { updateDarkeningOverlay, updateBeatmapSetPanelMask, updateBeatmapPanelMask } from "./beatmap_panel_components";
import { NormalizedWheelEvent } from "../../util/misc_util";
import { Interpolator } from "../../util/graphics_util";
import { EaseType, MathUtil } from "../../util/math_util";
import { InteractionGroup } from "../../input/interactivity";

export const BEATMAP_CAROUSEL_RIGHT_MARGIN = 600;
export const BEATMAP_CAROUSEL_RADIUS_FACTOR = 2.5;
export const BEATMAP_SET_PANEL_WIDTH = 700;
export const BEATMAP_SET_PANEL_HEIGHT = 100;
export const BEATMAP_PANEL_WIDTH = 650;
export const BEATMAP_PANEL_HEIGHT = 50;
export const BEATMAP_SET_PANEL_MARGIN = 10;
export const BEATMAP_PANEL_MARGIN = 10;

const songFolderSelect = document.querySelector('#songs-folder-select') as HTMLInputElement;

export let beatmapCarouselContainer = new PIXI.Container();
export let beatmapSetPanels: BeatmapSetPanel[] = [];
export let carouselInteractionGroup = new InteractionGroup();
let selectedPanel: BeatmapSetPanel = null;
let referencePanel: BeatmapSetPanel = null;
let referencePanelY = 0;
let scrollThrust = 0;

stage.addChild(beatmapCarouselContainer);

export function setSelectedPanel(panel: BeatmapSetPanel) {
	selectedPanel = panel;
}
export function getSelectedPanel() {
	return selectedPanel;
}

let snapToSelectionInterpolator = new Interpolator({
	from: 0,
	to: 0,
	duration: 750,
	ease: EaseType.EaseOutElastic,
	p: 0.9,
	defaultToFinished: true
});
let intervened = true;

export function setReferencePanel(panel: BeatmapSetPanel, currentYPosition: number) {
	referencePanel = panel;
	referencePanelY = currentYPosition;

	snapToSelectionInterpolator.setValueRange(currentYPosition, 250);
	snapToSelectionInterpolator.start();
	intervened = false;
	scrollThrust = 0;
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

	if (scrollThrust !== 0) intervened = true;
	if (!intervened) {
		referencePanelY = snapToSelectionInterpolator.getCurrentValue();
	}

	referencePanelY -= scrollThrust;
	scrollThrust *= 0.9;
	if (Math.abs(scrollThrust) < 0.1) scrollThrust = 0;

	referencePanel.update(referencePanelY, referencePanel.getTotalHeight());

	let currentY = referencePanelY;
	for (let i = referenceIndex-1; i >= 0; i--) {
		let panel = beatmapSetPanels[i];
		let height = panel.getTotalHeight();
		currentY -= height;

		panel.container.visible = true;
		panel.update(currentY, height);
	}

	currentY = referencePanelY;
	for (let i = referenceIndex+1; i < beatmapSetPanels.length; i++) {
		let prevPanel = beatmapSetPanels[i-1];
		let panel = beatmapSetPanels[i];
		let height = prevPanel.getTotalHeight();
		currentY += height;
		
		panel.container.visible = true;
		panel.update(currentY, panel.getTotalHeight());
	}
});

inputEventEmitter.addListener('wheel', (data) => {
	let wheelEvent = data as NormalizedWheelEvent;

	scrollThrust += wheelEvent.dy / 10;
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