import { Slider } from "../../datamodel/slider";
import { MathUtil, EaseType } from "../../util/math_util";
import { pointDistance, Point } from "../../util/point";
import { SLIDER_TICK_APPEARANCE_ANIMATION_DURATION, HIT_OBJECT_FADE_OUT_TIME, SHOW_APPROACH_CIRCLE_ON_FIRST_HIDDEN_OBJECT, SLIDER_SETTINGS } from "../../util/constants";
import { colorToHexNumber } from "../../util/graphics_util";
import { assert, last } from "../../util/misc_util";
import { DrawableHeadedHitObject, SliderScoring, getDefaultSliderScoring } from "./drawable_headed_hit_object";
import { HitCirclePrimitive, HitCirclePrimitiveType } from "./hit_circle_primitive";
import { SoundEmitter } from "../../audio/sound_emitter";
import { renderer } from "../../visuals/rendering";
import { createSliderBodyShader, SLIDER_BODY_MESH_STATE, createSliderBodyTransformationMatrix, updateSliderBodyShaderUniforms } from "./slider_body_shader";
import { AnimatedOsuSprite } from "../skin/animated_sprite";
import { HitSoundInfo, generateHitSoundInfo, getTickHitSoundTypeFromSampleSet, getSliderSlideTypesFromSampleSet, calculatePanFromOsuCoordinates, determineSampleSet, determineVolume, determineSampleIndex } from "../skin/sound";
import { ProcessedSlider, SpecialSliderBehavior } from "../../datamodel/processed/processed_slider";
import { CurrentTimingPointInfo } from "../../datamodel/processed/processed_beatmap";
import { DrawableSliderPath, SliderBounds } from "./drawable_slider_path";
import { currentWindowDimensions } from "../../visuals/ui";
import { DrawableBeatmap } from "../drawable_beatmap";
import { ScoringValue } from "../../datamodel/score";
import { Mod } from "../../datamodel/mods";
import { PlayEvent, PlayEventType } from "../../datamodel/play_events";

export const FOLLOW_CIRCLE_HITBOX_CS_RATIO = 308/128; // Based on a comment on the osu website: "Max size: 308x308 (hitbox)"
const FOLLOW_CIRCLE_SCALE_IN_DURATION = 200;
const FOLLOW_CIRCLE_SCALE_OUT_DURATION = 200;
const FOLLOW_CIRCLE_PULSE_DURATION = 200;
const FOLLOW_CIRCLE_RELEASE_DURATION = 200;
const MAX_SLIDER_BALL_SLIDER_VELOCITY = 0.25; // In osu pixels per millisecond. This variable is used to cap the rotation speed on slider balls for very fast sliders.
const HIDDEN_TICK_FADE_OUT_DURATION = 400;

export class DrawableSlider extends DrawableHeadedHitObject {
	public parent: ProcessedSlider;
	public scoring: SliderScoring;

	public drawablePath: DrawableSliderPath;
	public bounds: SliderBounds;
	private baseSprite: PIXI.Sprite;
	public hasFullscreenBaseSprite: boolean = false; // If a slider is really big, like bigger-than-the-screen big, we change slider body rendering to happen in relation to the entire screen rather than a local slider texture. This way, we don't get WebGL errors from trying to draw to too big of a texture buffer, and it allows us to support slider distortions with some matrix magic.
	private sliderBodyMesh: PIXI.Mesh;
	private lastGeneratedSnakingCompletion: number;
	private forceSliderBodyRender: boolean = false;
	
	private container: PIXI.Container;
	private overlayContainer: PIXI.Container;
	private sliderBall: SliderBall;
	private tickContainer: PIXI.Container;
	private tickElements: (PIXI.Container | null)[];
	private followCircle: PIXI.Container;
	private followCircleAnimator: AnimatedOsuSprite;
	private followCircleHoldStartTime: number;
	private followCircleReleaseStartTime: number;
	private followCirclePulseStartTime: number;
	private reverseArrowContainer: PIXI.Container;
	public sliderEnds: HitCirclePrimitive[] = [];
	
	public hitSounds: HitSoundInfo[];
	public tickSounds: HitSoundInfo[];
	public slideEmitters: SoundEmitter[];
	private sliderSlideSoundPlaying = false;
	private currentlyHolding = false;

	constructor(drawableBeatmap: DrawableBeatmap, processedSlider: ProcessedSlider) {
		super(drawableBeatmap, processedSlider);

		this.drawablePath = DrawableSliderPath.fromSliderPath(processedSlider.path, this);
		this.bounds = this.drawablePath.calculateBounds();
		this.scoring = getDefaultSliderScoring();

		this.initSounds(processedSlider.hitObject, processedSlider.timingInfo);
	}

	protected initSounds(slider: Slider, timingInfo: CurrentTimingPointInfo) {
		let currentTimingPoint = timingInfo.timingPoint;

		// Init hit sounds for slider head, repeats and end
		let hitSounds: HitSoundInfo[] = [];
		for (let i = 0; i < slider.edgeHitSounds.length; i++) {
			let time = slider.time + this.parent.length/this.parent.velocity * i;
			let timingPoint = this.parent.processedBeatmap.beatmap.getClosestTimingPointTo(time, currentTimingPoint.index);
			let hitSound = slider.edgeHitSounds[i];
			let sampling = slider.edgeSamplings[i];
			let position = (i % 2 === 0)? this.parent.startPoint : this.parent.tailPoint;

			let info = generateHitSoundInfo(hitSound, sampling.sampleSet, sampling.additionSet, null, null, timingPoint, position);
			hitSounds.push(info);
		}
		this.hitSounds = hitSounds;

		// TODO: Different tick sounds based on the timing point at that time.
		// Tick sound
		let tickSounds: HitSoundInfo[] = [];
		for (let i = 0; i < this.parent.tickCompletions.length; i++) {
			let completion = this.parent.tickCompletions[i];
			let time = slider.time + this.parent.length/this.parent.velocity * completion;
			let timingPoint = this.parent.processedBeatmap.beatmap.getClosestTimingPointTo(time, currentTimingPoint.index);
			let position = this.drawablePath.getPosFromPercentage(MathUtil.mirror(completion));

			let info: HitSoundInfo = {
				base: getTickHitSoundTypeFromSampleSet(determineSampleSet(slider.extras.sampleSet, timingPoint)),
				volume: determineVolume(slider.extras.sampleVolume,timingPoint),
				sampleIndex: determineSampleIndex(slider.extras.customIndex, timingPoint),
				position: position
			};
			tickSounds.push(info);
		}
		this.tickSounds = tickSounds;
	}

	reset() {
		super.reset();

		this.forceSliderBodyRender = false;
		this.lastGeneratedSnakingCompletion = this.getSliderBodyDefaultSnake();
		this.followCircleHoldStartTime = null;
		this.followCircleReleaseStartTime = null;
		this.followCirclePulseStartTime = -Infinity;

		if (this.sliderEnds) {
			for (let i = 0; i < this.sliderEnds.length; i++) {
				this.sliderEnds[i].reset();
			}
		}

		this.scoring = getDefaultSliderScoring();
		this.setHoldingState(false, 0);
	}

	draw() {
		if (this.parent.specialBehavior === SpecialSliderBehavior.Invisible) return;

		let { approachTime, circleRadiusOsuPx, activeMods } = this.drawableBeatmap.play;

		let hasHidden = activeMods.has(Mod.Hidden);

		this.renderStartTime = this.parent.startTime - approachTime;
	
		this.head = new HitCirclePrimitive({
			fadeInStart: this.parent.startTime - approachTime,
			hitObject: this,
			hasApproachCircle: !hasHidden || (this.parent.index === 0 && SHOW_APPROACH_CIRCLE_ON_FIRST_HIDDEN_OBJECT),
			hasNumber: true,
			type: HitCirclePrimitiveType.SliderHead
		});
		this.head.container.zIndex = -this.parent.startTime;

		this.reverseArrowContainer = new PIXI.Container();

		this.drawablePath.generatePointData();

		this.sliderEnds = [];
		let msPerRepeatCycle = this.parent.length / this.parent.velocity;
		for (let i = 0; i < this.parent.repeat; i++) {
			
			let fadeInStart: number;
			if (i === 0) {
				fadeInStart = this.parent.startTime - approachTime;

				if (SLIDER_SETTINGS.snaking) {
					fadeInStart += approachTime/3; // Snaking takes one third of approach time.
				}
			} else {
				fadeInStart = this.parent.startTime + (i-1) * msPerRepeatCycle;
			}

			let reverseArrowAngle: number;
			if (i < this.parent.repeat-1) {
				if (i % 2 === 0) {
					let angle = this.drawablePath.getAngleFromPercentage(1);
					// This odd condition is to prevent rotation for reverse arrows for edge-case sliders, like zero-length or zero-section sliders, which are found in Aspire maps, for example. Those sliders only have a one-point path, and something naive in ppy's code makes that cause all reverse arrows to face the same direction. I think he's just atan2-ing two very close points on the path, instead of what's being done here. Welp. Fake it!
					if (this.drawablePath.points.length > 1) angle = MathUtil.constrainRadians(angle + Math.PI); // Turn it by 180°

					reverseArrowAngle = angle;
				} else {
					reverseArrowAngle = this.drawablePath.getAngleFromPercentage(0);
				}
			}

			let primitive = new HitCirclePrimitive({
				fadeInStart: fadeInStart,
				hitObject: this,
				hasApproachCircle: false,
				hasNumber: false,
				reverseArrowAngle: reverseArrowAngle,
				type: HitCirclePrimitiveType.SliderEnd,
				baseElementsHidden: hasHidden && i > 0
			});

			primitive.container.zIndex = -Math.min(fadeInStart + approachTime, this.parent.endTime); // Math.min is necessary, because without it, for some sliders, the end circle would end up BELOW the slider body. No good!

			this.sliderEnds.push(primitive);
			if (primitive.reverseArrow !== null) this.reverseArrowContainer.addChildAt(primitive.reverseArrow, 0);
		}

		this.baseSprite = new PIXI.Sprite();
		//this.baseSprite.filters = [new PIXI.filters.FXAAFilter()]; // Enable this for FXAA. Makes slider edges look kinda janky, that's why it's disabled.
		this.baseSprite.zIndex = -this.parent.endTime;

		this.drawablePath.generateBaseVertexBuffer();
		let sliderBodyDefaultSnake = this.getSliderBodyDefaultSnake();
		let sliderBodyGeometry = this.drawablePath.generateGeometry(sliderBodyDefaultSnake);
		this.lastGeneratedSnakingCompletion = sliderBodyDefaultSnake;
		let sliderBodyShader = createSliderBodyShader();
		let sliderBodyMesh = new PIXI.Mesh(sliderBodyGeometry, sliderBodyShader, SLIDER_BODY_MESH_STATE);
		sliderBodyMesh.size = this.drawablePath.currentVertexCount;
		this.sliderBodyMesh = sliderBodyMesh;

		this.sliderBall = new SliderBall(this);

		let followCircleAnimator = new AnimatedOsuSprite();
		followCircleAnimator.play(this.parent.startTime);

		let followCircleWrapper = new PIXI.Container();
		followCircleWrapper.addChild(followCircleAnimator.sprite);

		this.followCircle = followCircleWrapper;
		this.followCircleAnimator = followCircleAnimator;
		this.followCircle.visible = false;

		this.tickContainer = new PIXI.Container();
		this.tickElements = [];

		for (let i = 0; i < this.parent.tickCompletions.length; i++) {
			let completion = this.parent.tickCompletions[i];
			if (completion >= 1) break;

			let sliderTickPos = this.drawablePath.getPosFromPercentage(MathUtil.mirror(completion));

			// Check if the tick overlaps with either slider end
			if (pointDistance(sliderTickPos, this.parent.startPoint) <= circleRadiusOsuPx || pointDistance(sliderTickPos, this.parent.tailPoint) <= circleRadiusOsuPx) {
				// If it does, hide it.
				this.tickElements.push(null);
				continue;
			}

			let tickSprite = new PIXI.Sprite();
			tickSprite.anchor.set(0.5, 0.5);
			let tickWrapper = new PIXI.Container();
			tickWrapper.addChild(tickSprite);

			this.tickContainer.addChild(tickWrapper);
			this.tickElements.push(tickWrapper);
		}

		this.overlayContainer = new PIXI.Container();
		if (this.parent.tickCompletions.length > 0) this.overlayContainer.addChild(this.tickContainer);
		this.overlayContainer.addChild(this.sliderBall.container);
		this.overlayContainer.addChild(this.followCircle);

		this.container = new PIXI.Container();
		this.container.addChild(this.reverseArrowContainer);
		this.container.addChild(this.overlayContainer);

		this.container.zIndex = -this.parent.startTime;
	}

	compose(updateSkin: boolean) {
		super.compose(updateSkin);
		let { skin, headedHitObjectTextureFactor, hitObjectPixelRatio } = this.drawableBeatmap.play;

		this.bounds.updateScreenDimensions(hitObjectPixelRatio);
		this.hasFullscreenBaseSprite = Math.max(this.bounds.screenWidth, this.bounds.screenHeight) >= Math.max(currentWindowDimensions.width, currentWindowDimensions.height);

		let renderTex = PIXI.RenderTexture.create({
			width: this.hasFullscreenBaseSprite? currentWindowDimensions.width : this.bounds.screenWidth,
			height: this.hasFullscreenBaseSprite? currentWindowDimensions.height : this.bounds.screenHeight,
			resolution: 2 // For anti-aliasing
		});
		let renderTexFramebuffer = (renderTex.baseTexture as any).framebuffer as PIXI.Framebuffer;
		renderTexFramebuffer.enableDepth();
		renderTexFramebuffer.addDepthTexture();

		this.baseSprite.texture.destroy();
		this.baseSprite.texture = renderTex;
		
		this.updateTransformationMatrix();
		if (updateSkin) updateSliderBodyShaderUniforms(this.sliderBodyMesh.shader, this);
		this.forceSliderBodyRender = true;

		for (let i = 0; i < this.sliderEnds.length; i++) {
			this.sliderEnds[i].compose();
		}

		this.sliderBall.compose();

		let followCircleOsuTexture = skin.textures["followCircle"];
		this.followCircleAnimator.setFps(skin.config.general.animationFramerate);
		this.followCircleAnimator.setTexture(followCircleOsuTexture, headedHitObjectTextureFactor);

		let tickOsuTexture = skin.textures["sliderTick"];
		for (let i = 0; i < this.tickElements.length; i++) {
			let tick = this.tickElements[i];
			if (!tick) continue;

			let sprite = tick.children[0] as PIXI.Sprite;
			tickOsuTexture.applyToSprite(sprite, headedHitObjectTextureFactor);
		}

		if (updateSkin) {
			if (this.currentlyHolding) this.stopSliderSlideSound();

			let currentTimingPoint = this.parent.timingInfo.timingPoint;
			let slider = this.parent.hitObject;
	
			let sampleSet = determineSampleSet(slider.extras.sampleSet, currentTimingPoint),
				volume = determineVolume(slider.extras.sampleVolume, currentTimingPoint),
				sampleIndex = determineSampleIndex(slider.extras.customIndex, currentTimingPoint);
	
			// Slider slide sound
			let sliderSlideTypes = getSliderSlideTypesFromSampleSet(sampleSet, slider.hitSound);
			let sliderSlideEmitters: SoundEmitter[] = [];
			let sliderSlideStartPan = calculatePanFromOsuCoordinates(this.parent.startPoint);
			for (let i = 0; i < sliderSlideTypes.length; i++) {
				let type = sliderSlideTypes[i];
				let emitter = this.drawableBeatmap.play.skin.sounds[type].getEmitter(volume, sampleIndex, sliderSlideStartPan);
				if (!emitter || emitter.isReallyShort()) continue;
	
				emitter.setLoopState(true);
				sliderSlideEmitters.push(emitter);
			}
			this.slideEmitters = sliderSlideEmitters;

			if (this.currentlyHolding) this.beginSliderSlideSound();
		}
	}
	
	show() {
		if (this.parent.specialBehavior === SpecialSliderBehavior.Invisible) return;
		let controller = this.drawableBeatmap.play.controller;

		controller.hitObjectContainer.addChild(this.baseSprite);
		controller.hitObjectContainer.addChild(this.container);
		for (let i = 0; i < this.sliderEnds.length; i++) {
			controller.hitObjectContainer.addChild(this.sliderEnds[i].container);
		}

		super.show();
	}

	position() {
		if (this.parent.specialBehavior === SpecialSliderBehavior.Invisible) return;

		super.position(); // Haha, superposition. Yes. This joke is funny and not funny at the same time. Until observed, of course.

		let { circleRadiusOsuPx } = this.drawableBeatmap.play;

		let screenX = this.drawableBeatmap.play.toScreenCoordinatesX(this.bounds.min.x - circleRadiusOsuPx);
		let screenY = this.drawableBeatmap.play.toScreenCoordinatesY(this.bounds.min.y - circleRadiusOsuPx);

		if (this.hasFullscreenBaseSprite) this.baseSprite.position.set(0, 0);
		else this.baseSprite.position.set(screenX, screenY);

		let screenStartPos = this.drawableBeatmap.play.toScreenCoordinates(this.parent.startPoint);
		let screenTailPos = this.drawableBeatmap.play.toScreenCoordinates(this.parent.tailPoint);
		for (let i = 0; i < this.sliderEnds.length; i++) {
			let primitive = this.sliderEnds[i];
			let pos = (i % 2 === 0)? screenTailPos : screenStartPos;

			primitive.container.position.set(pos.x, pos.y);
			if (primitive.reverseArrow !== null) primitive.reverseArrow.position.copyFrom(primitive.container.position);
		}

		for (let i = 0; i < this.tickElements.length; i++) {
			let tick = this.tickElements[i];
			if (!tick) continue;

			let completion = this.parent.tickCompletions[i];
			let sliderTickPos = this.drawablePath.getPosFromPercentage(MathUtil.mirror(completion));
			let screenPos = this.drawableBeatmap.play.toScreenCoordinates(sliderTickPos);
			tick.position.set(screenPos.x, screenPos.y);
		}
	}

	update(currentTime: number) {
		let { approachTime, activeMods } = this.drawableBeatmap.play;

		if (currentTime > this.parent.endTime + HIT_OBJECT_FADE_OUT_TIME) {
			this.renderFinished = true;
			return;
		}

		if (this.parent.specialBehavior === SpecialSliderBehavior.Invisible) return;

		super.update(currentTime);

		this.updateHeadElements(currentTime);
		
		let hasHidden = activeMods.has(Mod.Hidden);
		let fadeInCompletion = this.head.getFadeInCompletion(currentTime, hasHidden);
		let fadeOutCompletion = (currentTime - (this.parent.endTime)) / HIT_OBJECT_FADE_OUT_TIME;
		fadeOutCompletion = MathUtil.clamp(fadeOutCompletion, 0, 1);
		fadeOutCompletion = MathUtil.ease(EaseType.EaseOutQuad, fadeOutCompletion);

		if (hasHidden) {
			let bodyFadeOutCompletion = (currentTime - (this.parent.startTime - 2/3 * approachTime)) / (this.parent.duration + 2/3 * approachTime); // Slider body fades from from the millisecond the fade in is complete to the end of the slider
			bodyFadeOutCompletion = MathUtil.clamp(bodyFadeOutCompletion, 0, 1);
			bodyFadeOutCompletion = MathUtil.ease(EaseType.EaseOutQuad, bodyFadeOutCompletion);

			this.baseSprite.alpha = fadeInCompletion * (1 - bodyFadeOutCompletion);
		} else {
			if (currentTime < this.parent.endTime) this.baseSprite.alpha = fadeInCompletion;
			else this.baseSprite.alpha = 1 - fadeOutCompletion;
		}

		if (currentTime < this.parent.endTime) this.overlayContainer.alpha = fadeInCompletion;
		else this.overlayContainer.alpha = 1 - fadeOutCompletion;

		this.updateSliderBody(currentTime);
		this.updateSubelements(currentTime);
	}

	remove() {
		if (this.parent.specialBehavior === SpecialSliderBehavior.Invisible) return;
		let controller = this.drawableBeatmap.play.controller;

		super.remove();

		controller.hitObjectContainer.removeChild(this.baseSprite);
		controller.hitObjectContainer.removeChild(this.container);
		for (let i = 0; i < this.sliderEnds.length; i++) {
			controller.hitObjectContainer.removeChild(this.sliderEnds[i].container);
		}

		// TODO: Clean all this stuff when exiting a play
		/*

		// CLEAN UP THAT DARN VRAM! GIMME VRAM!
		this.baseSprite.texture.destroy(true);
		this.sliderBodyMesh.geometry.dispose();
		this.sliderBodyMesh.destroy();

		*/
	}

	private beginSliderSlideSound() {
		if (this.sliderSlideSoundPlaying) return;
		if (!this.slideEmitters) return;
		if (this.parent.specialBehavior === SpecialSliderBehavior.Invisible) return;

		for (let i = 0; i < this.slideEmitters.length; i++) {
			this.slideEmitters[i].start();
		}

		this.sliderSlideSoundPlaying = true;
	}

	private stopSliderSlideSound() {
		if (!this.sliderSlideSoundPlaying) return;
		if (!this.slideEmitters) return;

		for (let i = 0; i < this.slideEmitters.length; i++) {
			this.slideEmitters[i].stop();
		}

		this.sliderSlideSoundPlaying = false;
	}

	setHoldingState(holding: boolean, time: number) {
		if (holding === this.currentlyHolding) return;
		if (holding && (time < this.parent.startTime || time >= this.parent.endTime)) return;

		if (holding) {
			this.holdFollowCircle(time);
			this.beginSliderSlideSound();
		} else {
			this.stopSliderSlideSound();
		}

		this.currentlyHolding = holding;
	}

	holdFollowCircle(time: number) {
		this.followCircleHoldStartTime = Math.max(this.parent.startTime, time);
		this.followCircleReleaseStartTime = null;
		this.followCirclePulseStartTime = null;
	}
	
	releaseFollowCircle(time: number) {
		if (this.followCircleReleaseStartTime !== null || time >= this.parent.endTime) return;

		this.followCircleHoldStartTime = null;
		this.followCircleReleaseStartTime = time;
	}

	pulseFollowCircle(time: number) {
		if (time >= this.parent.endTime) return;

		this.followCirclePulseStartTime = time;
	}

	score(time: number) {
		let resultingRawScore = 0;

		if (this.parent.specialBehavior === SpecialSliderBehavior.Invisible) {
			if (this.scoring.head.hit) resultingRawScore = ScoringValue.Hit300;
		} else {
			let total = 0;
			if (this.scoring.head.hit !== ScoringValue.Miss) total++;
			if (this.scoring.end) total++;
			total += this.scoring.ticks;
			total += this.scoring.repeats;
	
			let fraction = total / (2 + this.parent.tickCompletions.length + (this.parent.repeat - 1));
			assert(fraction >= 0 && fraction <= 1);
	
			resultingRawScore = (() => {
				if (fraction === 1) {
					return ScoringValue.Hit300;
				} else if (fraction >= 0.5) {
					return ScoringValue.Hit100;
				} else if (fraction > 0) {
					return ScoringValue.Hit50;
				}
				return ScoringValue.Miss;
			})();
		}

		if (this.scoring.end || resultingRawScore === ScoringValue.Hit300) this.drawableBeatmap.play.playHitSound(last(this.hitSounds)); // Play the slider end hitsound. 

		this.drawableBeatmap.play.scoreCounter.add(resultingRawScore, false, false, true, this, time);
	}

	hitHead(time: number, judgementOverride?: number) {
		if (this.scoring.head.hit !== ScoringValue.NotHit) return;
		
		let { scoreCounter } = this.drawableBeatmap.play;

		let timeInaccuracy = time - this.parent.startTime;
		let judgement: number;

		if (judgementOverride !== undefined) {
			judgement = judgementOverride;
		} else {
			let hitDelta = Math.abs(timeInaccuracy);
			judgement = this.parent.processedBeatmap.difficulty.getJudgementForHitDelta(hitDelta);
		}

		this.scoring.head.hit = judgement;
		this.scoring.head.time = time;

		let score = (judgement === ScoringValue.Miss)? ScoringValue.Miss : ScoringValue.SliderHead;

		scoreCounter.add(score, true, true, false, this, time, this.parent.startPoint);

		if (judgement !== 0) {
			const hud = this.drawableBeatmap.play.controller.hud;

			this.drawableBeatmap.play.playHitSound(this.hitSounds[0]);
			hud.accuracyMeter.addAccuracyLine(timeInaccuracy, time);
			scoreCounter.addHitInaccuracy(timeInaccuracy);
			this.holdFollowCircle(time);
		}
		// The if here is because not all sliders have heads, like edge-case invisible sliders.
		if (this.head) HitCirclePrimitive.fadeOutBasedOnHitState(this.head, time, judgement !== 0);
	}

	private getLowestTickCompletionFromCurrentRepeat(completion: number) {
		let currentRepeat = Math.floor(completion);
		for (let i = 0; i < this.parent.tickCompletions.length; i++) {
			if (this.parent.tickCompletions[i] > currentRepeat) {
				return this.parent.tickCompletions[i];
			}
		}
	}

	private updateSliderBody(currentTime: number) {
		let { approachTime } = this.drawableBeatmap.play;

		let snakeCompletion: number;
		if (SLIDER_SETTINGS.snaking) {
			snakeCompletion = (currentTime - (this.parent.startTime - approachTime)) / (approachTime/3); // Snaking takes 1/3 the approach time
			snakeCompletion = MathUtil.clamp(snakeCompletion, 0, 1);
		} else {
			snakeCompletion = 1.0;
		}

		let doRender = this.forceSliderBodyRender;
		let renderTex = this.baseSprite.texture as PIXI.RenderTexture;
		let gl = renderer.state.gl;

		if (this.lastGeneratedSnakingCompletion < snakeCompletion) {
			let newBounds = this.drawablePath.updateGeometry(this.sliderBodyMesh.geometry, snakeCompletion, this.hasFullscreenBaseSprite);
			this.sliderBodyMesh.size = this.drawablePath.currentVertexCount;

			if (this.hasFullscreenBaseSprite) this.updateTransformationMatrix(newBounds);

			doRender = true;
			this.lastGeneratedSnakingCompletion = snakeCompletion;
		}

		if (!doRender) return;

		// Blending here needs to be done manually 'cause, well, reasons. lmao
		// INSANE hack:
		gl.disable(gl.BLEND);
		renderer.render(this.sliderBodyMesh, renderTex);
		gl.enable(gl.BLEND);

		this.forceSliderBodyRender = false;
	}
	
	private updateTransformationMatrix(boundsOverride?: SliderBounds) {
		let transformationMatrix = createSliderBodyTransformationMatrix(this, boundsOverride || this.bounds);
		this.sliderBodyMesh.shader.uniforms.matrix = transformationMatrix; // Update the matrix uniform
	}

	calculateCompletionAtTime(time: number) {
		let sliderTime = time - this.parent.hitObject.time;
		let completion = (this.parent.velocity * sliderTime) / this.parent.length;
		completion = MathUtil.clamp(completion, 0, this.parent.repeat);

		return completion;
	}

	private updateSubelements(currentTime: number) {
		let completion = this.calculateCompletionAtTime(currentTime);
		let currentSliderTime = currentTime - this.parent.hitObject.time;
		let sliderBallPos = this.drawableBeatmap.play.toScreenCoordinates(this.drawablePath.getPosFromPercentage(MathUtil.mirror(completion)), false);

		this.updateSliderEnds(currentTime);
		this.updateSliderBall(completion, currentTime, sliderBallPos);
		this.updateFollowCircle(currentTime, sliderBallPos);
		if (this.parent.tickCompletions.length > 0) this.updateSliderTicks(completion, currentSliderTime);
	}

	private updateSliderEnds(currentTime: number) {
		for (let i = 0; i < this.sliderEnds.length; i++) {
			let sliderEnd = this.sliderEnds[i];
			sliderEnd.update(currentTime);
		}
	}

	private updateSliderBall(completion: number, currentTime: number, sliderBallPos: Point) {
		if (currentTime < this.parent.endTime) {
			this.sliderBall.update(completion, currentTime, sliderBallPos);
		} else {
			// The slider ball disappears upon slider completion
			this.sliderBall.container.visible = false;
		}
	}

	private updateFollowCircle(currentTime: number, sliderBallPos: Point) {
		this.followCircle.visible = true;
		this.followCircle.position.set(sliderBallPos.x, sliderBallPos.y);

		let followCircleSizeFactor = 0.0;
		let followCircleAlpha = 1.0;

		if (this.followCircleReleaseStartTime !== null) {
			let releaseCompletion = (currentTime - this.followCircleReleaseStartTime) / FOLLOW_CIRCLE_RELEASE_DURATION;
			releaseCompletion = MathUtil.clamp(releaseCompletion, 0, 1);

			// This condition is false when the slider was released right when it began, aka wasn't held when it began. In that case, the follow circle stays hidden :thinking:
			if (this.followCircleReleaseStartTime > this.parent.startTime) {
				followCircleSizeFactor = MathUtil.lerp(1, 2, releaseCompletion);
			}
			followCircleAlpha = 1 - releaseCompletion;
		} else if (this.followCircleHoldStartTime !== null) {
			let enlargeCompletion = (currentTime - this.followCircleHoldStartTime) / FOLLOW_CIRCLE_SCALE_IN_DURATION;
			enlargeCompletion = MathUtil.clamp(enlargeCompletion, 0, 1);
			enlargeCompletion = MathUtil.ease(EaseType.EaseOutQuad, enlargeCompletion);

			followCircleSizeFactor += MathUtil.lerp(0.5, 1.0, enlargeCompletion);
			followCircleAlpha = enlargeCompletion;

			if (this.followCirclePulseStartTime !== null) {
				let pulseFactor = (currentTime - this.followCirclePulseStartTime) / FOLLOW_CIRCLE_PULSE_DURATION;
				pulseFactor = MathUtil.clamp(pulseFactor, 0, 1);
				pulseFactor = 1 - MathUtil.ease(EaseType.EaseOutQuad, pulseFactor);
				pulseFactor *= 0.10;

				followCircleSizeFactor += pulseFactor;
			}

			let shrinkCompletion = (currentTime - this.parent.endTime) / FOLLOW_CIRCLE_SCALE_OUT_DURATION;
			shrinkCompletion = MathUtil.clamp(shrinkCompletion, 0, 1);
			shrinkCompletion = MathUtil.ease(EaseType.EaseOutQuad, shrinkCompletion);

			followCircleSizeFactor *= MathUtil.lerp(1, 0.75, shrinkCompletion); // Shrink on end, to 0.75x
		}

		this.followCircle.scale.set(followCircleSizeFactor);
		this.followCircle.alpha = followCircleAlpha;
		this.followCircleAnimator.update(currentTime);
	}

	private updateSliderTicks(completion: number, currentSliderTime: number) {
		let { approachTime, activeMods } = this.drawableBeatmap.play;

		let lowestTickCompletionFromCurrentRepeat = this.getLowestTickCompletionFromCurrentRepeat(completion);
		let currentCycle = Math.floor(completion);
		let hasHidden = activeMods.has(Mod.Hidden);

		for (let i = 0; i < this.tickElements.length; i++) {
			let tickElement = this.tickElements[i];
			if (tickElement === null) continue; // Meaning: The tick is hidden

			let tickCompletionIndex = this.tickElements.length * currentCycle;
			if (currentCycle % 2 === 0) {
				tickCompletionIndex += i;
			} else {
				tickCompletionIndex += this.tickElements.length - 1 - i;
			}
			let tickCompletion = this.parent.tickCompletions[tickCompletionIndex];
			if (tickCompletion === undefined) continue;

			if (tickCompletion <= completion) {
				tickElement.visible = false;
				continue;
			} else {
				tickElement.visible = true;
			}
			
			// The currentSliderTime at the beginning of the current repeat cycle
			let msPerRepeatCycle = this.parent.duration / this.parent.repeat;
			let currentRepeatTime = currentCycle * msPerRepeatCycle;
			// The time the tick should have fully appeared (animation complete), relative to the current repeat cycle
			// Slider velocity here is doubled, meaning the ticks appear twice as fast as the slider ball moves.
			let relativeTickTime = ((tickCompletion - lowestTickCompletionFromCurrentRepeat) * this.parent.length / (this.parent.velocity * 2)) + SLIDER_TICK_APPEARANCE_ANIMATION_DURATION;
			// Sum both up to get the timing of the tick relative to the beginning of the whole slider:
			let tickTime = currentRepeatTime + relativeTickTime;
			
			// If we're in the first cycle, slider ticks appear a certain duration earlier. Experiments have lead to the value being subtracted here:
			if (currentCycle === 0) {
				tickTime -= approachTime * 2/3 - 100;
			}

			let animationStart = tickTime - SLIDER_TICK_APPEARANCE_ANIMATION_DURATION;
			let animationCompletion = (currentSliderTime - animationStart) / SLIDER_TICK_APPEARANCE_ANIMATION_DURATION;
			animationCompletion = MathUtil.clamp(animationCompletion, 0, 1);

			// Creates a bouncing scaling effect.
			let parabola = (-1.875 * animationCompletion*animationCompletion + 2.875 * animationCompletion);

			if (animationCompletion === 0) parabola = 0;
			if (animationCompletion >= 1) parabola = 1;

			tickElement.scale.set(parabola);

			// With HD, ticks start fading out shortly before they're supposed to be picked up. By the time they are picked up, they will have reached opacity 0.
			if (hasHidden) {
				let tickPickUpTime = tickCompletion * this.parent.length / this.parent.velocity;
				let fadeOutCompletion = (currentSliderTime - (tickPickUpTime - HIDDEN_TICK_FADE_OUT_DURATION)) / HIDDEN_TICK_FADE_OUT_DURATION;
				fadeOutCompletion = MathUtil.clamp(fadeOutCompletion, 0, 1);

				tickElement.alpha = 1 - fadeOutCompletion;
			}
		}
	}

	private getSliderBodyDefaultSnake() {
		return SLIDER_SETTINGS.snaking? 0.0 : 1.0;
	}

	handlePlayEvent(event: PlayEvent, osuMouseCoordinates: Point, buttonPressed: boolean, currentTime: number) {
		super.handlePlayEvent(event, osuMouseCoordinates, buttonPressed, currentTime);

		let play = this.drawableBeatmap.play;
		let distance = event.position && pointDistance(osuMouseCoordinates, event.position);
		let followCircleHit = (buttonPressed && distance <= play.circleRadiusOsuPx * FOLLOW_CIRCLE_HITBOX_CS_RATIO) || play.autohit;

		switch (event.type) {
			case PlayEventType.PerfectHeadHit: {
				if (!followCircleHit) {
					this.releaseFollowCircle(event.time);
				}
			}; break;
			case PlayEventType.SliderEndCheck: { // Checking if the player hit the slider end happens slightly before the end of the slider
				if (followCircleHit) {
					this.scoring.end = true;
				} else {
					this.scoring.end = false;
					this.releaseFollowCircle(event.time);
				}

				if (this.scoring.head.hit === ScoringValue.NotHit) {
					// If the slider ended before the player managed to click its head, the head is automatically "missed".
					this.hitHead(event.time, 0);
				}
			}; break;
			case PlayEventType.SliderEnd: {
				this.setHoldingState(false, event.time);

				// If the slider end was hit, score it now.
				let endHit = this.scoring.end === true;
				if (endHit) {
					play.scoreCounter.add(ScoringValue.SliderEnd, true, true, false, this, event.time, event.position, true);
					
					// The hit sound is played in the .score method. (at least when this comment was written)
				}

				let primitive = last(this.sliderEnds);
				// The if here ie because there is not always a slider end primitive (like for invisible sliders)
				if (primitive) HitCirclePrimitive.fadeOutBasedOnHitState(primitive, event.time, endHit);

				// Score the slider, no matter if the end was hit or not (obviously) 
				this.score(event.time);
			}; break;
			case PlayEventType.SliderRepeat: {
				let hit: boolean = null;
				if (this.scoring.end !== null) {
					// If the slider end has already been checked, 'hit' takes on the success state of the slider end scoring.
					hit = this.scoring.end;
				} else {
					hit = followCircleHit;
				}

				if (hit) {
					this.scoring.repeats++;
					play.scoreCounter.add(ScoringValue.SliderRepeat, true, true, false, this, event.time, event.position);
					this.pulseFollowCircle(event.time);
					
					let hitSound = this.hitSounds[event.index + 1];
					play.playHitSound(hitSound);
				} else {
					play.scoreCounter.add(ScoringValue.Miss, true, true, true, this, event.time);
					this.releaseFollowCircle(event.time);
				}

				let primitive = this.sliderEnds[event.index];
				HitCirclePrimitive.fadeOutBasedOnHitState(primitive, event.time, hit);
			}; break;
			case PlayEventType.SliderTick: {
				let hit: boolean = null;
				if (this.scoring.end !== null) {
					// If the slider end has already been checked, 'hit' takes on the success state of the slider end scoring.
					hit = this.scoring.end;
				} else {
					hit = followCircleHit;
				}

				if (hit) {
					this.scoring.ticks++;
					play.scoreCounter.add(ScoringValue.SliderTick, true, true, false, this, event.time, event.position);
					this.pulseFollowCircle(event.time);

					let hitSound = this.tickSounds[event.index];
					play.playHitSound(hitSound);
				} else {
					play.scoreCounter.add(ScoringValue.Miss, true, true, true, this, event.time);
					this.releaseFollowCircle(event.time);
				}
			}; break;
			// Sustained event:
			case PlayEventType.SliderSlide: {
				let currentPosition = this.drawablePath.getPosFromPercentage(MathUtil.mirror(this.calculateCompletionAtTime(currentTime)));
				let pan = calculatePanFromOsuCoordinates(currentPosition);

				// Update the pan on the slider slide emitters
				for (let i = 0; i < this.slideEmitters.length; i++) {
					let emitter = this.slideEmitters[i];
					emitter.setPan(pan);
				}

				this.setHoldingState(followCircleHit, currentTime);
			}; break;
		}
	}
}

class SliderBall {
	private slider: DrawableSlider = null;
	public container: PIXI.Container = null;
	public base: AnimatedOsuSprite = null;
	public background: PIXI.Container = null;
	public spec: PIXI.Container = null;

	constructor(slider: DrawableSlider) {
		this.slider = slider;

		this.container = new PIXI.Container();
		this.base = new AnimatedOsuSprite();
	}

	compose() {
		let { headedHitObjectTextureFactor, skin } = this.slider.drawableBeatmap.play;

		let osuTexture = skin.textures["sliderBall"];
		this.base.setTexture(osuTexture, headedHitObjectTextureFactor);

		if (skin.config.general.allowSliderBallTint) this.base.sprite.tint = colorToHexNumber(this.slider.color);
		else this.base.sprite.tint = colorToHexNumber(skin.config.colors.sliderBall);

		this.background = null;
		if (!osuTexture.hasActualBase() && skin.allowSliderBallExtras) {
			let bgTexture = skin.textures["sliderBallBg"];

			if (!bgTexture.isEmpty()) {
				let sprite = new PIXI.Sprite();
				sprite.anchor.set(0.5, 0.5);
				sprite.tint = 0x000000; // Always tinted black.

				bgTexture.applyToSprite(sprite, headedHitObjectTextureFactor);

				this.background = sprite;
			}
		}

		this.spec = null;
		let specTexture = skin.textures["sliderBallSpec"];
		if (!specTexture.isEmpty() && skin.allowSliderBallExtras) {
			let sprite = new PIXI.Sprite();
			sprite.anchor.set(0.5, 0.5);
			sprite.blendMode = PIXI.BLEND_MODES.ADD;

			specTexture.applyToSprite(sprite, headedHitObjectTextureFactor);

			this.spec = sprite;
		}

		this.container.removeChildren();
		
		if (this.background) this.container.addChild(this.background);
		this.container.addChild(this.base.sprite);
		if (this.spec) this.container.addChild(this.spec);
	}

	update(completion: number, currentTime: number, sliderBallPos: Point) {
		let baseElement = this.base.sprite;
		let skin = this.slider.drawableBeatmap.play.skin;

		this.container.visible = currentTime >= this.slider.parent.startTime;
		this.container.position.set(sliderBallPos.x, sliderBallPos.y);
		baseElement.rotation = this.slider.drawablePath.getAngleFromPercentage(MathUtil.mirror(completion));

		let osuTex = skin.textures["sliderBall"];
		let frameCount = osuTex.getAnimationFrameCount();
		if (frameCount > 1) {
			let velocityRatio = Math.min(1, MAX_SLIDER_BALL_SLIDER_VELOCITY/this.slider.parent.velocity);
			let rolledDistance = this.slider.parent.length * velocityRatio * MathUtil.mirror(completion);
			let radians = rolledDistance / 15;
			let currentFrame = Math.floor(frameCount * (radians % (Math.PI/2) / (Math.PI/2))); // TODO: Is this correct for all skins?

			this.base.setFrame(currentFrame);
		}

		if (skin.config.general.sliderBallFlip) {
			// Flip the scale when necessary
			if      (completion % 2 <= 1 && baseElement.scale.x < 0) baseElement.scale.x *= -1;
			else if (completion % 2 > 1  && baseElement.scale.x > 0) baseElement.scale.x *= -1;
		}
	}
}