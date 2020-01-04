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
export const BEATMAP_CAROUSEL_RADIUS_FACTOR = 3.0;
export const BEATMAP_SET_PANEL_WIDTH = 700;
export const BEATMAP_SET_PANEL_HEIGHT = 100;
export const BEATMAP_PANEL_WIDTH = 650;
export const BEATMAP_PANEL_HEIGHT = 50;
export const BEATMAP_SET_PANEL_MARGIN = 10;
export const BEATMAP_PANEL_MARGIN = 10;
const SCROLL_VELOCITY_DECAY_FACTOR = 0.07; // Per second. After one second, the velocity will have fallen off by this much.

const songFolderSelect = document.querySelector('#songs-folder-select') as HTMLInputElement;

export let beatmapCarouselContainer = new PIXI.Container();
export let beatmapSetPanels: BeatmapSetPanel[] = [];
export let carouselInteractionGroup = new InteractionGroup();
let selectedPanel: BeatmapSetPanel = null;
let referencePanel: BeatmapSetPanel = null;
let referencePanelY = 0;
let scrollVelocity = 0; // In normalized pixels per second
let snapToSelectionInterpolator = new Interpolator({
	duration: 750,
	ease: EaseType.EaseOutElastic,
	p: 0.9,
	defaultToFinished: true
});
let snapToSelectedIntervened = true;

stage.addChild(beatmapCarouselContainer);

export function setSelectedPanel(panel: BeatmapSetPanel) {
	selectedPanel = panel;
}

export function getSelectedPanel() {
	return selectedPanel;
}

export function setReferencePanel(panel: BeatmapSetPanel, currentYPosition: number) {
	referencePanel = panel;
	referencePanelY = currentYPosition;

	snapToSelectionInterpolator.setValueRange(currentYPosition, 250);
	snapToSelectionInterpolator.start();
	snapToSelectedIntervened = false;
	scrollVelocity = 0;
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

addRenderingTask((dt: number) => {
	if (!referencePanel) return;

	let referenceIndex = beatmapSetPanels.indexOf(referencePanel);

	if (scrollVelocity !== 0) snapToSelectedIntervened = true;
	if (!snapToSelectedIntervened) {
		referencePanelY = snapToSelectionInterpolator.getCurrentValue();
	}

	/* 
	
	The function describing scrollVelocity over time is
	f(t) = v0 * d^t,
	where v0 is the starting velocity, d is the decay and t is passed time in seconds.

	Therefore, the distance traveled is that function's antiderivative,
	F(t) = v0 * d^t / ln(d).
	The distance traveled in a given interval of time [0, x] is therefore
	F(x) - F(0) = v0 * d^x / ln(d) - v0 / ln(d) = v0 * (d^x - 1) / ln(d).
	
	*/

	let distanceScrolled = scrollVelocity * (Math.pow(SCROLL_VELOCITY_DECAY_FACTOR, dt/1000) - 1) / Math.log(SCROLL_VELOCITY_DECAY_FACTOR);
	scrollVelocity = scrollVelocity * Math.pow(SCROLL_VELOCITY_DECAY_FACTOR, dt/1000);
	referencePanelY -= distanceScrolled;
	if (Math.abs(scrollVelocity) < 1) scrollVelocity = 0;

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

	scrollVelocity += wheelEvent.dy * 5;
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