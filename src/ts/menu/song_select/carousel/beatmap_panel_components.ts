import { renderer } from "../../../visuals/rendering";
import { createLinearGradientTexture, createPolygonTexture } from "../../../util/pixi_util";
import { BEATMAP_SET_PANEL_WIDTH, BEATMAP_SET_PANEL_HEIGHT } from "./beatmap_set_panel";
import { BEATMAP_DIFFICULTY_PANEL_HEIGHT, BEATMAP_DIFFICULTY_PANEL_WIDTH } from "./beatmap_difficulty_panel";

export const TEXTURE_MARGIN = 10;

let darkeningOverlay: PIXI.Texture = null;
export function updateDarkeningOverlay(scalingFactor: number) {
	darkeningOverlay?.destroy(true);
	darkeningOverlay = createLinearGradientTexture(BEATMAP_SET_PANEL_WIDTH, BEATMAP_SET_PANEL_HEIGHT + 2, new PIXI.Point(200, 0), new PIXI.Point(400, 100), [[0, 'rgba(0,0,0,0.4)'], [1, 'rgba(0,0,0,0.0)']], scalingFactor);
}

export function getDarkeningOverlay() {
	return darkeningOverlay;
}

let beatmapSetPanelMask: PIXI.Texture = null;
let beatmapSetPanelMaskInverted: PIXI.Texture = null;
let beatmapSetPanelGlowTexture: PIXI.RenderTexture = null;

export function updateBeatmapSetPanelMasks(scalingFactor: number) {
	beatmapSetPanelMask?.destroy(true);
	beatmapSetPanelMaskInverted?.destroy(true);
	beatmapSetPanelGlowTexture?.destroy(true);

	let slantWidth = BEATMAP_SET_PANEL_HEIGHT/5;
	let points = [new PIXI.Point(BEATMAP_SET_PANEL_WIDTH, 0), new PIXI.Point(0, 0), new PIXI.Point(slantWidth, BEATMAP_SET_PANEL_HEIGHT), new PIXI.Point(BEATMAP_SET_PANEL_WIDTH, BEATMAP_SET_PANEL_HEIGHT)];

	let mask = createPolygonTexture(BEATMAP_SET_PANEL_WIDTH, BEATMAP_SET_PANEL_HEIGHT, points, scalingFactor, TEXTURE_MARGIN);
	let invertedMask = createPolygonTexture(BEATMAP_SET_PANEL_WIDTH, BEATMAP_SET_PANEL_HEIGHT, points, scalingFactor, TEXTURE_MARGIN, true);

	beatmapSetPanelMask = mask;
	beatmapSetPanelMaskInverted = invertedMask;

	let glowSprite = new PIXI.Sprite(mask);
	let glowFilter = new PIXI.filters.GlowFilter(6 * scalingFactor, 5, 0, 0xffffff, 1.0);
	glowSprite.filters = [glowFilter];
	let glowMask = new PIXI.Sprite(invertedMask);

	let glowSpriteContainer = new PIXI.Container();
	glowSpriteContainer.addChild(glowSprite);
	glowSpriteContainer.addChild(glowMask);
	glowSpriteContainer.mask = glowMask;

	beatmapSetPanelGlowTexture = PIXI.RenderTexture.create({
		width: Math.ceil((BEATMAP_SET_PANEL_WIDTH + TEXTURE_MARGIN) * scalingFactor),
		height: Math.ceil((BEATMAP_SET_PANEL_HEIGHT + TEXTURE_MARGIN * 2) * scalingFactor)
	});
	renderer.render(glowSpriteContainer, beatmapSetPanelGlowTexture);
}

export function getBeatmapSetPanelMask() {
	return beatmapSetPanelMask;
}

export function getBeatmapSetPanelMaskInverted() {
	return beatmapSetPanelMaskInverted;
}

export function getBeatmapSetPanelGlowTexture() {
	return beatmapSetPanelGlowTexture;
}

let beatmapDifficultyPanelMask: PIXI.Texture = null;
let beatmapDifficultyPanelMaskInverted: PIXI.Texture = null;
let beatmapDifficultyPanelGlowTexture: PIXI.RenderTexture;

export function updateBeatmapDifficultyPanelMasks(scalingFactor: number) {
	beatmapDifficultyPanelMask?.destroy();
	beatmapDifficultyPanelMaskInverted?.destroy();
	beatmapDifficultyPanelGlowTexture?.destroy();

	let slantWidth = BEATMAP_DIFFICULTY_PANEL_HEIGHT/5;
	let points = [new PIXI.Point(BEATMAP_DIFFICULTY_PANEL_WIDTH, 0), new PIXI.Point(0, 0), new PIXI.Point(slantWidth, BEATMAP_DIFFICULTY_PANEL_HEIGHT), new PIXI.Point(BEATMAP_DIFFICULTY_PANEL_WIDTH, BEATMAP_DIFFICULTY_PANEL_HEIGHT)];

	let mask = createPolygonTexture(BEATMAP_DIFFICULTY_PANEL_WIDTH, BEATMAP_DIFFICULTY_PANEL_HEIGHT, points, scalingFactor, TEXTURE_MARGIN);
	let invertedMask = createPolygonTexture(BEATMAP_DIFFICULTY_PANEL_WIDTH, BEATMAP_DIFFICULTY_PANEL_HEIGHT, points, scalingFactor, TEXTURE_MARGIN, true);

	beatmapDifficultyPanelMask = mask;
	beatmapDifficultyPanelMaskInverted = invertedMask;

	let glowSprite = new PIXI.Sprite(mask);
	let glowFilter = new PIXI.filters.GlowFilter(5 * scalingFactor, 5, 0, 0xffffff, 1.0);
	glowSprite.filters = [glowFilter];
	let glowMask = new PIXI.Sprite(invertedMask);

	let glowSpriteContainer = new PIXI.Container();
	glowSpriteContainer.addChild(glowSprite);
	glowSpriteContainer.addChild(glowMask);
	glowSpriteContainer.mask = glowMask;

	beatmapDifficultyPanelGlowTexture = PIXI.RenderTexture.create({
		width: Math.ceil((BEATMAP_DIFFICULTY_PANEL_WIDTH + TEXTURE_MARGIN) * scalingFactor),
		height: Math.ceil((BEATMAP_DIFFICULTY_PANEL_HEIGHT + TEXTURE_MARGIN * 2) * scalingFactor)
	});
	renderer.render(glowSpriteContainer, beatmapDifficultyPanelGlowTexture);
}

export function getBeatmapDifficultyPanelMask() {
	return beatmapDifficultyPanelMask;
}

export function getBeatmapDifficultyPanelMaskInverted() {
	return beatmapDifficultyPanelMaskInverted;
}

export function getBeatmapDifficultyPanelGlowTexture() {
	return beatmapDifficultyPanelGlowTexture;
}

let difficultyColorBar: PIXI.Texture = null;

export function updateDifficultyColorBar(scalingFactor: number) {
	difficultyColorBar?.destroy(true);

	let heightFactor = 0.02;

	difficultyColorBar = createLinearGradientTexture(BEATMAP_DIFFICULTY_PANEL_WIDTH, BEATMAP_DIFFICULTY_PANEL_HEIGHT * heightFactor, new PIXI.Point(0, 0), new PIXI.Point(BEATMAP_DIFFICULTY_PANEL_WIDTH, 0), [[0, 'rgba(255,255,255,1.0)'], [1, 'rgba(255,255,255,0.0)']], scalingFactor);
}

export function getDifficultyColorBar() {
	return difficultyColorBar;
}

export function drawStarRatingTicks(g: PIXI.Graphics, starRating: number, scalingFactor: number) {
	g.clear();
	g.beginFill(0xffffff);

	function addStarRatingTick(percent: number, index: number) {
		let width = Math.floor(15 * percent * scalingFactor);
		if (width === 0) return;
		let x = Math.floor(20 * index * scalingFactor);

		g.drawPolygon([
			new PIXI.Point(x + 2, 0),
			new PIXI.Point(x + Math.floor(2 * scalingFactor) + width, 0),
			new PIXI.Point(x + width, Math.floor(3 * scalingFactor)),
			new PIXI.Point(x + 0, Math.floor(3 * scalingFactor))
		]);
	}

	let flooredSr = Math.floor(starRating);
	for (let i = 0; i < flooredSr; i++) {
		addStarRatingTick(1.0, i);
	}
	if (starRating !== flooredSr) {
		addStarRatingTick(starRating - flooredSr, flooredSr);
	}

	g.endFill();
}