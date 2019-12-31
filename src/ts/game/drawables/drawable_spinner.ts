import { DrawableHitObject } from "./drawable_hit_object";
import { Spinner } from "../../datamodel/spinner";
import { mainHitObjectContainer } from "../../visuals/rendering";
import { gameState } from "../game_state";
import { MathUtil, EaseType, TAU } from "../../util/math_util";
import { Point } from "../../util/point";
import { anyGameButtonIsPressed } from "../../input/input";
import { PLAYFIELD_DIMENSIONS, DEFAULT_HIT_OBJECT_FADE_IN_TIME } from "../../util/constants";
import { Interpolator, colorToHexNumber, lerpColors, Color, Colors } from "../../util/graphics_util";
import { SpriteNumber } from "../../visuals/sprite_number";
import { SoundEmitter } from "../../audio/sound_emitter";
import { Mod } from "../mods/mods";
import { accuracyMeter } from "../hud/hud";
import { HitSoundInfo, generateHitSoundInfo, OsuSoundType } from "../skin/sound";
import { ProcessedSpinner } from "../../datamodel/processed/processed_spinner";
import { CurrentTimingPointInfo } from "../../datamodel/processed/processed_beatmap";

const SPINNER_FADE_IN_TIME = DEFAULT_HIT_OBJECT_FADE_IN_TIME; // In ms
const SPINNER_FADE_OUT_TIME = 200; // In ms
const SPIN_TEXT_FADE_IN_TIME = 200; // In ms
const SPIN_TEXT_FADE_OUT_TIME = 200; // In ms
const SPINNER_GLOW_TINT: Color = {r: 2, g: 170, b: 255};
const SPINNER_METER_STEPS = 10;
const SPINNER_METER_STEP_HEIGHT = 69; // ( ͡° ͜ʖ ͡°)
const SPINNER_ACCELERATION = 0.00022; // In radians/ms^2
const DELAY_UNTIL_SPINNER_DECELERATION = 20; // In ms

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
    private spinnerGlow: PIXI.Container;
    private spinnerBottom: PIXI.Container;
    private spinnerTop: PIXI.Container;
    // The following shitty nomenclature is taken from skin file names. Despite being named "middle", they're visually above "top".
    private spinnerMiddle2: PIXI.Container;
    private spinnerMiddle: PIXI.Container
    private scalablePart: PIXI.Container;

    // Old-style elements:
    private spinnerBackground: PIXI.Container;
    private spinnerMeter: PIXI.Container;
    private spinnerMeterMask: PIXI.Graphics;
    private spinnerCircle: PIXI.Container;
    private spinnerApproachCircle: PIXI.Container;

    // Informative elements for both styles
    private spinnerRpm: PIXI.Container;
    private spinnerRpmNumber: SpriteNumber;
    private spinnerSpin: PIXI.Container;
    private spinnerClear: PIXI.Container;
    private spinnerBonus: SpriteNumber;
    private spinnerSpinFadeOutStart: number = null;

    private lastSpinPosition: Point = null;
    private lastInputTime: number = null;
    private lastAccelerationTime: number = null;
    private spinnerAngle = 0;
    private totalRadiansSpun = 0; // The sum of all absolute angles this spinner has been spun (the total "angular distance")
    private cleared: boolean;
    private bonusSpins: number;
    private angularVelocity = 0;

    public spinSoundEmitter: SoundEmitter = null;
    // TODO: Clean this up. Ergh. Disgusting.
	public bonusSoundVolume: number;
	
	constructor(processedSpinner: ProcessedSpinner) {
		super(processedSpinner);

		this.cleared = false;
        this.bonusSpins = 0;

        this.initSounds(processedSpinner.hitObject, processedSpinner.timingInfo);
	}

    protected initSounds(spinner: Spinner, timingInfo: CurrentTimingPointInfo) {
        let currentTimingPoint = timingInfo.timingPoint;

        this.hitSound = generateHitSoundInfo(spinner.hitSound, spinner.extras.sampleSet, spinner.extras.additionSet, spinner.extras.sampleVolume, spinner.extras.customIndex, currentTimingPoint);

        let volume = spinner.extras.sampleVolume || currentTimingPoint.volume,
            index = spinner.extras.customIndex || currentTimingPoint.sampleIndex || 1;

        let emitter = gameState.currentGameplaySkin.sounds[OsuSoundType.SpinnerSpin].getEmitter(volume, index);
        if (emitter && !emitter.isReallyShort()) {
            emitter.setLoopState(true);
            this.spinSoundEmitter = emitter;
        }

        this.bonusSoundVolume = volume;
    }

    draw() {
        let { screenPixelRatio, activeMods } = gameState.currentPlay;

        this.renderStartTime = this.parent.startTime - SPINNER_FADE_IN_TIME;

        this.container = new PIXI.Container();
        this.container.zIndex = -1e10; // Sliders are always behind everything

        this.componentContainer = new PIXI.Container();
        this.componentContainer2 = new PIXI.Container();
        this.clearTextInterpolator = new Interpolator({
            from: 0,
            to: 1,
            ease: EaseType.Linear,
            duration: 333,
            defaultToFinished: false
        });
        this.bonusSpinsInterpolator = new Interpolator({
            from: 0,
            to: 1,
            ease: EaseType.EaseOutQuad,
			duration: 750,
			defaultToFinished: true
        });
        this.glowInterpolator = new Interpolator({
            from: 0,
            to: 1,
            ease: EaseType.Linear,
			duration: 333,
			defaultToFinished: true
        });

        let backgroundTexture = gameState.currentGameplaySkin.textures["spinnerBackground"];
        this.isNewStyle = backgroundTexture.isEmpty();

        if (this.isNewStyle) {
            // Add spinner glow
            {
                let osuTexture = gameState.currentGameplaySkin.textures["spinnerGlow"];
                let sprite = new PIXI.Sprite();

                osuTexture.applyToSprite(sprite, screenPixelRatio); 

                sprite.anchor.set(0.5, 0.5);
                sprite.tint = colorToHexNumber(SPINNER_GLOW_TINT); // The default slider ball tint
                sprite.blendMode = PIXI.BLEND_MODES.ADD;
    
                this.spinnerGlow = sprite;
            }
    
            // Add spinner bottom
            {
                let osuTexture = gameState.currentGameplaySkin.textures["spinnerBottom"];
                let sprite = new PIXI.Sprite();

                osuTexture.applyToSprite(sprite, screenPixelRatio);

                sprite.anchor.set(0.5, 0.5);
    
                this.spinnerBottom = sprite;
            }
    
            // Add spinner top
            {
                let osuTexture = gameState.currentGameplaySkin.textures["spinnerTop"];
                let sprite = new PIXI.Sprite();

                osuTexture.applyToSprite(sprite, screenPixelRatio);

                sprite.anchor.set(0.5, 0.5);
    
                this.spinnerTop = sprite;
            }
    
            // Add spinner middle2
            {
                let osuTexture = gameState.currentGameplaySkin.textures["spinnerMiddle2"];
                let sprite = new PIXI.Sprite();

                osuTexture.applyToSprite(sprite, screenPixelRatio);
    
                sprite.anchor.set(0.5, 0.5);
    
                this.spinnerMiddle2 = sprite;
            }
    
            // Add spinner middle
            {
                let osuTexture = gameState.currentGameplaySkin.textures["spinnerMiddle"];
                let sprite = new PIXI.Sprite();

                osuTexture.applyToSprite(sprite, screenPixelRatio);
    
                sprite.anchor.set(0.5, 0.5);
    
                this.spinnerMiddle = sprite;
            }
        } else {
            // Add spinner approach circle
            {
                let osuTexture = gameState.currentGameplaySkin.textures["spinnerApproachCircle"];
                let sprite = new PIXI.Sprite();

                osuTexture.applyToSprite(sprite, screenPixelRatio, undefined, 2.0); // Since the approach circle starts out at ~2.0x the scale, use that as the reference for texture quality.
                sprite.anchor.set(0.5, 0.5);
    
                let wrapper = new PIXI.Container();
                wrapper.addChild(sprite);

                if (activeMods.has(Mod.Hidden)) wrapper.visible = false; // With HD, all spinner approach circles are hidden
    
                this.spinnerApproachCircle = wrapper;
            }

            // Add spinner background
            {
                let osuTexture = gameState.currentGameplaySkin.textures["spinnerBackground"];
                let sprite = new PIXI.Sprite();
                
                osuTexture.applyToSprite(sprite, screenPixelRatio);

                sprite.anchor.set(0.5, 0.5);
                sprite.y = 5 * screenPixelRatio; // TODO: Where does this come from?
                sprite.tint = colorToHexNumber(gameState.currentGameplaySkin.config.colors.spinnerBackground);
    
                this.spinnerBackground = sprite;
            }
    
            // Add spinner meter
            this.spinnerMeterMask = new PIXI.Graphics();
            {
                let osuTexture = gameState.currentGameplaySkin.textures["spinnerMeter"];
                let sprite = new PIXI.Sprite();
                
                osuTexture.applyToSprite(sprite, screenPixelRatio);
    
                sprite.anchor.set(0.0, 0.0);
                sprite.position.set(window.innerWidth/2 - 512 * screenPixelRatio, 46 * screenPixelRatio);
                sprite.mask = this.spinnerMeterMask;
    
                this.spinnerMeter = sprite;
            }
    
            // Add spinner circle
            {
                let osuTexture = gameState.currentGameplaySkin.textures["spinnerCircle"];
                let sprite = new PIXI.Sprite();
                
                osuTexture.applyToSprite(sprite, screenPixelRatio);
 
                sprite.anchor.set(0.5, 0.5);
    
                this.spinnerCircle = sprite;
            }
        }

        // Add spinner RPM display
        {
            let osuTexture = gameState.currentGameplaySkin.textures["spinnerRpm"];
            let sprite = new PIXI.Sprite();
                
            osuTexture.applyToSprite(sprite, screenPixelRatio);

            sprite.anchor.set(0.0, 0.0);
            sprite.position.set(window.innerWidth/2 - 139 * screenPixelRatio, window.innerHeight - 56 * screenPixelRatio);

            this.spinnerRpm = sprite;
        }

        // Add RPM number
        let spinnerRpmNumber = new SpriteNumber({
            textures: gameState.currentGameplaySkin.scoreNumberTextures,
            scaleFactor: screenPixelRatio * 0.85,
            horizontalAlign: "right",
            verticalAlign: "top",
            overlap: gameState.currentGameplaySkin.config.fonts.scoreOverlap,
            overlapAtEnd: false
        });
        spinnerRpmNumber.container.position.set(window.innerWidth/2 + 122 * screenPixelRatio, window.innerHeight - 50 * screenPixelRatio);
        spinnerRpmNumber.container.visible = false;
        spinnerRpmNumber.setValue(0);
        this.spinnerRpmNumber = spinnerRpmNumber;

        // Add "spin" text
        {
            let osuTexture = gameState.currentGameplaySkin.textures["spinnerSpin"];
            let sprite = new PIXI.Sprite();
                
            osuTexture.applyToSprite(sprite, screenPixelRatio);

            sprite.anchor.set(0.5, 0.5);
            sprite.y = 198 * screenPixelRatio;

            this.spinnerSpin = sprite;
        }

        // Add "clear" text
        {
            let osuTexture = gameState.currentGameplaySkin.textures["spinnerClear"];
            let sprite = new PIXI.Sprite();
                
            osuTexture.applyToSprite(sprite, screenPixelRatio);

            sprite.anchor.set(0.5, 0.5);

            let wrapper = new PIXI.Container();
            wrapper.addChild(sprite);
            wrapper.y = -164 * screenPixelRatio;

            this.spinnerClear = wrapper;
        }

        // Add spinner bonus popup
        let spinnerBonus = new SpriteNumber({
            textures: gameState.currentGameplaySkin.scoreNumberTextures,
            scaleFactor: screenPixelRatio * 2,
            horizontalAlign: "center",
            verticalAlign: "middle",
            overlap: gameState.currentGameplaySkin.config.fonts.scoreOverlap
        });
        spinnerBonus.container.y = 128 * screenPixelRatio;
        this.spinnerBonus = spinnerBonus;

        /** Add all elements */

        this.container.addChild(this.componentContainer);

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
            this.componentContainer2.addChild(this.spinnerApproachCircle);
        }
        
        this.componentContainer2.addChild(this.spinnerSpin);
        this.componentContainer2.addChild(this.spinnerClear);
        this.componentContainer2.addChild(this.spinnerBonus.container);
        
        this.container.addChild(this.spinnerRpm);
        this.container.addChild(this.componentContainer2);
        this.container.addChild(this.spinnerRpmNumber.container); // Above all other elements
    }

    show() {
        mainHitObjectContainer.addChild(this.container);

        this.position();
    }

    position() {
        let screenCoordinates = gameState.currentPlay.toScreenCoordinates(this.parent.startPoint);

        // Position it in the center
        this.componentContainer.position.set(screenCoordinates.x, screenCoordinates.y);
        this.componentContainer2.position.copyFrom(this.componentContainer.position);
    }

    update(currentTime: number) {
        let { screenPixelRatio } = gameState.currentPlay;

        if (currentTime >= this.parent.endTime + SPINNER_FADE_OUT_TIME) {
            this.renderFinished = true;
            return;
        }

        if (currentTime < this.parent.startTime) {
            let fadeInCompletion = (currentTime - (this.parent.startTime - SPINNER_FADE_IN_TIME)) / SPINNER_FADE_IN_TIME;
            fadeInCompletion = MathUtil.clamp(fadeInCompletion, 0, 1);
            this.container.alpha = fadeInCompletion;

            let spinTextFadeInCompletion = (currentTime - (this.parent.startTime - SPIN_TEXT_FADE_IN_TIME)) / SPIN_TEXT_FADE_IN_TIME;
            spinTextFadeInCompletion = MathUtil.clamp(spinTextFadeInCompletion, 0, 1);
            this.spinnerSpin.alpha = spinTextFadeInCompletion;

            this.spinnerRpm.y = MathUtil.lerp(window.innerHeight, window.innerHeight - 56 * screenPixelRatio, fadeInCompletion);
        } else {
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

            this.spinnerRpmNumber.container.visible = true;
            this.spinnerRpm.y = window.innerHeight - 56 * screenPixelRatio;
        }
    
        let completion = (currentTime - this.parent.startTime) / this.parent.duration;
        completion = MathUtil.clamp(completion, 0, 1);
        let clearCompletion = this.getSpinsSpun() / this.parent.requiredSpins;
        clearCompletion = MathUtil.clamp(clearCompletion, 0, 1);

        if (this.isNewStyle) {
            this.spinnerBottom.rotation = this.spinnerAngle * 0.2;
            this.spinnerTop.rotation = this.spinnerAngle * 0.5;
            this.spinnerMiddle2.rotation = this.spinnerAngle * 1.0;

            (this.spinnerMiddle as PIXI.Sprite).tint = colorToHexNumber(lerpColors(Colors.White, Colors.Red, completion));

            this.spinnerGlow.alpha = clearCompletion;

            let totalScale = MathUtil.lerp(0.82, 1.0, MathUtil.ease(EaseType.EaseOutQuad, clearCompletion));
            this.scalablePart.scale.set(totalScale);

            let glowCompletion = this.glowInterpolator.getCurrentValue(currentTime);
            (this.spinnerGlow as PIXI.Sprite).tint = colorToHexNumber(lerpColors(Colors.White, SPINNER_GLOW_TINT, glowCompletion));
        } else {
            this.spinnerApproachCircle.scale.set(MathUtil.lerp(1.85, 0.1, completion)); // Quote Google docs: "starts at 200% of its size and shrinks down to 10%". Changed to 185% 'cause I have eyes.

            this.spinnerCircle.rotation = this.spinnerAngle;

            // Do meter mask stuff:
            {
                let mask = this.spinnerMeterMask;

                let completedSteps = Math.floor(clearCompletion * SPINNER_METER_STEPS);
                let completion = completedSteps / SPINNER_METER_STEPS; // Quantize this shit

                // For a lack of better names:
                let a = Math.max(0, completedSteps-1);
                let b = a / SPINNER_METER_STEPS;

                // Draw all steps below the top step:
                mask.clear();
                mask.beginFill(0xFF0000);
                mask.drawRect(0, (49 + (1-b)*SPINNER_METER_STEP_HEIGHT*SPINNER_METER_STEPS) * screenPixelRatio, window.innerWidth, b*SPINNER_METER_STEP_HEIGHT*SPINNER_METER_STEPS * screenPixelRatio);
                mask.endFill();

                // Using the noise, create the 'flicker' effect.
                if (completedSteps > 0 && ((completedSteps === SPINNER_METER_STEPS && gameState.currentGameplaySkin.config.general.spinnerNoBlink) || MathUtil.valueNoise1D(currentTime / 50) < 0.6)) {
                    // Draw the top step:
                    mask.beginFill(0xFF0000);
                    mask.drawRect(0, (49 + (1-completion)*SPINNER_METER_STEP_HEIGHT*SPINNER_METER_STEPS) * screenPixelRatio, window.innerWidth, SPINNER_METER_STEP_HEIGHT * screenPixelRatio);
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
    }

    score() {
        let currentPlay = gameState.currentPlay;

        let spinsSpun = this.getSpinsSpun();
        let progress = spinsSpun / this.parent.requiredSpins;
        let judgement = (() => {
            if (progress >= 1.0) {
                return 300;
            } else if (progress > 0.9) {
                return 100;
            } else if (progress > 0.75) {
                return 50;
            }
            return 0;
        })();

        currentPlay.scoreCounter.add(judgement, false, true, true, this, this.parent.endTime);
        if (judgement !== 0) {
            gameState.currentGameplaySkin.playHitSound(this.hitSound);
        }

        if (this.spinSoundEmitter) this.spinSoundEmitter.stop();
    }

    getSpinsSpun() {
        return this.totalRadiansSpun / TAU;
    }

    handleMouseMove(osuMouseCoordinates: Point, currentTime: number) {
        if (currentTime < this.parent.startTime || currentTime >= this.parent.endTime) return;

        let pressed = anyGameButtonIsPressed();

        if (!pressed) {
            if (this.lastSpinPosition !== null) {
                this.lastSpinPosition = null;
            }
            
            return;
        }

        if (this.lastSpinPosition === null) {
            this.lastSpinPosition = osuMouseCoordinates;
            this.lastInputTime = currentTime;
            return;
        }

        let p1 = osuMouseCoordinates,
            p2 = this.lastSpinPosition;
        let angle1 = Math.atan2(p2.y - PLAYFIELD_DIMENSIONS.height/2, p2.x - PLAYFIELD_DIMENSIONS.width/2),
            angle2 = Math.atan2(p1.y - PLAYFIELD_DIMENSIONS.height/2, p1.x - PLAYFIELD_DIMENSIONS.width/2);
        let theta = MathUtil.getNormalizedAngleDelta(angle1, angle2);
        
        let timeDelta = currentTime - this.lastInputTime; // In ms
        if (timeDelta <= 0) return;

        this.spin(theta, currentTime, timeDelta);

        this.lastSpinPosition = osuMouseCoordinates;
    }

    /** Spins the spinner by a certain amount in a certain timeframe. */
    spin(radians: number, currentTime: number, dt: number) {
        if (currentTime < this.parent.startTime || currentTime >= this.parent.endTime) return;
        if (!dt) return;

        accuracyMeter.fadeOutNow(currentTime);

        let radiansAbs = Math.abs(radians);
        let velocityAbs = Math.abs(this.angularVelocity);
        let radiansPerMs = radiansAbs/dt;

        if (radiansPerMs >= velocityAbs && (Math.sign(radians) === Math.sign(this.angularVelocity) || this.angularVelocity === 0)) {
            let thing = Math.min(radiansPerMs, velocityAbs + SPINNER_ACCELERATION * dt);
            this.angularVelocity = thing * Math.sign(radians);
            this.lastAccelerationTime = currentTime;
        } else {
            this.tryDecelerate(currentTime, dt, (Math.sign(radians) === Math.sign(this.angularVelocity))? radiansPerMs : 0);
        }

        // Limit angular velocity to 0.05 radians/ms, because of the 477 RPM limit!
        this.angularVelocity = Math.sign(this.angularVelocity) * Math.min(Math.abs(this.angularVelocity), 0.05);

        this.lastInputTime = currentTime;
    }

    private tryDecelerate(currentTime: number, dt: number, minVelocity: number) {
        if (this.lastAccelerationTime !== null && currentTime - this.lastAccelerationTime >= DELAY_UNTIL_SPINNER_DECELERATION) {
            let previousTime = currentTime-dt;
            let adjustedDt = currentTime - Math.max(previousTime, this.lastAccelerationTime + DELAY_UNTIL_SPINNER_DECELERATION); // We need to adjust here to be tick-frequency independent

            let abs = Math.abs(this.angularVelocity);
            let thing = Math.max(0, abs - SPINNER_ACCELERATION * adjustedDt);
            this.angularVelocity = Math.max(thing, minVelocity) * Math.sign(this.angularVelocity);
        }
    }

    tick(currentTime: number, dt: number) {
        if (!dt) return;

        let { scoreCounter } = gameState.currentPlay;

        this.tryDecelerate(currentTime, dt, 0);

        let angle = this.angularVelocity * dt;
        let spinsPerMinute = Math.abs(this.angularVelocity) * 1000 * 60 / TAU;
        this.spinnerRpmNumber.setValue(Math.floor(spinsPerMinute));

        let prevSpinsSpun = this.getSpinsSpun();

        this.spinnerAngle += angle;
        this.totalRadiansSpun += Math.abs(angle);

        let spinsSpunNow = this.getSpinsSpun();
        let wholeDif = Math.floor(spinsSpunNow) - Math.floor(prevSpinsSpun);
        if (wholeDif > 0) {
            // Give 100 raw score for every spin
            scoreCounter.add(wholeDif * 100, true, false, false, this, currentTime);
        }
        if (spinsSpunNow >= this.parent.requiredSpins && !this.cleared) {
            this.cleared = true;
            this.clearTextInterpolator.start(currentTime);
        }
        let bonusSpins = Math.floor(spinsSpunNow - this.parent.requiredSpins);
        if (bonusSpins > 0 && bonusSpins > this.bonusSpins) {
            let dif = bonusSpins - this.bonusSpins;
            scoreCounter.add(dif * 1000, true, false, false, this, currentTime);

            this.bonusSpins = bonusSpins;
            this.spinnerBonus.setValue(this.bonusSpins * 1000);
            this.bonusSpinsInterpolator.start(currentTime);
            this.glowInterpolator.start(currentTime);

            gameState.currentGameplaySkin.sounds[OsuSoundType.SpinnerBonus].play(this.bonusSoundVolume);
        }

        let spinCompletion = spinsSpunNow / this.parent.requiredSpins;
        if (spinCompletion >= 0.25 && this.spinnerSpinFadeOutStart === null) {
            this.spinnerSpinFadeOutStart = currentTime;
        }

        if (this.spinSoundEmitter) {
            if (!this.spinSoundEmitter.isPlaying() && this.angularVelocity !== 0) this.spinSoundEmitter.start();
            if (this.angularVelocity === 0) this.spinSoundEmitter.stop();

            if (gameState.currentGameplaySkin.config.general.spinnerFrequencyModulate) this.spinSoundEmitter.setPlaybackRate(Math.min(2, spinCompletion*0.85 + 0.5));
        }
    }

    remove() {
        mainHitObjectContainer.removeChild(this.container);
    }

    handleButtonDown() {
        return false;
    }
}