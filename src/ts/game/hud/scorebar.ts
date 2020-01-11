import { InterpolatedCounter, Interpolator } from "../../util/graphics_util";
import { gameState } from "../game_state";
import { EaseType } from "../../util/math_util";
import { OsuTexture } from "../skin/texture";

const SCOREBAR_KI_DANGER_THRESHOLD = 0.5;
const SCOREBAR_KI_DANGER2_THRESHOLD = 0.25;

export class Scorebar {
	public container: PIXI.Container;
	private backgroundLayer: PIXI.Sprite;
	private colorLayer: PIXI.Sprite; // The part that actually changes with health
	private colorLayerMask: PIXI.Graphics;
	private progressInterpolator: InterpolatedCounter;
	private marker: PIXI.Container; // The marker at the end of the HP thing. Can refer to the marker texture, but also scorebar-ki, scorebar-kidanger and scorebar-kidanger2
	private hasPureMarker: boolean = false; // Marks if the scorebar uses the scorebar-marker texture for its marker
	private markerInterpolator: Interpolator;

	constructor() {
		this.container = new PIXI.Container();
		
		let markerTexture = gameState.currentGameplaySkin.textures["scorebarMarker"];
		this.hasPureMarker = !markerTexture.isEmpty();

		this.initBackgroundLayer();
		this.initColorLayer();
		this.initMask();
		this.initMarker();

		this.container.addChild(this.backgroundLayer);
		this.container.addChild(this.colorLayer);
		this.container.addChild(this.colorLayerMask);
		this.container.addChild(this.marker);

		this.progressInterpolator = new InterpolatedCounter({
			initial: 1.0,
			duration: 200,
			ease: EaseType.EaseOutQuad
		});

		this.markerInterpolator = new Interpolator({
			ease: EaseType.EaseOutQuad,
			from: 1.5,
			to: 1.0,
			duration: 200,
			defaultToFinished: true
		});
	}

	private initBackgroundLayer() {
		let osuTexture = gameState.currentGameplaySkin.textures["scorebarBackground"];
		let sprite = new PIXI.Sprite();

		let factor = gameState.currentPlay.screenPixelRatio;
		osuTexture.applyToSprite(sprite, factor);

		this.backgroundLayer = sprite;
	}

	private initColorLayer() {
		let osuTexture = gameState.currentGameplaySkin.textures["scorebarColor"];
		let sprite = new PIXI.Sprite();

		let factor = gameState.currentPlay.screenPixelRatio;
		osuTexture.applyToSprite(sprite, factor);

		let x: number, y: number;
		if (this.hasPureMarker) {
			x = 12;
			y = 13;
		} else {
			x = 5;
			y = 16;
		}

		sprite.position.set(Math.floor(x * factor), Math.floor(y * factor));

		this.colorLayer = sprite;
	}

	private initMask() {
		let mask = new PIXI.Graphics();
		mask.beginFill(0xFF0000);
		mask.drawRect(0, 0, this.colorLayer.width, window.innerHeight);
		mask.endFill();

		mask.position.copyFrom(this.colorLayer.position);

		this.colorLayer.mask = mask;
		this.colorLayerMask = mask;
	}

	private initMarker() {
		let osuTexture: OsuTexture;
		if (this.hasPureMarker) {
			osuTexture = gameState.currentGameplaySkin.textures["scorebarMarker"];
		} else {
			osuTexture = gameState.currentGameplaySkin.textures["scorebarKi"];
		}

		let sprite = new PIXI.Sprite();

		let factor = gameState.currentPlay.screenPixelRatio;
		osuTexture.applyToSprite(sprite, factor);

		sprite.anchor.set(0.5, 0.5);
		if (this.hasPureMarker) sprite.blendMode = PIXI.BLEND_MODES.ADD;

		let wrapper = new PIXI.Container();
		wrapper.addChild(sprite);
		wrapper.position.set(Math.floor(12 * factor), Math.floor(18 * factor));

		this.marker = wrapper;
	}

	update(currentTime: number) {
		let currentPercentage = this.progressInterpolator.getCurrentValue(currentTime);
		let factor = gameState.currentPlay.screenPixelRatio;

		this.colorLayerMask.pivot.x = Math.floor((1-currentPercentage) * this.colorLayer.width);

		this.marker.x = 12 * factor + Math.floor(currentPercentage * this.colorLayer.width);
		this.marker.scale.set(this.markerInterpolator.getCurrentValue(currentTime));

		// Update the texture of the marker based on current percentage
		if (!this.hasPureMarker) {
			let markerSprite = this.marker.children[0] as PIXI.Sprite;
			let textureName = "scorebarKi";

			if (currentPercentage < SCOREBAR_KI_DANGER2_THRESHOLD) textureName = "scorebarKiDanger2";
			else if (currentPercentage < SCOREBAR_KI_DANGER_THRESHOLD) textureName = "scorebarKiDanger";

			let osuTexture = gameState.currentGameplaySkin.textures[textureName];
			let factor = gameState.currentPlay.screenPixelRatio;
			osuTexture.applyToSprite(markerSprite, factor);
		}
	}

	setAmount(percentage: number, currentTime: number) {
		let isGain = percentage > this.progressInterpolator.getCurrentGoal();

		this.progressInterpolator.setGoal(percentage, currentTime);
		if (isGain) this.markerInterpolator.start(currentTime);
	}
}