import { DrawableHitObject } from "./drawable_hit_object";
import { Spinner } from "../../datamodel/hit_objects/spinner";
import { MathUtil, EaseType, TAU } from "../../util/math_util";
import { Point } from "../../util/point";
import { PLAYFIELD_DIMENSIONS, DEFAULT_HIT_OBJECT_FADE_IN_TIME } from "../../util/constants";
import { colorToHexNumber, lerpColors, Color, Colors } from "../../util/graphics_util";
import { SpriteNumber } from "../../visuals/sprite_number";
import { ProcessedSpinner } from "../../datamodel/processed/processed_spinner";
import { CurrentTimingPointInfo } from "../../datamodel/processed/processed_beatmap";
import { currentWindowDimensions } from "../../visuals/ui";
import { Interpolator, InterpolatedValueChanger } from "../../util/interpolation";
import { DrawableBeatmap } from "../drawable_beatmap";
import { Mod } from "../../datamodel/mods";
import { ScoringValue } from "../../datamodel/scoring/score";
import { PlayEvent, PlayEventType } from "../../datamodel/play_events";
import { Judgement } from "../../datamodel/scoring/judgement";
import { HitSoundInfo, generateHitSoundInfo, determineVolume, HitSoundType } from "../skin/hit_sound";
import { AudioBufferPlayer } from "../../audio/audio_buffer_player";
import { SkinSoundType } from "../skin/skin";
import { AudioPlayer } from "../../audio/audio_player";

const SPINNER_FADE_IN_TIME = DEFAULT_HIT_OBJECT_FADE_IN_TIME; // In ms
const SPINNER_FADE_OUT_TIME = 200; // In ms
const SPIN_TEXT_FADE_IN_TIME = 200; // In ms
const SPIN_TEXT_FADE_OUT_TIME = 200; // In ms
const SPINNER_GLOW_TINT: Color = {r: 2, g: 170, b: 255};
const SPINNER_METER_STEPS = 10;
const SPINNER_METER_STEP_HEIGHT = 69; // ( ͡° ͜ʖ ͡°)
const SPM_SAMPLER_DURATION = 333;
export const MAX_RADIANS_PER_MILLISECOND = 0.05;
const MAX_SPINS_PER_MINUTE = MAX_RADIANS_PER_MILLISECOND * 1000 * 60 / TAU; // 0.05 radians per millisecond results in ~477 SPM

interface SpmRecord {
	absoluteRotation: number,
	time: number,
	duration: number
}

export class DrawableSpinner extends DrawableHitObject {
	public parent: ProcessedSpinner;

	public hitSound: HitSoundInfo;
	private container: PIXI.Container;
	private componentContainer: PIXI.Container;
	private componentContainer2: PIXI.Container; // It's like 1, but better

	private clearTextInterpolator: Interpolator;
	private bonusSpinsInterpolator: Interpolator;
	private glowInterpolator: Interpolator;

	private isNewStyle: boolean;

	// New-style elements:
	private spinnerGlow: PIXI.Sprite;
	private spinnerBottom: PIXI.Sprite;
	private spinnerTop: PIXI.Sprite;
	// The following shitty nomenclature is taken from skin file names. Despite being named "middle", they're visually above "top".
	private spinnerMiddle2: PIXI.Sprite;
	private spinnerMiddle: PIXI.Sprite
	private scalablePart: PIXI.Container;

	// Old-style elements:
	private spinnerBackground: PIXI.Sprite;
	private spinnerMeter: PIXI.Container;
	private spinnerMeterMask: PIXI.Graphics;
	private spinnerCircle: PIXI.Container;
	private spinnerApproachCircle: PIXI.Container;

	// Informative elements for both styles
	private spinnerSpm: PIXI.Sprite;
	private spinnerSpmNumber: SpriteNumber;
	private spinnerSpin: PIXI.Sprite;
	private spinnerClear: PIXI.Container;
	private spinnerBonus: SpriteNumber;
	private spinnerSpinFadeOutStart: number;

	private lastAngle: number;
	private lastAngleTime: number;
	private rotation: number;
	private absoluteRotation: number;
	private visualRotationInterpolator: InterpolatedValueChanger;
	private cleared: boolean;
	private bonusSpins: number;
	private spmRecords: SpmRecord[];
	private maxSpm: number;

	private spinSoundPlayer: AudioPlayer = null;
	private bonusSoundVolume: number;
	
	constructor(drawableBeatmap: DrawableBeatmap, processedSpinner: ProcessedSpinner) {
		super(drawableBeatmap, processedSpinner);

		this.visualRotationInterpolator = new InterpolatedValueChanger({
			initial: 0,
			duration: 50,
			ease: EaseType.Linear
		});

		this.reset();
		this.initSounds(processedSpinner.hitObject, processedSpinner.timingInfo);
	}

	protected initSounds(spinner: Spinner, timingInfo: CurrentTimingPointInfo) {
		let currentTimingPoint = timingInfo.timingPoint;

		this.hitSound = generateHitSoundInfo(spinner.hitSound, spinner.extras.sampleSet, spinner.extras.additionSet, spinner.extras.sampleVolume, spinner.extras.customIndex, currentTimingPoint);
	}

	reset() {
		super.reset();

		if (this.clearTextInterpolator) this.clearTextInterpolator.reset();
		if (this.bonusSoundVolume) this.bonusSpinsInterpolator.reset();
		if (this.glowInterpolator) this.glowInterpolator.reset();

		this.spinnerSpinFadeOutStart = null;
		this.lastAngle = null;
		this.lastAngleTime = null;
		this.rotation = 0;
		this.absoluteRotation = 0;
		if (this.visualRotationInterpolator) this.visualRotationInterpolator.reset(0);
		this.cleared = false;
		this.bonusSpins = 0;
		this.spmRecords = [];
		this.maxSpm = 0;

		this.stopSpinningSound();
	}

	compose(updateSkin: boolean) {
		super.compose(updateSkin);
		let { screenPixelRatio, activeMods, skin } = this.drawableBeatmap.play;

		let backgroundTexture = skin.textures["spinnerBackground"];
		this.isNewStyle = backgroundTexture.isEmpty() && skin.getVersionNumber() >= 2.0;

		const createElement = (textureName: string, anchor: PIXI.Point, maxDimensionFactor = 1) => {
			let osuTexture = skin.textures[textureName];
			let sprite = new PIXI.Sprite();

			osuTexture.applyToSprite(sprite, screenPixelRatio, undefined, maxDimensionFactor);
			sprite.anchor.set(anchor.x, anchor.y);

			return sprite;
		};

		if (this.isNewStyle) {
			this.spinnerGlow = createElement("spinnerGlow", new PIXI.Point(0.5, 0.5));
			this.spinnerGlow.tint = colorToHexNumber(SPINNER_GLOW_TINT); // The default slider ball tint
			this.spinnerGlow.blendMode = PIXI.BLEND_MODES.ADD;

			this.spinnerBottom = createElement("spinnerBottom", new PIXI.Point(0.5, 0.5));
			this.spinnerTop = createElement("spinnerTop", new PIXI.Point(0.5, 0.5));
			this.spinnerMiddle2 = createElement("spinnerMiddle2", new PIXI.Point(0.5, 0.5));
			this.spinnerMiddle = createElement("spinnerMiddle", new PIXI.Point(0.5, 0.5));
		} else {
			this.spinnerBackground = createElement("spinnerBackground", new PIXI.Point(0.5, 0.5));
			this.spinnerBackground.y = 5 * screenPixelRatio; // TODO: Where does this come from?
			this.spinnerBackground.tint = colorToHexNumber(skin.config.colors.spinnerBackground);

			if (this.spinnerMeterMask) this.spinnerMeterMask.destroy();
			this.spinnerMeterMask = new PIXI.Graphics();
			this.spinnerMeter = createElement("spinnerMeter", new PIXI.Point(0.0, 0.0));
			this.spinnerMeter.position.set(currentWindowDimensions.width/2 - 512 * screenPixelRatio, 46 * screenPixelRatio);
			this.spinnerMeter.mask = this.spinnerMeterMask;

			this.spinnerCircle = createElement("spinnerCircle", new PIXI.Point(0.5, 0.5));
		}

		// The approach circle is there for both styles
		let approachCircleSprite = createElement("spinnerApproachCircle", new PIXI.Point(0.5, 0.5), 2.0); // Since the approach circle starts out at ~2.0x the scale, use that as the reference for texture quality.
		this.spinnerApproachCircle = new PIXI.Container();
		this.spinnerApproachCircle.addChild(approachCircleSprite);
		if (activeMods.has(Mod.Hidden)) this.spinnerApproachCircle.visible = false; // With HD, all spinner approach circles are hidden

		// Update spinner SPM display
		let spmOsuTexture = skin.textures["spinnerRpm"]; // Yeah,the texture is called RPM and not SPM. ¯\_(ツ)_/¯
		spmOsuTexture.applyToSprite(this.spinnerSpm, screenPixelRatio);
		this.spinnerSpm.position.set(currentWindowDimensions.width/2 - 139 * screenPixelRatio, currentWindowDimensions.height - 56 * screenPixelRatio);

		this.spinnerSpmNumber.container.position.set(currentWindowDimensions.width/2 + 122 * screenPixelRatio, currentWindowDimensions.height - 50 * screenPixelRatio);
		this.spinnerSpmNumber.options.textures = skin.scoreNumberTextures;
		this.spinnerSpmNumber.options.scaleFactor = screenPixelRatio * 0.85;
		this.spinnerSpmNumber.options.overlap = skin.config.fonts.scoreOverlap;
		this.spinnerSpmNumber.refresh();

		// Update spinner bonus number
		this.spinnerBonus.container.y = 128 * screenPixelRatio;
		this.spinnerBonus.options.textures = skin.scoreNumberTextures;
		this.spinnerBonus.options.scaleFactor = screenPixelRatio * 2;
		this.spinnerBonus.options.overlap = skin.config.fonts.scoreOverlap;
		this.spinnerBonus.refresh();

		// Update "spin" text
		let spinOsuTexture = skin.textures["spinnerSpin"];
		spinOsuTexture.applyToSprite(this.spinnerSpin, screenPixelRatio);
		this.spinnerSpin.y = 198 * screenPixelRatio;

		// Update "clear" text
		let clearSprite = this.spinnerClear.children[0] as PIXI.Sprite;
		let clearOsuTexture = skin.textures["spinnerClear"];
		clearOsuTexture.applyToSprite(clearSprite, screenPixelRatio);
		this.spinnerClear.y = -164 * screenPixelRatio;

		/** Add all elements */
		this.container.removeChildren();
		this.componentContainer.removeChildren();
		this.componentContainer2.removeChildren();

		if (this.isNewStyle) {
			this.scalablePart = new PIXI.Container();
			this.scalablePart.addChild(this.spinnerGlow);
			this.scalablePart.addChild(this.spinnerBottom);
			this.scalablePart.addChild(this.spinnerTop);
			this.scalablePart.addChild(this.spinnerMiddle2);
			this.scalablePart.addChild(this.spinnerMiddle);

			this.componentContainer2.addChild(this.scalablePart);
		} else {
			this.componentContainer.addChild(this.spinnerBackground);
			this.container.addChild(this.spinnerMeter);
			this.container.addChild(this.spinnerMeterMask);
			this.componentContainer2.addChild(this.spinnerCircle);
		}
		this.componentContainer2.addChild(this.spinnerApproachCircle);

		this.componentContainer2.addChild(this.spinnerSpin);
		this.componentContainer2.addChild(this.spinnerClear);
		this.componentContainer2.addChild(this.spinnerBonus.container);
		
		this.container.addChild(this.componentContainer);
		this.container.addChild(this.spinnerSpm);
		this.container.addChild(this.componentContainer2);
		this.container.addChild(this.spinnerSpmNumber.container); // Above all other elements

		// Update spinning sound effect
		if (updateSkin) {
			let spinner = this.parent.hitObject;
			let currentTimingPoint = this.parent.timingInfo.timingPoint;
			let volume = determineVolume(spinner.extras.sampleVolume, currentTimingPoint);

			let soundPlayer = this.drawableBeatmap.play.skin.sounds[SkinSoundType.SpinnerSpin].clone();
			if (soundPlayer && !soundPlayer.isReallyShort()) {
				this.stopSpinningSound();

				soundPlayer.setLoopState(true);
				soundPlayer.setVolume(volume / 100);
				this.spinSoundPlayer = soundPlayer;
			}

			this.bonusSoundVolume = volume;
		}
	}

	draw() {
		this.renderStartTime = this.parent.startTime - SPINNER_FADE_IN_TIME;

		this.container = new PIXI.Container();
		this.container.zIndex = -1e10; // Sliders are always behind everything

		this.componentContainer = new PIXI.Container();
		this.componentContainer2 = new PIXI.Container();
		this.clearTextInterpolator = new Interpolator({
			ease: EaseType.Linear,
			duration: 333
		});
		this.bonusSpinsInterpolator = new Interpolator({
			ease: EaseType.EaseOutQuad,
			duration: 750,
			defaultToFinished: true
		});
		this.glowInterpolator = new Interpolator({
			ease: EaseType.Linear,
			duration: 333,
			defaultToFinished: true
		});

		this.spinnerSpm = new PIXI.Sprite();

		// Add SPM number
		this.spinnerSpmNumber = new SpriteNumber({
			horizontalAlign: "right",
			verticalAlign: "top",
			overlapAtEnd: false
		});
		this.spinnerSpmNumber.setValue(0);

		// Add spinner bonus popup
		let spinnerBonus = new SpriteNumber({
			horizontalAlign: "center",
			verticalAlign: "middle"
		});
		this.spinnerBonus = spinnerBonus;

		this.spinnerSpin = new PIXI.Sprite();
		this.spinnerSpin.anchor.set(0.5, 0.5);

		let spinnerClearSprite = new PIXI.Sprite();
		spinnerClearSprite.anchor.set(0.5, 0.5);
		this.spinnerClear = new PIXI.Container();
		this.spinnerClear.addChild(spinnerClearSprite);
	}

	show() {
		let controller = this.drawableBeatmap.play.controller;

		controller.hitObjectContainer.addChild(this.container);
	}

	position() {
		let screenCoordinates = this.drawableBeatmap.play.toScreenCoordinates(this.parent.startPoint);

		// Position it in the center
		this.componentContainer.position.set(screenCoordinates.x, screenCoordinates.y);
		this.componentContainer2.position.copyFrom(this.componentContainer.position);
	}

	remove() {
		const controller = this.drawableBeatmap.play.controller;
		controller.hitObjectContainer.removeChild(this.container);
	}

	dispose() {
		this.spinnerMeterMask?.destroy();
		if (this.spinnerMeter) this.spinnerMeter.mask = null;
	}

	update(currentTime: number) {
		let { screenPixelRatio, skin } = this.drawableBeatmap.play;

		if (currentTime >= this.parent.endTime + SPINNER_FADE_OUT_TIME) {
			this.renderFinished = true;
			return;
		}

		super.update(currentTime);

		if (currentTime < this.parent.startTime) {
			let fadeInCompletion = (currentTime - (this.parent.startTime - SPINNER_FADE_IN_TIME)) / SPINNER_FADE_IN_TIME;
			fadeInCompletion = MathUtil.clamp(fadeInCompletion, 0, 1);
			this.container.alpha = fadeInCompletion;

			let spinTextFadeInCompletion = (currentTime - (this.parent.startTime - SPIN_TEXT_FADE_IN_TIME)) / SPIN_TEXT_FADE_IN_TIME;
			spinTextFadeInCompletion = MathUtil.clamp(spinTextFadeInCompletion, 0, 1);
			this.spinnerSpin.alpha = spinTextFadeInCompletion;

			this.spinnerSpm.y = MathUtil.lerp(currentWindowDimensions.height, currentWindowDimensions.height - 56 * screenPixelRatio, fadeInCompletion);
		} else {
			this.visualRotationInterpolator.setGoal(this.rotation, currentTime);

			this.container.alpha = 1;
			if (currentTime >= this.parent.endTime) {
				let fadeOutCompletion = (currentTime - this.parent.endTime) / SPINNER_FADE_OUT_TIME;
				fadeOutCompletion = MathUtil.clamp(fadeOutCompletion, 0, 1);
				this.container.alpha = 1 - fadeOutCompletion;
			}

			let spinnerSpinAlpha = 1;
			if (this.spinnerSpinFadeOutStart !== null) {
				let completion = (currentTime -  this.spinnerSpinFadeOutStart) / SPIN_TEXT_FADE_OUT_TIME;
				completion = MathUtil.clamp(completion, 0, 1);
				spinnerSpinAlpha = 1 - completion;
			}

			this.spinnerSpin.alpha = spinnerSpinAlpha;
			this.spinnerSpm.y = currentWindowDimensions.height - 56 * screenPixelRatio;
		}

		this.spinnerSpmNumber.setValue(Math.floor(this.sampleSpm(currentTime)));
	
		let completion = (currentTime - this.parent.startTime) / this.parent.duration;
		completion = MathUtil.clamp(completion, 0, 1);
		let clearCompletion = this.getSpinsSpun() / this.parent.requiredSpins;
		clearCompletion = MathUtil.clamp(clearCompletion, 0, 1);

		let visualRotation = this.visualRotationInterpolator.getCurrentValue(currentTime);

		this.spinnerApproachCircle.scale.set(MathUtil.lerp(1.85, 0.1, completion)); // Quote Google docs: "starts at 200% of its size and shrinks down to 10%". Changed to 185% 'cause I have eyes.

		if (this.isNewStyle) {
			this.spinnerBottom.rotation = visualRotation * 0.2;
			this.spinnerTop.rotation = visualRotation * 0.5;
			this.spinnerMiddle2.rotation = visualRotation * 1.0;

			(this.spinnerMiddle as PIXI.Sprite).tint = colorToHexNumber(lerpColors(Colors.White, Colors.Red, completion));

			this.spinnerGlow.alpha = clearCompletion;

			let totalScale = MathUtil.lerp(0.82, 1.0, MathUtil.ease(EaseType.EaseOutQuad, clearCompletion));
			this.scalablePart.scale.set(totalScale);

			let glowCompletion = this.glowInterpolator.getCurrentValue(currentTime);
			(this.spinnerGlow as PIXI.Sprite).tint = colorToHexNumber(lerpColors(Colors.White, SPINNER_GLOW_TINT, glowCompletion));
		} else {
			this.spinnerCircle.rotation = visualRotation;

			// Do meter mask stuff:
			{
				let mask = this.spinnerMeterMask;

				let completedSteps = Math.floor(clearCompletion * SPINNER_METER_STEPS);
				let completion = completedSteps / SPINNER_METER_STEPS; // Quantize this shit <- What the hell is this comment? XD

				// For a lack of better names:
				let a = Math.max(0, completedSteps-1);
				let b = a / SPINNER_METER_STEPS;

				// Draw all steps below the top step:
				mask.clear();
				mask.beginFill(0xFF0000);
				mask.drawRect(0, (49 + (1-b)*SPINNER_METER_STEP_HEIGHT*SPINNER_METER_STEPS) * screenPixelRatio, currentWindowDimensions.width, b*SPINNER_METER_STEP_HEIGHT*SPINNER_METER_STEPS * screenPixelRatio);
				mask.endFill();

				// Using the noise, create the 'flicker' effect.
				if (completedSteps > 0 && ((completedSteps === SPINNER_METER_STEPS && skin.config.general.spinnerNoBlink) || MathUtil.valueNoise1D(currentTime / 50) < 0.6)) {
					// Draw the top step:
					mask.beginFill(0xFF0000);
					mask.drawRect(0, (49 + (1-completion)*SPINNER_METER_STEP_HEIGHT*SPINNER_METER_STEPS) * screenPixelRatio, currentWindowDimensions.width, SPINNER_METER_STEP_HEIGHT * screenPixelRatio);
					mask.endFill();
				}
			}
		}

		let clearTextAnimationCompletion = this.clearTextInterpolator.getCurrentValue(currentTime);
		let parabola = 1.94444 * clearTextAnimationCompletion**2 - 2.69444 * clearTextAnimationCompletion + 1.75;
		this.spinnerClear.scale.set(parabola);
		this.spinnerClear.alpha = clearTextAnimationCompletion;

		let bonusSpinsCompletion = this.bonusSpinsInterpolator.getCurrentValue(currentTime);
		this.spinnerBonus.container.scale.set(MathUtil.lerp(1.0, 0.666, bonusSpinsCompletion));
		this.spinnerBonus.container.alpha = 1 - bonusSpinsCompletion;

		this.componentContainer.pivot.y = MathUtil.ease(EaseType.EaseInQuad, this.failAnimationCompletion) * -150 * screenPixelRatio;
		this.componentContainer2.pivot.y = this.componentContainer.pivot.y;
	}

	score() {
		let play = this.drawableBeatmap.play;

		let spinsSpun = this.getSpinsSpun();
		let progress = spinsSpun / this.parent.requiredSpins;
		let scoringValue = (() => {
			if (progress >= 1.0) {
				return ScoringValue.Hit300;
			} else if (progress > 0.9) {
				return ScoringValue.Hit100;
			} else if (progress > 0.75) {
				return ScoringValue.Hit50;
			}
			return ScoringValue.Miss;
		})();

		play.processJudgement(Judgement.createSpinnerTotalJudgement(this.parent, scoringValue));
		if (scoringValue !== ScoringValue.Miss) {
			play.playHitSound(this.hitSound, this.parent.endTime);
		}

		play.scoreProcessor.addSpmValues(this.getAverageSpm(), this.getMaxSpm());

		this.stopSpinningSound();
	}

	getSpinsSpun() {
		return this.absoluteRotation / TAU;
	}

	handleMouseMove(osuMouseCoordinates: Point, currentTime: number, pressed: boolean) {
		if (currentTime < this.parent.startTime || currentTime >= this.parent.endTime) return;

		let angle = Math.atan2(osuMouseCoordinates.y - PLAYFIELD_DIMENSIONS.height/2, osuMouseCoordinates.x - PLAYFIELD_DIMENSIONS.width/2);

		if (!pressed) {
			this.lastAngle = null;
			this.lastAngleTime = null;
			return;
		}
		
		if (this.lastAngle) {
			let angleDelta = MathUtil.getNormalizedAngleDelta(this.lastAngle, angle);
			let timeDelta = currentTime - this.lastAngleTime;

			this.spin(angleDelta, currentTime, timeDelta);
		}

		this.lastAngle = angle;
		this.lastAngleTime = currentTime;
	}

	spin(radians: number, currentTime: number, dt: number) {
		if (currentTime < this.parent.startTime || currentTime >= this.parent.endTime) return;
		if (dt === 0) return;

		let prevSpinsSpun = this.getSpinsSpun();

		radians *= Math.max(this.drawableBeatmap.play.playbackRate, 1); // Spinners should be easier in DT. Don't make them harder for HT.
		let cappedRadians = Math.min(Math.abs(radians), dt * MAX_RADIANS_PER_MILLISECOND) * Math.sign(radians);
		this.rotation += cappedRadians;
		let absRotation = Math.abs(cappedRadians);
		this.absoluteRotation += absRotation;

		// Add the record for spm sampling
		this.spmRecords.push({
			absoluteRotation: absRotation,
			time: currentTime - dt,
			duration: dt
		});
		this.maxSpm = Math.max(this.maxSpm, this.calculateSpm(absRotation, dt));

		let play =  this.drawableBeatmap.play;
		let { skin } = play;

		let spinsSpunNow = this.getSpinsSpun();
		let wholeDif = Math.floor(spinsSpunNow) - Math.floor(prevSpinsSpun);
		if (wholeDif > 0) {
			// Give 100 raw score for every spin
			play.processJudgement(Judgement.createSpinnerSpinBonus(this.parent, wholeDif * 100, currentTime));
		}
		if (spinsSpunNow >= this.parent.requiredSpins && !this.cleared) {
			// Show the "cleared" text
			this.cleared = true;
			this.clearTextInterpolator.start(currentTime);
		}
		let bonusSpins = Math.floor(spinsSpunNow - this.parent.requiredSpins);
		if (bonusSpins > 0 && bonusSpins > this.bonusSpins) {
			// Award 1000 raw score for each bonus spin
			let dif = bonusSpins - this.bonusSpins;
			play.processJudgement(Judgement.createSpinnerSpinBonus(this.parent, dif * 1000, currentTime));

			this.bonusSpins = bonusSpins;
			this.spinnerBonus.setValue(this.bonusSpins * 1000);
			this.bonusSpinsInterpolator.start(currentTime);
			this.glowInterpolator.start(currentTime);
			
			let bonusPlayer = skin.sounds[SkinSoundType.SpinnerBonus].clone();
			bonusPlayer.setVolume(this.bonusSoundVolume / 100);
			bonusPlayer.start(0);
		}

		let spinCompletion = spinsSpunNow / this.parent.requiredSpins;
		if (spinCompletion >= 0.25 && this.spinnerSpinFadeOutStart === null) {
			// Fade out the "spin!" text once the player has spun the spinner far enough
			this.spinnerSpinFadeOutStart = currentTime;
		}
	}

	tick(currentTime: number, dt: number) {
		if (this.drawableBeatmap.play.activeMods.has(Mod.SpunOut)) {
			// Spin only for the time of the tick that actually overlaps with the spinning window
			let overlap = MathUtil.calculateIntervalOverlap(currentTime - dt, currentTime, this.parent.startTime, this.parent.endTime);
			// Spin at max speed
			this.spin(-overlap * MAX_RADIANS_PER_MILLISECOND, Math.min(this.parent.endTime - 1e-6, currentTime), overlap);
		}

		let skin = this.drawableBeatmap.play.skin;

		// Handle playback, stopping and playback rate of the spinning sounds
		if (this.spinSoundPlayer) {
			let spm = this.sampleSpm(currentTime);
			let playSound = spm >= 10;
			let spinCompletion = this.getSpinsSpun() / this.parent.requiredSpins;

			if (!this.spinSoundPlayer.isPlaying() && playSound) this.spinSoundPlayer.start(0);
			if (!playSound) this.stopSpinningSound();

			if (skin.config.general.spinnerFrequencyModulate) this.spinSoundPlayer.setPlaybackRate(Math.min(2, spinCompletion*0.85 + 0.5));
		}
	}

	private calculateSpm(absoluteRadians: number, elapsedTime: number) {
		let rotationPerMs = absoluteRadians / elapsedTime;
		let revolutionsPerMs = rotationPerMs / TAU;
		let revolutionsPerMinute = revolutionsPerMs * 1000 * 60;

		return Math.min(MAX_SPINS_PER_MINUTE, revolutionsPerMinute);
	}

	private sampleSpm(currentTime: number) {
		let start = currentTime - SPM_SAMPLER_DURATION;
		let end = currentTime - 10; // Shorten the sampler at the end by a small amount, so that we have a big enough timeframe to wait for the next record to come in, instead of prematurely filling the far right end of the sampler with "no input". This reduces SPM fluctuation.

		let totalRotation = 0;
		for (let i = 0; i < this.spmRecords.length; i++) {
			let record = this.spmRecords[i];
			if (record.time + record.duration < start) {
				this.spmRecords.splice(i--, 1);
				continue;
			}
			if (record.time > end) break;

			let overlap = MathUtil.calculateIntervalOverlap(start, end, record.time, record.time + record.duration);
			totalRotation += record.absoluteRotation * (overlap / record.duration);
		}

		return this.calculateSpm(totalRotation, end - start);
	}

	private getAverageSpm() {
		return this.calculateSpm(this.absoluteRotation, Math.max(Number.MIN_VALUE, this.parent.duration - 10)); // The duration is shorted for the same reason given in SPM sampling.
	}

	private getMaxSpm() {
		return this.maxSpm;
	}

	stopSpinningSound() {
		if (this.spinSoundPlayer) this.spinSoundPlayer.stop();
	}

	handleButtonDown() {
		return false;
	}

	handlePlayEvent(event: PlayEvent, osuMouseCoordinates: Point, buttonPressed: boolean, currentTime: number, dt: number) {
		switch (event.type) {
			case PlayEventType.SpinnerEnd: {
				this.score();
			}; break;
			case PlayEventType.SpinnerSpin: {
				this.tick(currentTime, dt);
			}; break;
		}
	}
}