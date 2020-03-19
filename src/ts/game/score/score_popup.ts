import { ScoreCounter } from "./score_counter";
import { AnimatedOsuSprite } from "../skin/animated_sprite";
import { OsuTexture } from "../skin/texture";
import { ParticleEmitter, DistanceDistribution } from "../../visuals/particle_emitter";
import { transferBasicProperties, transferBasicSpriteProperties } from "../../util/pixi_util";
import { EaseType, MathUtil } from "../../util/math_util";
import { Point } from "../../util/point";
import { ScoringValue } from "../../datamodel/score";

export enum ScorePopupType {
	Hit300,
	Hit100,
	Hit50,
	Miss,
	Geki, // Only 300s in the combo
	Katu300, // Only 100s or higher in the combo, but at least one 100 - last hit was 300
	Katu100 // Only 100s or higher in the combo, but at least one 100 - last hit was 100
}

export const hitJudgementToScorePopupType = new Map<number, ScorePopupType>();
hitJudgementToScorePopupType.set(ScoringValue.Hit300, ScorePopupType.Hit300);
hitJudgementToScorePopupType.set(ScoringValue.Hit100, ScorePopupType.Hit100);
hitJudgementToScorePopupType.set(ScoringValue.Hit50, ScorePopupType.Hit50);
hitJudgementToScorePopupType.set(ScoringValue.Miss, ScorePopupType.Miss);

export const scorePopupTypeToJudgementValue = new Map<ScorePopupType, number>();
scorePopupTypeToJudgementValue.set(ScorePopupType.Hit300, 300);
scorePopupTypeToJudgementValue.set(ScorePopupType.Hit100, 100);
scorePopupTypeToJudgementValue.set(ScorePopupType.Hit50, 50);
scorePopupTypeToJudgementValue.set(ScorePopupType.Miss, 0);
scorePopupTypeToJudgementValue.set(ScorePopupType.Geki, 300);
scorePopupTypeToJudgementValue.set(ScorePopupType.Katu300, 300);
scorePopupTypeToJudgementValue.set(ScorePopupType.Katu100, 100);

const SCORE_POPUP_APPEARANCE_TIME = 150; // Both in ms
const SCORE_POPUP_FADE_OUT_TIME = 1000;
const SCORE_POPUP_SECOND_CONTAINER_FADE_OUT_TIME = 250; // In ms
const MISS_POPUP_DROPDOWN_ACCERELATION = 0.00009; // in osu!pixels per ms^2
const SCORE_POPUP_GRADUAL_SCALE_UP_AMOUNT = 0.12;

export class ScorePopup {
	public scoreCounter: ScoreCounter;
	public container: PIXI.Container;
	public secondContainer: PIXI.Container; // Is shown ontop of all hit objects for a fraction of the total score popup time. That's just how it is!
	private secondSprite: PIXI.Sprite;

	private animatedSprite: AnimatedOsuSprite;
	private startTime: number = null;
	private osuPosition: Point;
	private type: ScorePopupType;
	public renderingFinished: boolean = false;
	private particleTexture: OsuTexture = null;
	private particleEmitter: ParticleEmitter;

	constructor(scoreCounter: ScoreCounter, type: ScorePopupType, osuPosition: Point, startTime: number) {
		this.scoreCounter = scoreCounter;
		this.type = type;
		this.osuPosition = osuPosition;
		this.startTime = startTime;

		let { headedHitObjectTextureFactor, skin } = this.scoreCounter.play;

		let textureName: string;
		switch (type) {
			case ScorePopupType.Miss: textureName = "hit0"; break;
			case ScorePopupType.Hit50: textureName = "hit50"; break;
			case ScorePopupType.Hit100: textureName = "hit100"; break;
			case ScorePopupType.Katu100: textureName = "hit100k"; break;
			case ScorePopupType.Hit300: textureName = "hit300"; break;
			case ScorePopupType.Katu300: textureName = "hit300k"; break;
			case ScorePopupType.Geki: textureName = "hit300g"; break;
		}
		let osuTexture = skin.textures[textureName];

		let judgementValue = scorePopupTypeToJudgementValue.get(type);
		// Set the correct particle texture
		if (judgementValue === 50) this.particleTexture = skin.textures["particle50"];
		else if (judgementValue === 100) this.particleTexture = skin.textures["particle100"];
		else if (judgementValue === 300) this.particleTexture = skin.textures["particle300"];

		let animatedSprite = new AnimatedOsuSprite(osuTexture, headedHitObjectTextureFactor);
		animatedSprite.loop = false;
		animatedSprite.setFps(60); // "Animation rate is fixed to 60 FPS."
		animatedSprite.play(startTime);
		this.animatedSprite = animatedSprite;

		let wrapper = new PIXI.Container();
		wrapper.addChild(animatedSprite.sprite);

		this.container = wrapper;

		let secondWrapper = new PIXI.Container();
		let secondSprite = new PIXI.Sprite();
		secondWrapper.addChild(secondSprite);
		secondSprite.blendMode = PIXI.BLEND_MODES.ADD;
		secondSprite.alpha = 0.6; // To not be too extreme
		this.secondContainer = secondWrapper;
		this.secondSprite = secondSprite;
		
		let screenCoordinates = this.scoreCounter.play.toScreenCoordinates(osuPosition);
		this.container.position.set(screenCoordinates.x, screenCoordinates.y);

		if (type === ScorePopupType.Miss) {
			this.container.rotation = (2 * (Math.random() - 0.5)) * Math.PI * 0.05; // Random tilt for miss popup
		}

		transferBasicProperties(this.container, this.secondContainer);
		transferBasicSpriteProperties(this.animatedSprite.sprite, this.secondSprite);

		if (this.hasParticles()) {
			let emitter = new ParticleEmitter([this.particleTexture]);
			emitter.setTravelBehavior(0, 72, EaseType.Linear, DistanceDistribution.Normal);
			emitter.setLongevityBehavior(400, SCORE_POPUP_FADE_OUT_TIME);
			emitter.setAlphaBehavior(1, 0, EaseType.EaseInQuad);
			emitter.setScale(headedHitObjectTextureFactor);
			emitter.setBlendMode(PIXI.BLEND_MODES.ADD);
			emitter.container.position.copyFrom(this.container.position);

			emitter.emit(startTime, 170, 170);

			this.particleEmitter = emitter;
		}
	}

	private hasParticles() {
		return !!this.particleTexture && !this.particleTexture.isEmpty();
	}

	update(currentTime: number) {
		if (currentTime >= this.startTime + SCORE_POPUP_FADE_OUT_TIME) {
			this.renderingFinished = true;
			return;
		}

		let elapsedTime = currentTime - this.startTime;

		if (this.animatedSprite.getFrameCount() === 0) {
			// If the popup has no animation, animate it bouncing in:
			let appearanceCompletion = elapsedTime / SCORE_POPUP_APPEARANCE_TIME;
			appearanceCompletion = MathUtil.clamp(appearanceCompletion, 0, 1);
			appearanceCompletion = MathUtil.ease(EaseType.EaseOutElastic, appearanceCompletion, 0.55);

			let sizeFactor = appearanceCompletion;

			if (this.hasParticles()) {
				// If the popup has particles, apply an additional gradual scale-up animation:
				let gradualScaleUp = elapsedTime / SCORE_POPUP_FADE_OUT_TIME;
				sizeFactor += gradualScaleUp * SCORE_POPUP_GRADUAL_SCALE_UP_AMOUNT;
			}

			this.container.scale.set(sizeFactor);
		} else {
			this.animatedSprite.update(currentTime);
		}

		if (this.particleEmitter) this.particleEmitter.update(currentTime);

		let fadeOutCompletion = elapsedTime / SCORE_POPUP_FADE_OUT_TIME;
		fadeOutCompletion = MathUtil.clamp(fadeOutCompletion, 0, 1);
		fadeOutCompletion = MathUtil.ease(EaseType.EaseInQuart, fadeOutCompletion);
		
		this.container.alpha = 1 - fadeOutCompletion;

		if (this.type === ScorePopupType.Miss) {
			let droppedDistance = 0.5 * MISS_POPUP_DROPDOWN_ACCERELATION * elapsedTime**2; // s(t) = 0.5*a*t^2
			let osuY = this.osuPosition.y + droppedDistance;
			this.container.y = this.scoreCounter.play.toScreenCoordinatesY(osuY, false);
		}

		transferBasicProperties(this.container, this.secondContainer);
		transferBasicSpriteProperties(this.animatedSprite.sprite, this.secondSprite);

		let secondContainerFadeOutCompletion = elapsedTime / SCORE_POPUP_SECOND_CONTAINER_FADE_OUT_TIME;
		secondContainerFadeOutCompletion = MathUtil.clamp(secondContainerFadeOutCompletion, 0, 1);
		secondContainerFadeOutCompletion = MathUtil.ease(EaseType.Linear, secondContainerFadeOutCompletion);

		this.secondContainer.alpha = 1 - secondContainerFadeOutCompletion;
	}

	show() {
		const controller = this.scoreCounter.play.controller;

		if (this.hasParticles()) {
			controller.lowerScorePopupContainer.addChild(this.particleEmitter.container);
			controller.lowerScorePopupContainer.addChild(this.container);
			controller.upperScorePopupContainer.addChild(this.secondContainer);
		} else {
			controller.upperScorePopupContainer.addChild(this.container);
		}
	}

	remove() {
		const controller = this.scoreCounter.play.controller;

		if (this.hasParticles()) {
			controller.lowerScorePopupContainer.removeChild(this.particleEmitter.container);
			controller.lowerScorePopupContainer.removeChild(this.container);
			controller.upperScorePopupContainer.removeChild(this.secondContainer);
		} else {
			controller.upperScorePopupContainer.removeChild(this.container);
		}
	}
}