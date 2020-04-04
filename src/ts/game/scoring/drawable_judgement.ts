import { AnimatedOsuSprite } from "../skin/animated_sprite";
import { OsuTexture } from "../skin/texture";
import { ParticleEmitter, DistanceDistribution } from "../../visuals/particle_emitter";
import { transferBasicProperties, transferBasicSpriteProperties } from "../../util/pixi_util";
import { EaseType, MathUtil } from "../../util/math_util";
import { ScoringValue } from "../../datamodel/scoring/score";
import { DrawableScoreProcessor } from "./drawable_score_processor";
import { Judgement } from "../../datamodel/scoring/judgement";

const DRAWABLE_JUDGEMENT_APPEARANCE_TIME = 150; // Both in ms
const DRAWABLE_JUDGEMENT_FADE_OUT_TIME = 1000;
const DRAWABLE_JUDGEMENT_SECOND_CONTAINER_FADE_OUT_TIME = 250; // In ms
const MISS_DRAWABLE_DROPDOWN_ACCERELATION = 0.00009; // in osu!pixels per ms^2
const DRAWABLE_JUDGEMENT_GRADUAL_SCALE_UP_AMOUNT = 0.12;

export class DrawableJudgement {
	public scoreProcessor: DrawableScoreProcessor;
	private judgement: Judgement;

	public container: PIXI.Container;
	public secondContainer: PIXI.Container; // Is shown ontop of all hit objects for a fraction of the total drawable judgement time. That's just how it is!
	private secondSprite: PIXI.Sprite;

	private animatedSprite: AnimatedOsuSprite;

	private particleTexture: OsuTexture = null;
	private particleEmitter: ParticleEmitter;

	public renderingFinished: boolean = false;

	constructor(scoreProcessor: DrawableScoreProcessor, judgement: Judgement) {
		this.scoreProcessor = scoreProcessor;
		this.judgement = judgement;

		let { headedHitObjectTextureFactor, skin } = this.scoreProcessor.play;

		let textureName = this.judgement.getTextureName();
		let osuTexture = skin.textures[textureName];
		if (osuTexture.isEmpty()) return;

		// Slider points are not shown in a skin with a version greater than 1
		if ((judgement.value === ScoringValue.SliderTick || judgement.value === ScoringValue.SliderRepeat) && skin.getVersionNumber() > 1) return;

		// Set the correct particle texture
		if (judgement.value === ScoringValue.Hit50) this.particleTexture = skin.textures["particle50"];
		else if (judgement.value === ScoringValue.Hit100) this.particleTexture = skin.textures["particle100"];
		else if (judgement.value === ScoringValue.Hit300) this.particleTexture = skin.textures["particle300"];

		let animatedSprite = new AnimatedOsuSprite(osuTexture, headedHitObjectTextureFactor);
		animatedSprite.loop = false;
		animatedSprite.setFps(60); // "Animation rate is fixed to 60 FPS."
		animatedSprite.play(judgement.time);
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

		if (judgement.value === ScoringValue.Miss) {
			this.container.rotation = (2 * (Math.random() - 0.5)) * Math.PI * 0.05; // Random tilt for miss drawable
		}

		if (this.hasParticles()) {
			let emitter = new ParticleEmitter([this.particleTexture]);
			emitter.setTravelBehavior(0, 72, EaseType.Linear, DistanceDistribution.Normal);
			emitter.setLongevityBehavior(400, DRAWABLE_JUDGEMENT_FADE_OUT_TIME);
			emitter.setAlphaBehavior(1, 0, EaseType.EaseInQuad);
			emitter.setBlendMode(PIXI.BLEND_MODES.ADD);
			emitter.setScale(headedHitObjectTextureFactor);

			emitter.emit(judgement.time, 170, 170);

			this.particleEmitter = emitter;
		}

		this.compose();
	}

	compose() {
		if (!this.container) return;
		let { headedHitObjectTextureFactor } = this.scoreProcessor.play;

		this.animatedSprite.setTexture(this.animatedSprite.getTexture(), headedHitObjectTextureFactor);

		let screenCoordinates = this.scoreProcessor.play.toScreenCoordinates(this.judgement.getPosition());
		this.container.position.set(screenCoordinates.x, screenCoordinates.y);

		transferBasicProperties(this.container, this.secondContainer);
		transferBasicSpriteProperties(this.animatedSprite.sprite, this.secondSprite);

		if (this.particleEmitter) {
			this.particleEmitter.container.position.copyFrom(this.container.position);
			this.particleEmitter.setScale(headedHitObjectTextureFactor);
		}
	}

	private hasParticles() {
		return !!this.particleTexture && !this.particleTexture.isEmpty();
	}

	update(currentTime: number) {
		if (!this.container) return;

		let isSliderPoint = this.judgement.value === ScoringValue.SliderTick || this.judgement.value === ScoringValue.SliderRepeat;
		let elapsedTime = currentTime - this.judgement.time;
		if (isSliderPoint) elapsedTime *= 2.5; // Slider points don't last very long

		if (elapsedTime >= DRAWABLE_JUDGEMENT_FADE_OUT_TIME) {
			this.renderingFinished = true;
			return;
		}

		if (this.animatedSprite.getFrameCount() === 0 && !isSliderPoint) {
			// If the drawable has no animation, animate it bouncing in:
			let appearanceCompletion = elapsedTime / DRAWABLE_JUDGEMENT_APPEARANCE_TIME;
			appearanceCompletion = MathUtil.clamp(appearanceCompletion, 0, 1);
			appearanceCompletion = MathUtil.ease(EaseType.EaseOutElastic, appearanceCompletion, 0.55);

			let sizeFactor = appearanceCompletion;

			if (this.hasParticles()) {
				// If the drawable has particles, apply an additional gradual scale-up animation:
				let gradualScaleUp = elapsedTime / DRAWABLE_JUDGEMENT_FADE_OUT_TIME;
				sizeFactor += gradualScaleUp * DRAWABLE_JUDGEMENT_GRADUAL_SCALE_UP_AMOUNT;
			}

			this.container.scale.set(sizeFactor);
		} else {
			this.animatedSprite.update(currentTime);
		}

		if (this.particleEmitter) this.particleEmitter.update(currentTime);

		let fadeOutCompletion = elapsedTime / DRAWABLE_JUDGEMENT_FADE_OUT_TIME;
		fadeOutCompletion = MathUtil.clamp(fadeOutCompletion, 0, 1);
		let easedFadeOutCompletion = MathUtil.ease(EaseType.EaseInQuart, fadeOutCompletion);
		
		this.container.alpha = 1 - easedFadeOutCompletion;

		if (this.judgement.value === ScoringValue.Miss) {
			let droppedDistance = 0.5 * MISS_DRAWABLE_DROPDOWN_ACCERELATION * elapsedTime**2; // s(t) = 0.5*a*t^2
			let osuY = this.judgement.getPosition().y + droppedDistance;
			this.container.y = this.scoreProcessor.play.toScreenCoordinatesY(osuY, false);
		} else if (isSliderPoint) {
			let riseDistance = 10 * MathUtil.ease(EaseType.EaseOutCubic, fadeOutCompletion);
			let osuY = this.judgement.getPosition().y - riseDistance;
			this.container.y = this.scoreProcessor.play.toScreenCoordinatesY(osuY, false);
		}

		transferBasicProperties(this.container, this.secondContainer);
		transferBasicSpriteProperties(this.animatedSprite.sprite, this.secondSprite);

		let secondContainerFadeOutCompletion = elapsedTime / DRAWABLE_JUDGEMENT_SECOND_CONTAINER_FADE_OUT_TIME;
		secondContainerFadeOutCompletion = MathUtil.clamp(secondContainerFadeOutCompletion, 0, 1);
		secondContainerFadeOutCompletion = MathUtil.ease(EaseType.Linear, secondContainerFadeOutCompletion);

		this.secondContainer.alpha = 1 - secondContainerFadeOutCompletion;
	}

	show() {
		if (!this.container) return;

		const controller = this.scoreProcessor.play.controller;

		if (this.hasParticles()) {
			controller.lowerDrawableJudgementContainer.addChild(this.particleEmitter.container);
			controller.lowerDrawableJudgementContainer.addChild(this.container);
			controller.upperDrawableJudgementContainer.addChild(this.secondContainer);
		} else {
			controller.upperDrawableJudgementContainer.addChild(this.container);
		}
	}

	remove() {
		if (!this.container) return;

		const controller = this.scoreProcessor.play.controller;

		if (this.hasParticles()) {
			controller.lowerDrawableJudgementContainer.removeChild(this.particleEmitter.container);
			controller.lowerDrawableJudgementContainer.removeChild(this.container);
			controller.upperDrawableJudgementContainer.removeChild(this.secondContainer);
		} else {
			controller.upperDrawableJudgementContainer.removeChild(this.container);
		}
	}
}