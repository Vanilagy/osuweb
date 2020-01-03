import { BeatmapSetPanel } from "./beatmap_set_panel";

export const BEATMAP_CAROUSEL_RIGHT_MARGIN = 600;
export const BEATMAP_CAROUSEL_RADIUS_FACTOR = 2.5;
export const BEATMAP_SET_PANEL_WIDTH = 700;
export const BEATMAP_SET_PANEL_HEIGHT = 100;
export const BEATMAP_PANEL_WIDTH = 650;
export const BEATMAP_PANEL_HEIGHT = 50;
export const BEATMAP_SET_PANEL_MARGIN = 10;
export const BEATMAP_PANEL_MARGIN = 10;

export const beatmapCarouselContainer = new PIXI.Container();

export let beatmapSetPanels: BeatmapSetPanel[] = [];
let selectedPanel: BeatmapSetPanel = null;

export function setSelectedPanel(panel: BeatmapSetPanel) {
	selectedPanel = panel;
}
export function getSelectedPanel() {
	return selectedPanel;
}