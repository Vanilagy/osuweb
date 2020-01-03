import { getGlobalScalingFactor } from "../../visuals/ui";
import { BEATMAP_SET_PANEL_WIDTH, BEATMAP_SET_PANEL_HEIGHT, BEATMAP_PANEL_HEIGHT, BEATMAP_PANEL_WIDTH } from "./beatmap_carousel";

let darkeningOverlay = document.createElement('canvas');
let darkeningOverlayCtx = darkeningOverlay.getContext('2d');
export function updateDarkeningOverlay() {
	let scalingFactor = getGlobalScalingFactor();

	darkeningOverlay.setAttribute('width', String(Math.ceil(BEATMAP_SET_PANEL_WIDTH * scalingFactor)));
	darkeningOverlay.setAttribute('height', String(Math.ceil(BEATMAP_SET_PANEL_HEIGHT * scalingFactor)));

	darkeningOverlayCtx.clearRect(0, 0, darkeningOverlay.width, darkeningOverlay.height);

	let gradient = darkeningOverlayCtx.createLinearGradient(200, 0, 500, 100);
	gradient.addColorStop(0, 'rgba(0,0,0,0.6)');
	gradient.addColorStop(1, 'rgba(0,0,0,0.0)');
	darkeningOverlayCtx.fillStyle = gradient;
	darkeningOverlayCtx.fillRect(0, 0, darkeningOverlay.width, darkeningOverlay.height);
}

export function getDarkeningOverlay() {
	return darkeningOverlay;
}

let beatmapSetPanelMask: PIXI.Graphics;
export function updateBeatmapSetPanelMask() {
	if (beatmapSetPanelMask) beatmapSetPanelMask.destroy();

	let scalingFactor = getGlobalScalingFactor();

	beatmapSetPanelMask = new PIXI.Graphics();
	beatmapSetPanelMask.beginFill(0x000000, 0.5);
	beatmapSetPanelMask.drawPolygon([
		new PIXI.Point(0, 0),
		new PIXI.Point(Math.floor(BEATMAP_SET_PANEL_HEIGHT/5 * scalingFactor), Math.floor(BEATMAP_SET_PANEL_HEIGHT * scalingFactor)),
		new PIXI.Point(Math.floor(BEATMAP_SET_PANEL_WIDTH * scalingFactor), Math.floor(BEATMAP_SET_PANEL_HEIGHT * scalingFactor)),
		new PIXI.Point(Math.floor(BEATMAP_SET_PANEL_WIDTH * scalingFactor), 0)
	]);
	beatmapSetPanelMask.endFill();
}

export function getBeatmapSetPanelMask() {
	return beatmapSetPanelMask;
}

let beatmapPanelMask: PIXI.Graphics;
export function updateBeatmapPanelMask() {
	if (beatmapPanelMask) beatmapPanelMask.destroy();
	
	let scalingFactor = getGlobalScalingFactor();

	beatmapPanelMask = new PIXI.Graphics();
	beatmapPanelMask.beginFill(0x000000, 0.5);
	beatmapPanelMask.drawPolygon([
		new PIXI.Point(0, 0),
		new PIXI.Point(Math.floor(BEATMAP_PANEL_HEIGHT/5 * scalingFactor), Math.floor(BEATMAP_PANEL_HEIGHT * scalingFactor)),
		new PIXI.Point(Math.floor(BEATMAP_PANEL_WIDTH * scalingFactor), Math.floor(BEATMAP_PANEL_HEIGHT * scalingFactor)),
		new PIXI.Point(Math.floor(BEATMAP_PANEL_WIDTH * scalingFactor), 0)
	]);
	beatmapPanelMask.endFill();
}

export function getBeatmapPanelMask() {
	return beatmapPanelMask;
}