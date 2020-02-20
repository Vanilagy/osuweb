import { VirtualDirectory } from "../../file_system/virtual_directory";
import { BeatmapSet } from "../../datamodel/beatmap_set";
import { stage, addRenderingTask } from "../../visuals/rendering";
import { inputEventEmitter, getCurrentMousePosition, getCurrentMouseButtonState } from "../../input/input";
import { getGlobalScalingFactor, uiEventEmitter, REFERENCE_SCREEN_HEIGHT, currentWindowDimensions } from "../../visuals/ui";
import { BeatmapSetPanel } from "./beatmap_set_panel";
import { updateDarkeningOverlay, updateBeatmapDifficultyPanelMasks, updateBeatmapSetPanelMasks, updateDifficultyColorBar } from "./beatmap_panel_components";
import { NormalizedWheelEvent, last, shallowObjectClone, EMPTY_FUNCTION, charIsDigit, compareStringsLowerCase } from "../../util/misc_util";
import { calculateRatioBasedScalingFactor } from "../../util/graphics_util";
import { EaseType, MathUtil } from "../../util/math_util";
import { InteractionGroup, Interactivity } from "../../input/interactivity";
import { BeatmapDifficultyPanel } from "./beatmap_difficulty_panel";
import { songSelectContainer, songSelectInteractionGroup } from "./song_select";
import { Interpolator } from "../../util/interpolation";
import { Point } from "../../util/point";

export const BEATMAP_CAROUSEL_RIGHT_MARGIN = 600;
export const BEATMAP_CAROUSEL_RADIUS_FACTOR = 3.0;
export const BEATMAP_SET_PANEL_WIDTH = 700;
export const BEATMAP_SET_PANEL_HEIGHT = 100;
export const BEATMAP_SET_PANEL_MARGIN = 10;
export const BEATMAP_SET_PANEL_SNAP_TARGET = 225;
export const BEATMAP_DIFFICULTY_PANEL_WIDTH = 650;
export const BEATMAP_DIFFICULTY_PANEL_HEIGHT = 50;
export const BEATMAP_DIFFICULTY_PANEL_MARGIN = 10;
export const BEATMAP_DIFFICULTY_PANEL_SNAP_TARGET = 300;
const CAROUSEL_END_THRESHOLD = REFERENCE_SCREEN_HEIGHT/2 - BEATMAP_SET_PANEL_HEIGHT/2; // When either the top or bottom panel of the carousel cross this line, the carousel should snap back.
const SCROLL_VELOCITY_DECAY_FACTOR = 0.04; // Per second. After one second, the scroll velocity will have fallen off by this much.

export let beatmapCarouselContainer = new PIXI.Container();
export let beatmapSetPanels: BeatmapSetPanel[] = [];
export let carouselInteractionGroup = Interactivity.createGroup();
carouselInteractionGroup.setZIndex(1);
songSelectInteractionGroup.add(carouselInteractionGroup);

let panelCache = new WeakMap<BeatmapSet, BeatmapSetPanel>();
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
let snapToSelected = false;
let skipSnapbackNextFrame = true;
let selectedSubpanel: BeatmapDifficultyPanel = null;

export enum BeatmapCarouselSortingType {
	None = "",
	Title = "Title",
	Artist = "Artist",
	Difficulty = "Difficulty",
	Length = "Length",
	DateAdded = "Date Added",
	Mapper = "Mapper"
}
export let beatmapCarouselSortingTypes = [BeatmapCarouselSortingType.Title, BeatmapCarouselSortingType.Artist, BeatmapCarouselSortingType.Difficulty, BeatmapCarouselSortingType.Length, BeatmapCarouselSortingType.DateAdded, BeatmapCarouselSortingType.Mapper];
export let defaultBeatmapCarouselSortingType = BeatmapCarouselSortingType.Title;
export let beatmapCarouselSortingTypeFunctions = new Map<BeatmapCarouselSortingType, (a: BeatmapSet, b: BeatmapSet) => number>();
beatmapCarouselSortingTypeFunctions.set(BeatmapCarouselSortingType.None, (a, b) => 0);
beatmapCarouselSortingTypeFunctions.set(BeatmapCarouselSortingType.Title, (a, b) => compareStringsLowerCase(a.representingBeatmap.title, b.representingBeatmap.title));
beatmapCarouselSortingTypeFunctions.set(BeatmapCarouselSortingType.Artist, (a, b) => compareStringsLowerCase(a.representingBeatmap.artist, b.representingBeatmap.artist));
beatmapCarouselSortingTypeFunctions.set(BeatmapCarouselSortingType.Difficulty, (a, b) => 0);
beatmapCarouselSortingTypeFunctions.set(BeatmapCarouselSortingType.Length, (a, b) => 0);
beatmapCarouselSortingTypeFunctions.set(BeatmapCarouselSortingType.DateAdded, (a, b) => 0);
beatmapCarouselSortingTypeFunctions.set(BeatmapCarouselSortingType.Mapper, (a, b) => compareStringsLowerCase(a.representingBeatmap.creator, b.representingBeatmap.creator));

let carouselDragTarget = new PIXI.Container();
songSelectContainer.addChild(carouselDragTarget);
let dragListener = Interactivity.registerDisplayObject(carouselDragTarget);
dragListener.setZIndex(1);
carouselInteractionGroup.add(dragListener);
let pressDownStopped = true;
dragListener.passThrough = true;
dragListener.makeDraggable(() => {
	snapToSelected = false;
	scrollVelocity = 0;
	pressDownStopped = false;
}, (e) => {
	referencePanelY += e.movement.y / getCarouselScalingFactor();

	if (Math.abs(e.distanceFromStart.y) > 5 && !pressDownStopped) {
		pressDownStopped = true;
		carouselInteractionGroup.releaseAllPresses();
	}
}, (e) => {
	scrollVelocity -= e.velocity.y / getCarouselScalingFactor();
});

songSelectContainer.addChild(beatmapCarouselContainer);

let carouselScalingFactor = 1.0;
export function getCarouselScalingFactor() {
	return carouselScalingFactor;
}

export function setSelectedPanel(panel: BeatmapSetPanel) {
	selectedPanel = panel;
}

export function getSelectedPanel() {
	return selectedPanel;
}

export function setSelectedSubpanel(subpanel: BeatmapDifficultyPanel) {
	selectedSubpanel = subpanel;
}

export function getSelectedSubpanel() {
	return selectedSubpanel;
}

export function setReferencePanel(panel: BeatmapSetPanel, currentYPosition: number) {
	referencePanel = panel;
	referencePanelY = currentYPosition;

	snapToReferencePanel(currentYPosition, BEATMAP_SET_PANEL_SNAP_TARGET);
}

export function snapToReferencePanel(from: number, to: number) {
	snapToSelectionInterpolator.setValueRange(from, to);
	snapToSelectionInterpolator.start(performance.now());
	snapToSelected = true;
	scrollVelocity = 0;
}

export function createCarouselFromBeatmapSets(beatmapSets: BeatmapSet[], sortingType: BeatmapCarouselSortingType) {
	for (let p of beatmapSetPanels) {
		beatmapCarouselContainer.removeChild(p.container);
	}
	beatmapSetPanels.length = 0;

	beatmapSets.sort(beatmapCarouselSortingTypeFunctions.get(sortingType));

	for (let i = 0; i < beatmapSets.length; i++) {
		let set = beatmapSets[i];
		let cachedPanel = panelCache.get(set);
		let panel: BeatmapSetPanel;

		if (cachedPanel) {
			panel = cachedPanel;
		} else {
			panel = new BeatmapSetPanel(set);
			panelCache.set(set, panel);
		}

		beatmapCarouselContainer.addChild(panel.container);
		beatmapSetPanels.push(panel);
	}

	if (!beatmapSetPanels.includes(referencePanel)) {
		referencePanel = beatmapSetPanels[0];
		referencePanelY = 200;
		scrollVelocity = 100; // For sick effect hehe
	}

	skipSnapbackNextFrame = true;
	snapToSelected = false;
}

addRenderingTask((now: number, dt: number) => {
	if (!referencePanel) return;

	let referenceIndex = beatmapSetPanels.indexOf(referencePanel);

	if (snapToSelected) {
		referencePanelY = snapToSelectionInterpolator.getCurrentValue(now);
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

	if (!skipSnapbackNextFrame) {
		// Calculate snapback when user scrolls off one of the carousel edges
		let firstPanel = beatmapSetPanels[0];
		let lastPanel = last(beatmapSetPanels);
		let diff: number;

		// Top edge snapback
		diff = firstPanel.currentNormalizedY - CAROUSEL_END_THRESHOLD;
		if (diff > 0) referencePanelY += diff * (Math.pow(0.0015, dt/1000) - 1);

		// Bottom edge snapback
		diff = CAROUSEL_END_THRESHOLD - lastPanel.currentNormalizedY;
		if (diff > 0) referencePanelY -= diff * (Math.pow(0.0015, dt/1000) - 1);
	}
	skipSnapbackNextFrame = false;

	referencePanel.update(now, referencePanelY, referencePanel.getTotalHeight(now));

	let currentY = referencePanelY;
	for (let i = referenceIndex-1; i >= 0; i--) {
		let panel = beatmapSetPanels[i];
		let height = panel.getTotalHeight(now);
		currentY -= height;

		panel.container.visible = true;
		panel.update(now, currentY, height);
	}

	currentY = referencePanelY;
	for (let i = referenceIndex+1; i < beatmapSetPanels.length; i++) {
		let prevPanel = beatmapSetPanels[i-1];
		let panel = beatmapSetPanels[i];
		let height = prevPanel.getTotalHeight(now);
		currentY += height;
		
		panel.container.visible = true;
		panel.update(now, currentY, panel.getTotalHeight(now));
	}
});

inputEventEmitter.addListener('wheel', (data) => {
	if (beatmapSetPanels.length === 0) return;

	let wheelEvent = data as NormalizedWheelEvent;
	let effectiveness = 1.0; // How much the scroll "counts"	

	// Determine scroll dampening if the user is on the top/bottom of the carousel
	let firstPanel = beatmapSetPanels[0];
	let lastPanel = last(beatmapSetPanels);
	let diff: number;

	// Top edge
	diff = firstPanel.currentNormalizedY - CAROUSEL_END_THRESHOLD;
	effectiveness = Math.pow(0.9, Math.max(0, diff/30));

	// Bottom edge
	diff = CAROUSEL_END_THRESHOLD - lastPanel.currentNormalizedY;
	effectiveness = Math.min(effectiveness, Math.pow(0.9, Math.max(0, diff/30)));

	scrollVelocity += wheelEvent.dy * 4 * effectiveness;
	snapToSelected = false;
});

export function updateCarouselSizing() {
	carouselScalingFactor = calculateRatioBasedScalingFactor(currentWindowDimensions.width, currentWindowDimensions.height, 16/9, REFERENCE_SCREEN_HEIGHT);	

	beatmapCarouselContainer.x = Math.floor(currentWindowDimensions.width - BEATMAP_CAROUSEL_RIGHT_MARGIN * getCarouselScalingFactor());

	updateDarkeningOverlay();
	updateBeatmapSetPanelMasks();
	updateBeatmapDifficultyPanelMasks();
	updateDifficultyColorBar();
	
	carouselDragTarget.hitArea = new PIXI.Rectangle(0, 0, currentWindowDimensions.width, currentWindowDimensions.height);

	for (let i = 0; i < beatmapSetPanels.length; i++) {
		let panel = beatmapSetPanels[i];
		panel.needsResize = true;
	}
}

export function getNormalizedOffsetOnCarousel(yPosition: number) {
	// -1.0 for top of the screen, 0.0 for middle, 1.0 for bottom
	let normalizedDistanceToCenter = (yPosition - currentWindowDimensions.height/2) / (currentWindowDimensions.height/2);
	let circleHeight = MathUtil.unitCircleContour(normalizedDistanceToCenter / BEATMAP_CAROUSEL_RADIUS_FACTOR);
	if (isNaN(circleHeight)) circleHeight = 1.0;

	return circleHeight * (REFERENCE_SCREEN_HEIGHT/2 * BEATMAP_CAROUSEL_RADIUS_FACTOR);
}