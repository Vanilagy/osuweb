import { DEFAULT_HIT_OBJECT_FADE_IN_TIME, HIT_OBJECT_FADE_OUT_TIME } from "../../util/constants";
import { colorToHexNumber } from "../../util/graphics_util";
import { SpriteNumber } from "../../visuals/sprite_number";
import { MathUtil, EaseType } from "../../util/math_util";
import { AnimatedOsuSprite } from "../skin/animated_sprite";
import { OsuTexture } from "../skin/texture";
import { ComboInfo } from "../../datamodel/processed/processed_beatmap";
import { DrawableHitObject } from "./drawable_hit_object";
import { Mod } from "../../datamodel/mods";

const HIT_CIRCLE_NUMBER_FADE_OUT_TIME = 50;
const HIT_CIRCLE_FADE_OUT_TIME_ON_MISS = 75;
const REVERSE_ARROW_FADE_IN_TIME = 150;
const REVERSE_ARROW_PULSE_DURATION = 300;
const SHAKE_DURATION = 200;

interface HitCirclePrimitiveOptions {
	fadeInStart: number,
	hitObject: DrawableHitObject,
	hasApproachCircle: boolean,
	hasNumber: boolean,
	reverseArrowAngle?: number,
	type: HitCirclePrimitiveType,
	baseElementsHidden?: boolean
}

export enum HitCirclePrimitiveType {
	HitCircle,
	SliderHead,
	SliderEnd
}

export enum HitCirclePrimitiveFadeOutType {
	ScaleOut,
	FadeOut
}

interface HitCirclePrimitiveFadeOutOptions {
	type: HitCirclePrimitiveFadeOutType,
	time: number
}

export class HitCirclePrimitive {
	private options: HitCirclePrimitiveOptions;
	private fadeOut: HitCirclePrimitiveFadeOutOptions;
	private fadeOutStartOpacity: number;

	public container: PIXI.Container;
	private base: PIXI.Container;
	private overlay: PIXI.Container;
	private overlayAnimator: AnimatedOsuSprite = null;
	private number: SpriteNumber = null;
	public approachCircle: PIXI.Container;
	public reverseArrow: PIXI.Container;
	private shakeStartTime: number;
	public renderFinished: boolean;

	constructor(options: HitCirclePrimitiveOptions) {
		this.options = options;
		this.approachCircle = null;
		this.reverseArrow = null;

		this.container = new PIXI.Container();

		let baseSprite = new PIXI.Sprite();
		baseSprite.anchor.set(0.5, 0.5);
		this.base = new PIXI.Container();
		this.base.addChild(baseSprite);

		this.overlayAnimator = new AnimatedOsuSprite();
		this.overlayAnimator.setFps(2); // From the website: "Animation rate: 2 FPS (4 FPS max)." "This rate is affected by the half time and double time/nightcore the game modifiers."
		this.overlay = new PIXI.Container();
		this.overlay.addChild(this.overlayAnimator.sprite);

		if (this.options.hasNumber) {
			this.number = new SpriteNumber({
				horizontalAlign: "center",
				verticalAlign: "middle"
			});
			this.number.setValue(this.options.hitObject.parent.comboInfo.n);
		}

		if (this.options.reverseArrowAngle !== undefined) {
			let sprite = new PIXI.Sprite();
			sprite.anchor.set(0.5, 0.5);
			sprite.rotation = this.options.reverseArrowAngle;

			let wrapper = new PIXI.Container();
			wrapper.addChild(sprite);

			this.reverseArrow = wrapper;
		}

		if (this.options.hasApproachCircle) {
			let sprite = new PIXI.Sprite();
			sprite.anchor.set(0.5, 0.5);

			let wrapper = new PIXI.Container();
			wrapper.addChild(sprite);

			this.approachCircle = wrapper;
		}

		this.reset();
	}

	/** Updates textures and sizing. */
	compose() {
		let { headedHitObjectTextureFactor, skin, processedBeatmap } = this.options.hitObject.drawableBeatmap.play;
		let beatmap = processedBeatmap.beatmap;

		// Base //

		let baseOsuTexture = skin.textures["hitCircle"];

		if (this.options.type === HitCirclePrimitiveType.SliderHead) {
			let startTex = skin.textures["sliderStartCircle"];
			if (!startTex.isEmpty()) baseOsuTexture = startTex;
		} else if (this.options.type === HitCirclePrimitiveType.SliderEnd) {
			let endTex = skin.textures["sliderEndCircle"];
			if (!endTex.isEmpty()) baseOsuTexture = endTex;
		}

		let baseSprite = this.base.children[0] as PIXI.Sprite;
		baseSprite.tint = colorToHexNumber(this.options.hitObject.color);
		baseOsuTexture.applyToSprite(baseSprite, headedHitObjectTextureFactor);

		// Overlay //

		let overlayOsuTexture: OsuTexture = null;

		if (this.options.type === HitCirclePrimitiveType.HitCircle) {
			overlayOsuTexture = skin.textures["hitCircleOverlay"];
		} else if (this.options.type === HitCirclePrimitiveType.SliderHead) {
			let baseTex = skin.textures["sliderStartCircle"];

			if (!baseTex.isEmpty()) {
				let overlayTex = skin.textures["sliderStartCircleOverlay"];
				if (!overlayTex.isEmpty()) overlayOsuTexture = overlayTex;
			} else {
				overlayOsuTexture = skin.textures["hitCircleOverlay"]; // Fall back to regular hitcircle's overlay
			}
		} else if (this.options.type === HitCirclePrimitiveType.SliderEnd) {
			let baseTex = skin.textures["sliderEndCircle"];

			if (!baseTex.isEmpty()) {
				let overlayTex = skin.textures["sliderEndCircleOverlay"];
				if (!overlayTex.isEmpty()) overlayOsuTexture = overlayTex;
			} else {
				overlayOsuTexture = skin.textures["hitCircleOverlay"]; // Fall back to regular hitcircle's overlay
			}
		}
		
		if (overlayOsuTexture) this.overlayAnimator.setTexture(overlayOsuTexture, headedHitObjectTextureFactor);
		else this.overlayAnimator.removeTexture();

		// Number //

		if (this.options.hasNumber) {
			this.number.options.textures = skin.hitCircleNumberTextures;
			this.number.options.overlap = skin.config.fonts.hitCircleOverlap;
			this.number.options.scaleFactor = headedHitObjectTextureFactor * 0.8; // "This element is downscaled by 0.8x" https://osu.ppy.sh/help/wiki/Skinning/osu!

			this.number.refresh();
		}

		// Reverse arrow //

		if (this.options.reverseArrowAngle !== undefined) {
			let osuTexture = skin.textures["reverseArrow"];
			let sprite = this.reverseArrow.children[0] as PIXI.Sprite;

			osuTexture.applyToSprite(sprite, headedHitObjectTextureFactor);
		}

		// Approach circle //

		if (this.options.hasApproachCircle) {
			let osuTexture = skin.textures["approachCircle"];
			let sprite = this.approachCircle.children[0] as PIXI.Sprite;

			osuTexture.applyToSprite(sprite, headedHitObjectTextureFactor);
			sprite.tint = colorToHexNumber(this.options.hitObject.color);
		}

		this.container.removeChildren();
		this.container.addChild(this.base);

		let overlayAboveNumber: boolean;
		if (beatmap.overlayPosition === 'NoChange') overlayAboveNumber = skin.config.general.hitCircleOverlayAboveNumber;
		else overlayAboveNumber = beatmap.overlayPosition === 'Above';

		if (overlayAboveNumber) {
			if (this.number) this.container.addChild(this.number.container);
			this.container.addChild(this.overlay);
		} else {
			this.container.addChild(this.overlay);
			if (this.number) this.container.addChild(this.number.container);
		}
	}

	reset() {
		this.fadeOut = null;
		this.renderFinished = false;
		this.shakeStartTime = -Infinity;

		this.container.visible = this.options.baseElementsHidden !== true;
		if (this.approachCircle) this.approachCircle.visible = true;
		if (this.reverseArrow) this.reverseArrow.visible = true;
	}

	update(currentTime: number) {
		if (this.renderFinished) return;

		let { approachTime, circleDiameter, activeMods } = this.options.hitObject.drawableBeatmap.play;

		let hasHidden = activeMods.has(Mod.Hidden);

		if (this.overlayAnimator !== null) this.overlayAnimator.update(currentTime);

		if (hasHidden || this.fadeOut === null) {
			let fadeInCompletion = this.getFadeInCompletion(currentTime, hasHidden);
			let hiddenFadeOutCompletion = hasHidden? this.getHiddenFadeOutCompletion(currentTime) : 0;

			this.container.alpha = fadeInCompletion * (1 - hiddenFadeOutCompletion);

			this.base.scale.set(1.0);
			if (this.overlay) this.overlay.scale.set(1.0);
			
			if (this.reverseArrow) {
				this.reverseArrow.scale.set(1.0);

				// When using HD, any reverse arrow but the first one will receive no fade-in animation whatsoever
				if (this.options.baseElementsHidden) this.reverseArrow.alpha = Math.ceil(fadeInCompletion);
				else {
					let reverseArrowFadeInCompletion = (currentTime - this.options.fadeInStart) / REVERSE_ARROW_FADE_IN_TIME;
					reverseArrowFadeInCompletion = MathUtil.clamp(reverseArrowFadeInCompletion, 0, 1);
	
					this.reverseArrow.alpha = reverseArrowFadeInCompletion;
				}
			}

			if (this.approachCircle !== null) {
				let approachCircleCompletion = (currentTime - this.options.fadeInStart) / approachTime;
				approachCircleCompletion = MathUtil.clamp(approachCircleCompletion, 0, 1);
	
				let approachCircleFactor = (1-approachCircleCompletion) * 3 + 1; // Goes from 4.0 -> 1.0
				this.approachCircle.scale.set(approachCircleFactor);
	
				this.approachCircle.alpha = fadeInCompletion * (1 - hiddenFadeOutCompletion);
	
				if (approachCircleCompletion === 1) this.approachCircle.visible = false;
				else this.approachCircle.visible = true;
			}

			if (this.reverseArrow !== null) {
				let scale = this.getReverseArrowScale(currentTime);
				this.reverseArrow.scale.set(scale);
			}

			if (this.number) this.number.container.alpha = 1;
			
			// Dirty?
			if (this.fadeOut) {
				this.container.visible = false;
				if (this.approachCircle) this.approachCircle.visible = false;
				if (this.reverseArrow) this.reverseArrow.visible = false;
				
				this.renderFinished = true;
			}
		} else {
			if (this.approachCircle) this.approachCircle.visible = false;

			let fadeOutTime = (this.fadeOut.type === HitCirclePrimitiveFadeOutType.ScaleOut)? HIT_OBJECT_FADE_OUT_TIME : HIT_CIRCLE_FADE_OUT_TIME_ON_MISS;

			let fadeOutCompletion = (currentTime - this.fadeOut.time) / fadeOutTime;
			fadeOutCompletion = MathUtil.clamp(fadeOutCompletion, 0, 1);

			let alpha = MathUtil.lerp(this.fadeOutStartOpacity, 0, fadeOutCompletion);
			this.container.alpha = alpha;
			if (this.reverseArrow) this.reverseArrow.alpha = alpha;

			if (this.fadeOut.type === HitCirclePrimitiveFadeOutType.ScaleOut) {
				let scale = 1 + MathUtil.ease(EaseType.EaseOutQuad, fadeOutCompletion) * 0.5; // Max scale: 1.5

				this.base.scale.set(scale);
				if (this.overlay) this.overlay.scale.set(scale);

				if (this.reverseArrow !== null) {
					this.reverseArrow.scale.set(scale);
				}
			}

			if (this.number) {
				let numberFadeOutCompletion = (currentTime - this.fadeOut.time) / HIT_CIRCLE_NUMBER_FADE_OUT_TIME;
				numberFadeOutCompletion = MathUtil.clamp(numberFadeOutCompletion, 0, 1);
				this.number.container.alpha = 1 - numberFadeOutCompletion;
			}

			this.renderFinished = (!this.approachCircle || this.approachCircle.visible === false) && (this.container.alpha === 0 || this.container.visible === false);
		}

		if (this.options.type === HitCirclePrimitiveType.HitCircle) { // Shaking only happens for normal hit circles, not slider heads!
			// Apply the shaking effect:
			let shakeCompletion = (currentTime - this.shakeStartTime) / SHAKE_DURATION;
			shakeCompletion = MathUtil.clamp(shakeCompletion, 0, 1);
			if (shakeCompletion < 1) {
				let deflectionFactor = Math.sin(currentTime/7.5) * (1 - shakeCompletion);
				let maximumDeflection = circleDiameter * 0.1;

				this.container.pivot.x = deflectionFactor * maximumDeflection;
				if (this.approachCircle) this.approachCircle.pivot.x = deflectionFactor * maximumDeflection / this.approachCircle.scale.x; // Dirty hack: Divide by the scale so that the pivot change is scale-independent
				if (this.reverseArrow) this.reverseArrow.pivot.x = deflectionFactor * maximumDeflection / this.reverseArrow.scale.x;
			} else {
				this.container.pivot.x = 0;
				if (this.approachCircle) this.approachCircle.pivot.x = 0;
				if (this.reverseArrow) this.reverseArrow.pivot.x = 0;
			}
		}   
	}

	getHiddenFadeOutCompletion(time: number) {
		let { approachTime } = this.options.hitObject.drawableBeatmap.play;

		let approachTimeThird = approachTime / 3;

		let fadeOutCompletion = (time - (this.options.fadeInStart + approachTimeThird)) / approachTimeThird; // Fade out in 1/3rd the approach time
		fadeOutCompletion = MathUtil.clamp(fadeOutCompletion, 0, 1);

		return fadeOutCompletion;
	}

	getFadeInCompletion(time: number, hasHidden: boolean) {
		let { approachTime } = this.options.hitObject.drawableBeatmap.play;

		if (hasHidden) {
			let approachTimeThird = approachTime / 3;

			let fadeInCompletion = (time - this.options.fadeInStart) / approachTimeThird; // Fade in in 1/3rd the approach time
			fadeInCompletion = MathUtil.clamp(fadeInCompletion, 0, 1);

			return fadeInCompletion;
		} else {
			let fadeInCompletion = (time - this.options.fadeInStart) / DEFAULT_HIT_OBJECT_FADE_IN_TIME;
			fadeInCompletion = MathUtil.clamp(fadeInCompletion, 0, 1);

			return fadeInCompletion;
		}
	}

	getReverseArrowScale(time: number) {
		let animationProgression = (time - this.options.fadeInStart) % REVERSE_ARROW_PULSE_DURATION;
		animationProgression = Math.max(0, animationProgression);

		let completion = animationProgression / REVERSE_ARROW_PULSE_DURATION;
		completion = MathUtil.ease(EaseType.EaseOutQuad, completion);

		let scale = 1 + (1 - completion) * 0.333;

		return scale;
	}

	setFadeOut(options: HitCirclePrimitiveFadeOutOptions) {
		this.fadeOut = options;
		this.fadeOutStartOpacity = 1; // It looks like opacity is set to 1 when fade-out starts.
	}

	isFadingOut() {
		return this.fadeOut !== null;
	}

	shake(time: number) {
		this.shakeStartTime = time;
	}

	static fadeOutBasedOnHitState(primitive: HitCirclePrimitive, time: number, hit: boolean) {
		if (hit) {
			primitive.setFadeOut({
				type: HitCirclePrimitiveFadeOutType.ScaleOut,
				time: time
			});
		} else {
			primitive.setFadeOut({
				type: HitCirclePrimitiveFadeOutType.FadeOut,
				time: time
			});
		}
	}
}