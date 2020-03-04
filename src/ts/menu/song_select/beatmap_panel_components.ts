import { BEATMAP_SET_PANEL_WIDTH, BEATMAP_SET_PANEL_HEIGHT, BEATMAP_DIFFICULTY_PANEL_HEIGHT, BEATMAP_DIFFICULTY_PANEL_WIDTH } from "./beatmap_carousel";
import { renderer } from "../../visuals/rendering";
import { createLinearGradientTexture, createPolygonTexture } from "../../util/pixi_util";

export const TEXTURE_MARGIN = 10;

let darkeningOverlay: PIXI.Texture = null;
export function updateDarkeningOverlay(scalingFactor: number) {
	darkeningOverlay = createLinearGradientTexture(BEATMAP_SET_PANEL_WIDTH, BEATMAP_SET_PANEL_HEIGHT + 2, new PIXI.Point(200, 0), new PIXI.Point(400, 100), [[0, 'rgba(0,0,0,0.4)'], [1, 'rgba(0,0,0,0.0)']], scalingFactor);
}

export function getDarkeningOverlay() {
	return darkeningOverlay;
}

let beatmapSetPanelMask: PIXI.Texture = null;
let beatmapSetPanelMaskInverted: PIXI.Texture = null;
let beatmapSetPanelGlowTexture: PIXI.RenderTexture = null;

export function updateBeatmapSetPanelMasks(scalingFactor: number) {
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
	let heightFactor = 0.02;

	difficultyColorBar = createLinearGradientTexture(BEATMAP_DIFFICULTY_PANEL_WIDTH, BEATMAP_DIFFICULTY_PANEL_HEIGHT * heightFactor, new PIXI.Point(0, 0), new PIXI.Point(BEATMAP_DIFFICULTY_PANEL_WIDTH, 0), [[0, 'rgba(255,255,255,1.0)'], [1, 'rgba(255,255,255,0.0)']], scalingFactor);
}

export function getDifficultyColorBar() {
	return difficultyColorBar;
}