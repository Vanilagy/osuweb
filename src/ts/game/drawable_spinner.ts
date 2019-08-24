import { DrawableHitObject } from "./drawable_hit_object";
import { PlayEvent, PlayEventType } from "./play_events";
import { Spinner } from "../datamodel/spinner";
import { mainHitObjectContainer } from "../visuals/rendering";
import { gameState } from "./game_state";
import { MathUtil, EaseType } from "../util/math_util";
import { Point } from "../util/point";
import { anyGameButtonIsPressed } from "../input/input";
import { PLAYFIELD_DIMENSIONS, DrawingMode, DRAWING_MODE, HIT_OBJECT_FADE_IN_TIME } from "../util/constants";
import { Interpolator, colorToHexNumber, lerpColors, Color, Colors } from "../util/graphics_util";
import { HitSoundInfo, HitSoundType, HitSound } from "./skin";
import { SpriteNumber } from "../visuals/sprite_number";
import { SoundEmitter } from "../audio/sound_emitter";

const SPINNER_FADE_IN_TIME = HIT_OBJECT_FADE_IN_TIME; // In ms
const SPINNER_FADE_OUT_TIME = 200; // In ms
const SPIN_TEXT_FADE_IN_TIME = 200; // In ms
const SPIN_TEXT_FADE_OUT_TIME = 200; // In ms
const SPINNER_GLOW_TINT: Color = {r: 2, g: 170, b: 255}; // Same color as default slider ball tint
const SPINNER_METER_STEPS = 10;

export class DrawableSpinner extends DrawableHitObject {
    public hitObject: Spinner;
    public hitSound: HitSoundInfo;
    private componentContainer: PIXI.Container;

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
    private spinnerSpin: PIXI.Container;
    private spinnerClear: PIXI.Container;
    private spinnerBonus: SpriteNumber;
    private spinnerSpinFadeOutStart: number = null;

    private duration: number;
    private lastSpinPosition: Point = null;
    private lastInputTime: number = null;
    private spinnerAngle = 0;
    private totalRadiansSpun = 0; // The sum of all absolute angles this spinner has been spun (the total "angular distance")
    private requiredSpins: number;
    private cleared: boolean;
    private bonusSpins: number;

    public spinSoundEmitter: SoundEmitter = null;
    // TODO: Clean this up. Ergh. Disgusting.
    public bonusSoundVolume: number;

    constructor(hitObject: Spinner) {
        super(hitObject);
    }

    init() {
        let { processedBeatmap } = gameState.currentPlay;

        this.startTime = this.hitObject.time;
        this.endTime = this.hitObject.endTime;
        this.endPoint = this.startPoint;

        this.duration = this.endTime - this.startTime;
        // 1 Spin = 1 Revolution
        this.requiredSpins = (100 + processedBeatmap.beatmap.difficulty.OD * 15) * this.duration / 60000 * 0.88; // This shit's approximate af. But I mean it's ppy.
        this.cleared = false;
        this.bonusSpins = 0;

        this.componentContainer = new PIXI.Container();
        this.clearTextInterpolator = new Interpolator({
            from: 0,
            to: 1,
            ease: EaseType.Linear,
            duration: 333,
            invertDefault: true
        });
        this.bonusSpinsInterpolator = new Interpolator({
            from: 0,
            to: 1,
            ease: EaseType.EaseOutQuad,
            duration: 750
        });
        this.glowInterpolator = new Interpolator({
            from: 0,
            to: 1,
            ease: EaseType.Linear,
            duration: 333
        });

        this.renderStartTime = this.startTime - SPINNER_FADE_IN_TIME;

        if (this.spinSoundEmitter) {
            this.spinSoundEmitter.setLoopState(true);
        }
    }

    draw() {
        let { circleDiameter } = gameState.currentPlay;

        let backgroundTexture = gameState.currentGameplaySkin.textures["spinnerBackground"];
        this.isNewStyle = backgroundTexture.isEmpty();

        if (this.isNewStyle) {
            if (DRAWING_MODE === DrawingMode.Skin) {
                let osuTexture = gameState.currentGameplaySkin.textures["spinnerGlow"];
                let factor = circleDiameter / 128;
                let width = osuTexture.getWidth() * factor;
                let height = osuTexture.getHeight() * factor;
    
                let spinnerGlow = new PIXI.Sprite(osuTexture.getBest());
                spinnerGlow.anchor.set(0.5, 0.5);
                spinnerGlow.width = width;
                spinnerGlow.height = height;
                spinnerGlow.tint = colorToHexNumber(SPINNER_GLOW_TINT); // The default slider ball tint
                spinnerGlow.blendMode = PIXI.BLEND_MODES.ADD;
    
                this.spinnerGlow = spinnerGlow;
            }
    
            if (DRAWING_MODE === DrawingMode.Skin) {
                let osuTexture = gameState.currentGameplaySkin.textures["spinnerBottom"];
                let factor = circleDiameter / 128;
                let width = osuTexture.getWidth() * factor;
                let height = osuTexture.getHeight() * factor;
    
                let spinnerBottom = new PIXI.Sprite(osuTexture.getBest());
                spinnerBottom.anchor.set(0.5, 0.5);
                spinnerBottom.width = width;
                spinnerBottom.height = height;
    
                this.spinnerBottom = spinnerBottom;
            }
    
            if (DRAWING_MODE === DrawingMode.Skin) {
                let osuTexture = gameState.currentGameplaySkin.textures["spinnerTop"];
                let factor = circleDiameter / 128;
                let width = osuTexture.getWidth() * factor;
                let height = osuTexture.getHeight() * factor;
    
                let spinnerTop = new PIXI.Sprite(osuTexture.getBest());
                spinnerTop.anchor.set(0.5, 0.5);
                spinnerTop.width = width;
                spinnerTop.height = height;
    
                this.spinnerTop = spinnerTop;
            }
    
            if (DRAWING_MODE === DrawingMode.Skin) {
                let osuTexture = gameState.currentGameplaySkin.textures["spinnerMiddle2"];
                let factor = circleDiameter / 128;
                let width = osuTexture.getWidth() * factor;
                let height = osuTexture.getHeight() * factor;
    
                let spinnerMiddle2 = new PIXI.Sprite(osuTexture.getBest());
                spinnerMiddle2.anchor.set(0.5, 0.5);
                spinnerMiddle2.width = width;
                spinnerMiddle2.height = height;
    
                this.spinnerMiddle2 = spinnerMiddle2;
            }
    
            if (DRAWING_MODE === DrawingMode.Skin) {
                let osuTexture = gameState.currentGameplaySkin.textures["spinnerMiddle"];
                let factor = circleDiameter / 128;
                let width = osuTexture.getWidth() * factor;
                let height = osuTexture.getHeight() * factor;
    
                let spinnerMiddle = new PIXI.Sprite(osuTexture.getBest());
                spinnerMiddle.anchor.set(0.5, 0.5);
                spinnerMiddle.width = width;
                spinnerMiddle.height = height;
    
                this.spinnerMiddle = spinnerMiddle;
            }
        } else {
            if (DRAWING_MODE === DrawingMode.Skin) {
                let osuTexture = gameState.currentGameplaySkin.textures["spinnerApproachCircle"];
                let factor = circleDiameter / 128;
                let width = osuTexture.getWidth() * factor;
                let height = osuTexture.getHeight() * factor;
    
                let approachCircle = new PIXI.Sprite(osuTexture.getDynamic(Math.max(width, height)));
                approachCircle.anchor.set(0.5, 0.5);
                approachCircle.width = width;
                approachCircle.height = height;
    
                let wrapper = new PIXI.Container();
                wrapper.addChild(approachCircle);
    
                this.spinnerApproachCircle = wrapper;
            }

            if (DRAWING_MODE === DrawingMode.Skin) {
                let osuTexture = gameState.currentGameplaySkin.textures["spinnerBackground"];
                let factor = circleDiameter / 128 * 1.07;
                let width = osuTexture.getWidth() * factor;
                let height = osuTexture.getHeight() * factor;
    
                let spinnerBackground = new PIXI.Sprite(osuTexture.getBest());
                spinnerBackground.anchor.set(0.5, 0.5);
                spinnerBackground.width = width;
                spinnerBackground.height = height;
                spinnerBackground.tint = colorToHexNumber(gameState.currentGameplaySkin.config.colors.spinnerBackground);
    
                this.spinnerBackground = spinnerBackground;
            }
    
            this.spinnerMeterMask = new PIXI.Graphics();
            if (DRAWING_MODE === DrawingMode.Skin) {
                let osuTexture = gameState.currentGameplaySkin.textures["spinnerMeter"];
                let factor = circleDiameter / 128 * 1.07;
                let width = osuTexture.getWidth() * factor;
                let height = osuTexture.getHeight() * factor;
    
                let spinnerMeter = new PIXI.Sprite(osuTexture.getBest());
                spinnerMeter.anchor.set(0.5, 0.5);
                spinnerMeter.width = width;
                spinnerMeter.height = height;
                spinnerMeter.mask = this.spinnerMeterMask;
    
                this.spinnerMeter = spinnerMeter;
            }
    
            if (DRAWING_MODE === DrawingMode.Skin) {
                let osuTexture = gameState.currentGameplaySkin.textures["spinnerCircle"];
                let factor = circleDiameter / 128 * 1.07;
                let width = osuTexture.getWidth() * factor;
                let height = osuTexture.getHeight() * factor;
    
                let spinnerCircle = new PIXI.Sprite(osuTexture.getBest());
                spinnerCircle.anchor.set(0.5, 0.5);
                spinnerCircle.width = width;
                spinnerCircle.height = height;
    
                this.spinnerCircle = spinnerCircle;
            }
        }

        if (DRAWING_MODE === DrawingMode.Skin) {
            let osuTexture = gameState.currentGameplaySkin.textures["spinnerSpin"];
            let factor = circleDiameter / 128 * 1.2; // 1.2 determined emperically lmao
            let width = osuTexture.getWidth() * factor;
            let height = osuTexture.getHeight() * factor;

            let spinnerSpin = new PIXI.Sprite(osuTexture.getBest());
            spinnerSpin.anchor.set(0.5, 0.5);
            spinnerSpin.width = width;
            spinnerSpin.height = height;
            spinnerSpin.y = 198 * factor;

            this.spinnerSpin = spinnerSpin;
        }

        if (DRAWING_MODE === DrawingMode.Skin) {
            let osuTexture = gameState.currentGameplaySkin.textures["spinnerClear"];
            let factor = circleDiameter / 128 * 1.2; // 1.2 determined emperically lmao
            let width = osuTexture.getWidth() * factor;
            let height = osuTexture.getHeight() * factor;

            let spinnerClear = new PIXI.Sprite(osuTexture.getBest());
            spinnerClear.anchor.set(0.5, 0.5);
            spinnerClear.width = width;
            spinnerClear.height = height;

            let wrapper = new PIXI.Container();
            wrapper.addChild(spinnerClear);
            wrapper.y = -154 * factor;

            this.spinnerClear = wrapper;
        }

        let spinnerBonus = new SpriteNumber({
            textures: gameState.currentGameplaySkin.scoreNumberTextures,
            scaleFactor: circleDiameter / 128 * 2,
            horizontalAlign: "center",
            verticalAlign: "middle",
            overlap: gameState.currentGameplaySkin.config.fonts.scoreOverlap
        });
        spinnerBonus.container.y = circleDiameter / 128 * 1.2 * 198;
        this.spinnerBonus = spinnerBonus;

        if (this.isNewStyle) {
            this.scalablePart = new PIXI.Container();
            this.scalablePart.addChild(this.spinnerGlow);
            this.scalablePart.addChild(this.spinnerBottom);
            this.scalablePart.addChild(this.spinnerTop);
            this.scalablePart.addChild(this.spinnerMiddle2);
            this.scalablePart.addChild(this.spinnerMiddle);

            this.componentContainer.addChild(this.scalablePart);
        } else {
            this.componentContainer.addChild(this.spinnerBackground);
            this.componentContainer.addChild(this.spinnerMeter);
            this.componentContainer.addChild(this.spinnerMeterMask);
            this.componentContainer.addChild(this.spinnerCircle);
            this.componentContainer.addChild(this.spinnerApproachCircle);
        }
        
        this.componentContainer.addChild(this.spinnerSpin);
        this.componentContainer.addChild(this.spinnerClear);
        this.componentContainer.addChild(this.spinnerBonus.container);

        this.container.addChild(this.componentContainer);
    }

    show(currentTime: number) {
        mainHitObjectContainer.addChildAt(this.container, 0);

        this.position();
        this.update(currentTime);
    }

    position() {
        // Position it in the center
        this.componentContainer.x = gameState.currentPlay.toScreenCoordinatesX(this.x);
        this.componentContainer.y = gameState.currentPlay.toScreenCoordinatesY(this.y);
    }

    update(currentTime: number) {
        if (currentTime >= this.endTime + SPINNER_FADE_OUT_TIME) {
            this.renderFinished = true;
            return;
        }

        if (currentTime < this.startTime) {
            let fadeInCompletion = (currentTime - (this.startTime - SPINNER_FADE_IN_TIME)) / SPINNER_FADE_IN_TIME;
            fadeInCompletion = MathUtil.clamp(fadeInCompletion, 0, 1);
            this.container.alpha = fadeInCompletion;

            let spinTextFadeInCompletion = (currentTime - (this.startTime - SPIN_TEXT_FADE_IN_TIME)) / SPIN_TEXT_FADE_IN_TIME;
            spinTextFadeInCompletion = MathUtil.clamp(spinTextFadeInCompletion, 0, 1);
            this.spinnerSpin.alpha = spinTextFadeInCompletion;
        } else if (currentTime >= this.endTime) {
            let fadeOutCompletion = (currentTime - this.endTime) / SPINNER_FADE_OUT_TIME;
            fadeOutCompletion = MathUtil.clamp(fadeOutCompletion, 0, 1);
            this.container.alpha = 1 - fadeOutCompletion;
        } else {
            this.container.alpha = 1;
            // Here we're currently in the active part of the spinner

            let spinnerSpinAlpha = 1;
            if (this.spinnerSpinFadeOutStart !== null) {
                let completion = (currentTime -  this.spinnerSpinFadeOutStart) / SPIN_TEXT_FADE_OUT_TIME;
                completion = MathUtil.clamp(completion, 0, 1);
                spinnerSpinAlpha = 1 - completion;
            }

            this.spinnerSpin.alpha = spinnerSpinAlpha;
        }
    
        let completion = (currentTime - this.startTime) / this.duration;
        completion = MathUtil.clamp(completion, 0, 1);
        let clearCompletion = this.getSpinsSpun() / this.requiredSpins;
        clearCompletion = MathUtil.clamp(clearCompletion, 0, 1);

        if (this.isNewStyle) {
            this.spinnerBottom.rotation = this.spinnerAngle * 0.2;
            this.spinnerTop.rotation = this.spinnerAngle * 0.5;
            this.spinnerMiddle2.rotation = this.spinnerAngle * 1.0;

            (this.spinnerMiddle as PIXI.Sprite).tint = colorToHexNumber(lerpColors(Colors.White, Colors.Red, completion));

            this.spinnerGlow.alpha = clearCompletion;

            let totalScale = MathUtil.lerp(1, 1.25, MathUtil.ease(EaseType.EaseOutQuad, clearCompletion));
            this.scalablePart.scale.set(totalScale);

            let glowCompletion = this.glowInterpolator.getCurrentValue(currentTime);
            (this.spinnerGlow as PIXI.Sprite).tint = colorToHexNumber(lerpColors(Colors.White, SPINNER_GLOW_TINT, glowCompletion));
        } else {
            this.spinnerApproachCircle.scale.set(MathUtil.lerp(2.0, 0.1, completion)); // Quote Google docs: "starts at 200% of its size and shrinks down to 10%"

            this.spinnerCircle.rotation = this.spinnerAngle;

            // Do meter mask stuff:
            {
                let mask = this.spinnerMeterMask;

                let meterWidth = this.spinnerMeter.width;
                let meterHeight = this.spinnerMeter.height;

                let completion = Math.floor(clearCompletion * SPINNER_METER_STEPS) / SPINNER_METER_STEPS; // Quantize this shit

                mask.clear();
                mask.beginFill(0xFF3300);
                mask.drawRect(-meterWidth/2, -meterHeight/2 + (1 - completion)*meterHeight, meterWidth, completion * meterHeight);
                mask.endFill();
            }
        }

        let clearTextAnimationCompletion = this.clearTextInterpolator.getCurrentValue(currentTime);
        let parabola = 1.94444 * clearTextAnimationCompletion**2 - 2.69444 * clearTextAnimationCompletion + 1.75;
        this.spinnerClear.scale.set(parabola);
        this.spinnerClear.alpha = clearTextAnimationCompletion;

        let bonusSpinsCompletion = this.bonusSpinsInterpolator.getCurrentValue(currentTime);
        this.spinnerBonus.container.scale.set(MathUtil.lerp(1.0, 0.666, bonusSpinsCompletion));
        this.spinnerBonus.container.alpha = 1 - bonusSpinsCompletion;

        if (this.spinSoundEmitter && this.lastInputTime !== null && (currentTime - this.lastInputTime) >= 100) { // After 100ms of receiving no input, stop the spinning sound.
            this.spinSoundEmitter.stop();
        }
    }

    score() {
        let currentPlay = gameState.currentPlay;

        let spinsSpun = this.getSpinsSpun();
        if (spinsSpun < this.requiredSpins) {
            currentPlay.scoreCounter.add(0, false, true, true, this, this.endTime);
        } else {
            let judgement = (() => {
                if (spinsSpun >= this.requiredSpins + 0.5) {
                    return 300;
                } else if (spinsSpun >= this.requiredSpins + 0.25) {
                    return 100;
                } else {
                    return 50;
                }
            })();

            currentPlay.scoreCounter.add(judgement, false, true, true, this, this.endTime);
            if (judgement !== 0) gameState.currentGameplaySkin.playHitSound(this.hitSound);
        }

        if (this.spinSoundEmitter) this.spinSoundEmitter.stop();
    }

    getSpinsSpun() {
        return this.totalRadiansSpun / (Math.PI * 2);
    }

    handleMouseMove(osuMouseCoordinates: Point, currentTime: number) {
        if (currentTime < this.startTime || currentTime >= this.endTime) return;

        let pressed = anyGameButtonIsPressed();

        if (!pressed) {
            if (this.lastSpinPosition !== null) {
                this.lastSpinPosition = null;
                this.lastInputTime = null;
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
        let angle1 = Math.atan2(p1.y - PLAYFIELD_DIMENSIONS.height/2, p1.x - PLAYFIELD_DIMENSIONS.width/2),
            angle2 = Math.atan2(p2.y - PLAYFIELD_DIMENSIONS.height/2, p2.x - PLAYFIELD_DIMENSIONS.width/2);
        let theta = MathUtil.getNormalizedAngleDelta(angle1, angle2);
        let timeDelta = (currentTime - this.lastInputTime) / 1000; // In seconds
        if (timeDelta <= 0) return; // WTF? TODO!
        // Ergh. current time can jump backwards. fuuuck

        /*
        // If we change direction, stop immediately
        if (Math.sign(this.lastAngularVelocity) !== Math.sign(theta)) {
            this.lastAngularVelocity = 0;
        }

        let absTheta = Math.abs(theta);
        let absThetaPerSecond = absTheta /= timeDelta;
        let lastAbs = Math.abs(this.lastAngularVelocity);

        if (false && absThetaPerSecond < lastAbs) {
            let diff = lastAbs - absThetaPerSecond;
            let newAbsoluteVelocity = lastAbs - diff / 3;
            this.lastAngularVelocity = newAbsoluteVelocity * Math.sign(theta);
            console.log("Whackass!");
        } else {
            // 20 radians per second threshold
            let dist = MathUtil.clamp(lastAbs / 40, 0, 1);
            console.log(dist);

            let newAbsoluteVelocity = Math.min(lastAbs + timeDelta * Math.PI*0.05, absThetaPerSecond);

            let weighted = (1 - dist) * newAbsoluteVelocity + dist * absThetaPerSecond;

            //newAbsoluteVelocity = absThetaPerSecond;
            this.lastAngularVelocity = weighted * Math.sign(theta);
        }
        
        this.spinnerAngle += this.lastAngularVelocity * timeDelta;
        */

        // ALL POINTLESS!

        this.spin(theta, currentTime);

        //this.spinnerAngle += theta;
        //this.totalRadiansSpun += Math.abs(theta);

        //console.log(this.lastAngularVelocity);

        this.lastSpinPosition = osuMouseCoordinates;
        //this.lastInputTime = currentTime;
    }

    spin(radians: number, currentTime: number) {
        if (currentTime < this.startTime || currentTime >= this.endTime) return;

        let currentPlay = gameState.currentPlay;

        if (this.lastInputTime === null) {
            this.lastInputTime = currentTime;
            return;
        }

        let timeDif = currentTime - this.lastInputTime;
        if (timeDif <= 0) return;
        
        let angle = Math.sign(radians) * Math.min(Math.abs(radians), 0.05 * timeDif); // MAX 0.05 radians / ms, 'cause 477 limit!
        
        let prevSpinsSpun = this.getSpinsSpun();

        this.spinnerAngle += angle;
        this.totalRadiansSpun += Math.abs(angle);

        let spinsSpunNow = this.getSpinsSpun();
        let wholeDif = Math.floor(spinsSpunNow) - Math.floor(prevSpinsSpun);
        if (wholeDif > 0) {
            // Give 100 raw score for every spin
            currentPlay.scoreCounter.add(wholeDif * 100, true, false, false, this, currentTime);
        }
        if (spinsSpunNow >= this.requiredSpins && !this.cleared) {
            this.cleared = true;
            this.clearTextInterpolator.start(currentTime);
        }
        let bonusSpins = Math.floor(spinsSpunNow - this.requiredSpins);
        if (bonusSpins > 0 && bonusSpins > this.bonusSpins) {
            let dif = bonusSpins - this.bonusSpins;
            currentPlay.scoreCounter.add(dif * 1000, true, false, false, this, currentTime)

            this.bonusSpins = bonusSpins;
            //this.bonusSpinsElement.text = String(this.bonusSpins * 1000);
            this.spinnerBonus.setValue(this.bonusSpins * 1000);
            this.bonusSpinsInterpolator.start(currentTime);
            this.glowInterpolator.start(currentTime);

            gameState.currentGameplaySkin.sounds[HitSoundType.SpinnerBonus].play(this.bonusSoundVolume);
        }

        let spinCompletion = spinsSpunNow / this.requiredSpins;
        if (spinCompletion >= 0.25 && this.spinnerSpinFadeOutStart === null) {
            this.spinnerSpinFadeOutStart = currentTime;
        }

        if (this.spinSoundEmitter) {
            if (!this.spinSoundEmitter.isPlaying()) this.spinSoundEmitter.start();

            this.spinSoundEmitter.setPlaybackRate(Math.min(2, spinCompletion*0.75 + 0.5));
        }

        this.lastInputTime = currentTime;
    }

    remove() {
        mainHitObjectContainer.removeChild(this.container);
    }

    addPlayEvents(playEventArray: PlayEvent[]) {
        playEventArray.push({
            type: PlayEventType.SpinnerEnd,
            hitObject: this,
            time: this.endTime
        });
    }

    handleButtonPress() {return false;}
}