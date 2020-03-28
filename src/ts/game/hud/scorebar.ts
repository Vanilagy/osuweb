import { EaseType } from "../../util/math_util";
import { OsuTexture } from "../skin/texture";
import { currentWindowDimensions } from "../../visuals/ui";
import { InterpolatedValueChanger, Interpolator } from "../../util/interpolation";
import { Hud } from "./hud";
import { AnimatedOsuSprite } from "../skin/animated_sprite";

const SCOREBAR_KI_DANGER_THRESHOLD = 0.5;
const SCOREBAR_KI_DANGER2_THRESHOLD = 0.25;

export class Scorebar {
	public hud: Hud;
	public container: PIXI.Container;
	private backgroundLayer: PIXI.Sprite;
	private colorLayerAnimator: AnimatedOsuSprite;
	private colorLayerMask: PIXI.Graphics;
	private progressInterpolator: InterpolatedValueChanger;
	private marker: PIXI.Container; // The marker at the end of the HP thing. Can refer to the marker texture, but also scorebar-ki, scorebar-kidanger and scorebar-kidanger2
	private hasPureMarker: boolean = false; // Marks if the scorebar uses the scorebar-marker texture for its marker
	private markerInterpolator: Interpolator;

	constructor(hud: Hud) {
		this.hud = hud;
		this.container = new PIXI.Container();

		this.progressInterpolator = new InterpolatedValueChanger({
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

	init() {
		this.container.removeChildren();

		let { skin } = this.hud.controller.currentPlay;

		let markerTexture = skin.textures["scorebarMarker"];
		this.hasPureMarker = !markerTexture.isEmpty();

		this.initBackgroundLayer();
		this.initColorLayer();
		this.initMask();
		this.initMarker();

		this.container.addChild(this.backgroundLayer);
		this.container.addChild(this.colorLayerAnimator.sprite);
		this.container.addChild(this.colorLayerMask);
		this.container.addChild(this.marker);
	}

	private initBackgroundLayer() {
		let { screenPixelRatio, skin } = this.hud.controller.currentPlay;

		let osuTexture = skin.textures["scorebarBackground"];
		let sprite = new PIXI.Sprite();
		osuTexture.applyToSprite(sprite, screenPixelRatio);

		this.backgroundLayer = sprite;
	}

	private initColorLayer() {
		let { screenPixelRatio, skin } = this.hud.controller.currentPlay;

		let osuTexture = skin.textures["scorebarColor"];
		let animator = new AnimatedOsuSprite(osuTexture, screenPixelRatio);
		animator.setFps(skin.config.general.animationFramerate);
		animator.play(0);
		animator.sprite.anchor.set(0.0, 0.0);

		let x: number, y: number;
		if (this.hasPureMarker) {
			x = 12;
			y = 13;
		} else {
			x = 5;
			y = 16;
		}

		animator.sprite.position.set(Math.floor(x * screenPixelRatio), Math.floor(y * screenPixelRatio));

		this.colorLayerAnimator = animator;
	}

	private initMask() {
		let mask = new PIXI.Graphics();
		mask.beginFill(0xFF0000);
		mask.drawRect(0, 0, this.colorLayerAnimator.sprite.width, currentWindowDimensions.height);
		mask.endFill();

		mask.position.copyFrom(this.colorLayerAnimator.sprite.position);

		this.colorLayerAnimator.sprite.mask = mask;
		this.colorLayerMask = mask;
	}

	private initMarker() {
		let { screenPixelRatio, skin } = this.hud.controller.currentPlay;

		let osuTexture: OsuTexture;
		if (this.hasPureMarker) {
			osuTexture = skin.textures["scorebarMarker"];
		} else {
			osuTexture = skin.textures["scorebarKi"];
		}

		let sprite = new PIXI.Sprite();

		let factor = screenPixelRatio;
		osuTexture.applyToSprite(sprite, factor);

		sprite.anchor.set(0.5, 0.5);
		if (this.hasPureMarker) sprite.blendMode = PIXI.BLEND_MODES.ADD;

		let wrapper = new PIXI.Container();
		wrapper.addChild(sprite);
		wrapper.position.set(Math.floor(12 * factor), Math.floor(18 * factor));

		this.marker = wrapper;
	}

	update(currentTime: number) {
		let { screenPixelRatio, skin } = this.hud.controller.currentPlay;

		let currentPercentage = this.progressInterpolator.getCurrentValue(currentTime);

		this.colorLayerMask.pivot.x = Math.floor((1-currentPercentage) * this.colorLayerAnimator.sprite.width);

		this.marker.x = 12 * screenPixelRatio + Math.floor(currentPercentage * this.colorLayerAnimator.sprite.width);
		this.marker.scale.set(this.markerInterpolator.getCurrentValue(currentTime));

		// Update the texture of the marker based on current percentage
		if (!this.hasPureMarker) {
			let markerSprite = this.marker.children[0] as PIXI.Sprite;
			let textureName = "scorebarKi";

			if (currentPercentage < SCOREBAR_KI_DANGER2_THRESHOLD) textureName = "scorebarKiDanger2";
			else if (currentPercentage < SCOREBAR_KI_DANGER_THRESHOLD) textureName = "scorebarKiDanger";

			let osuTexture = skin.textures[textureName];
			osuTexture.applyToSprite(markerSprite, screenPixelRatio);
		}
	}

	setAmount(percentage: number, currentTime: number) {
		let isGain = percentage > this.progressInterpolator.getCurrentGoal();

		this.progressInterpolator.setGoal(percentage, currentTime);
		if (isGain) this.markerInterpolator.start(currentTime);
	}
}