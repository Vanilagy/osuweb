import { Slider } from "../datamodel/slider";
import { SliderCurve } from "./slider_curve";
import { SliderCurveEmpty } from "./slider_curve_empty";
import { SliderCurvePerfect } from "./slider_curve_perfect";
import { SliderCurveBézier } from "./slider_curve_bézier";
import { MathUtil, EaseType } from "../util/math_util";
import { Point, interpolatePointInPointArray, pointDistance } from "../util/point";
import { gameState } from "./game_state";
import { SLIDER_TICK_APPEARANCE_ANIMATION_DURATION, FOLLOW_CIRCLE_THICKNESS_FACTOR, HIT_OBJECT_FADE_OUT_TIME, CIRCLE_BORDER_WIDTH, DRAWING_MODE, DrawingMode } from "../util/constants";
import { colorToHexNumber } from "../util/graphics_util";
import { PlayEvent, PlayEventType } from "./play_events";
import { ScoringValue } from "./score";
import { assert, last } from "../util/misc_util";
import { accuracyMeter } from "./hud";
import { HeadedDrawableHitObject, SliderScoring, getDefaultSliderScoring } from "./headed_drawable_hit_object";
import { HitCirclePrimitiveFadeOutType, HitCirclePrimitive, HitCirclePrimitiveType } from "./hit_circle_primitive";
import { HitSoundInfo } from "./skin";
import { SoundEmitter } from "../audio/sound_emitter";

export const FOLLOW_CIRCLE_HITBOX_CS_RATIO = 308/128; // Based on a comment on the osu website: "Max size: 308x308 (hitbox)"
const FOLLOW_CIRCLE_SCALE_IN_DURATION = 200;
const FOLLOW_CIRCLE_SCALE_OUT_DURATION = 200;
const FOLLOW_CIRCLE_PULSE_DURATION = 200;
const MAX_SLIDER_BALL_SLIDER_VELOCITY = 0.25; // In osu pixels per millisecond. This variable is used to cap the rotation speed on slider balls for very fast sliders.

export interface SliderTimingInfo {
    msPerBeat: number,
    msPerBeatMultiplier: number,
    sliderVelocity: number
}

export class DrawableSlider extends HeadedDrawableHitObject {
    public baseSprite: PIXI.Sprite;
    public baseCtx: CanvasRenderingContext2D;
    public overlayContainer: PIXI.Container;
    public sliderBall: SliderBall;
    public sliderTickContainer: PIXI.Container;
    public followCircle: PIXI.Container;
    public sliderEnds: HitCirclePrimitive[];
    public hitCirclePrimitiveContainer: PIXI.Container;
    public reverseArrowContainer: PIXI.Container;

    public duration: number;
    public complete: boolean;
    public reductionFactor: number;
    public curve: SliderCurve;
    public sliderWidth: number = 0;
    public sliderHeight: number = 0;
    public minX: number = 0;
    public maxX: number = 0;
    public minY: number = 0;
    public maxY: number = 0;
    public sliderBodyRadius: number;
    public timingInfo: SliderTimingInfo;
    public hitObject: Slider;
    public sliderTickCompletions: number[];
    public scoring: SliderScoring;
    public hitSounds: HitSoundInfo[];
    public tickSounds: HitSoundInfo[];
    public slideEmitters: SoundEmitter[];

    constructor(hitObject: Slider) {
        super(hitObject);
    }

    init() {
        this.reductionFactor = 0.92;
        this.curve = null;
        this.complete = true;

        this.endTime = this.startTime + this.hitObject.repeat * this.hitObject.length / this.timingInfo.sliderVelocity;
        this.duration = this.endTime - this.startTime;

        this.renderStartTime = this.startTime - gameState.currentPlay.ARMs;

        if (this.hitObject.sections.length === 0) {
            this.curve = new SliderCurveEmpty(this);
        } else if (this.hitObject.sections[0].type === "perfect") {
            this.curve = new SliderCurvePerfect(this);

            (<SliderCurvePerfect>this.curve).calculateValues(false);
        } else {
            this.curve = new SliderCurveBézier(this, false);
        }

        if (this.hitObject.repeat % 2 === 0) {
            this.endPoint = this.startPoint;
        } else {
            this.endPoint = this.getPosFromPercentage(1) as Point;
        }

        this.scoring = getDefaultSliderScoring();
    }

    toCtxCoord(pos: Point): Point {
        let { pixelRatio, circleDiameter } = gameState.currentPlay;

        return {
            x: (pos.x - this.minX) * pixelRatio + circleDiameter/2,
            y: (pos.y - this.minY) * pixelRatio + circleDiameter/2
        };
    }

    draw() {
        super.draw();

        let { circleDiameter, pixelRatio, ARMs } = gameState.currentPlay;
    
        this.head = new HitCirclePrimitive({
            fadeInStart: this.startTime - ARMs,
            comboInfo: this.comboInfo,
            hasApproachCircle: true,
            hasNumber: true,
            type: HitCirclePrimitiveType.SliderHead
        });

        let ctxStartPos = this.toCtxCoord({x: this.startPoint.x, y: this.startPoint.y});
        let otherPoint = this.getPosFromPercentage(1);
        let ctxEndPos = this.toCtxCoord({x: otherPoint.x, y: otherPoint.y});

        this.head.container.x = ctxStartPos.x;
        this.head.container.y = ctxStartPos.y;

        this.hitCirclePrimitiveContainer = new PIXI.Container();
        this.hitCirclePrimitiveContainer.addChild(this.head.container);
        this.reverseArrowContainer = new PIXI.Container();

        this.sliderEnds = [];
        let msPerRepeatCycle = this.hitObject.length / this.timingInfo.sliderVelocity;
        for (let i = 0; i < this.hitObject.repeat; i++) {
            let pos = (i % 2 === 0)? ctxEndPos : ctxStartPos;
            
            let fadeInStart: number;
            if (i === 0) {
                fadeInStart = this.startTime - ARMs;
            } else {
                fadeInStart = this.startTime + (i-1) * msPerRepeatCycle;
            }

            let reverseArrowAngle: number;
            if (i < this.hitObject.repeat-1) {
                if (i % 2 === 0) {
                    let angle = this.curve.getAngleFromPercentage(1);
                    angle = MathUtil.constrainRadians(angle + Math.PI); // Turn it by 180°

                    reverseArrowAngle = angle;
                } else {
                    reverseArrowAngle = this.curve.getAngleFromPercentage(0);
                }
            }

            let primitive = new HitCirclePrimitive({
                fadeInStart: fadeInStart,
                comboInfo: this.comboInfo,
                hasApproachCircle: false,
                hasNumber: false,
                reverseArrowAngle: reverseArrowAngle,
                type: HitCirclePrimitiveType.SliderEnd
            });

            primitive.container.x = pos.x;
            primitive.container.y = pos.y;

            this.sliderEnds.push(primitive);
            this.hitCirclePrimitiveContainer.addChildAt(primitive.container, 0);

            if (primitive.reverseArrow !== null) {
                primitive.reverseArrow.x = pos.x;
                primitive.reverseArrow.y = pos.y;
                this.reverseArrowContainer.addChildAt(primitive.reverseArrow, 0);
            }
        }

        this.sliderWidth = this.maxX - this.minX;
        this.sliderHeight = this.maxY - this.minY;
        this.sliderBodyRadius = circleDiameter/2 * (this.reductionFactor - CIRCLE_BORDER_WIDTH);

        let canvas = document.createElement('canvas');
        canvas.setAttribute('width', String(Math.ceil(this.sliderWidth * pixelRatio + circleDiameter)));
        canvas.setAttribute('height', String(Math.ceil(this.sliderHeight * pixelRatio + circleDiameter)));
        let ctx = canvas.getContext('2d');
        this.baseCtx = ctx;
        this.curve.render(1.0);
        this.baseSprite = new PIXI.Sprite(PIXI.Texture.from(canvas));

        this.sliderBall = new SliderBall(this);
        this.sliderBall.container.visible = false;

        if (DRAWING_MODE === DrawingMode.Procedural) {
            let followCircle = new PIXI.Graphics();
            let thickness = FOLLOW_CIRCLE_THICKNESS_FACTOR * circleDiameter;
            followCircle.lineStyle(thickness, 0xFFFFFF);
            followCircle.drawCircle(0, 0, (circleDiameter - thickness) / 2);

            this.followCircle = followCircle;
        } else if (DRAWING_MODE === DrawingMode.Skin) {
            let followCircle = new PIXI.Sprite(gameState.currentGameplaySkin.textures["followCircle"].getDynamic(circleDiameter * FOLLOW_CIRCLE_HITBOX_CS_RATIO));
            followCircle.anchor.set(0.5, 0.5);

            this.followCircle = followCircle;
        }
        this.followCircle.visible = false;

        this.sliderTickContainer = new PIXI.Container();
        for (let i = 0; i < this.sliderTickCompletions.length; i++) {
            let completion = this.sliderTickCompletions[i];
            if (completion >= 1) break;

            let tickElement: PIXI.Container;
            if (DRAWING_MODE === DrawingMode.Procedural) {
                let graphics = new PIXI.Graphics();

                graphics.beginFill(0xFFFFFF);
                graphics.drawCircle(0, 0, circleDiameter * 0.038);
                graphics.endFill();

                tickElement = graphics;
            } else if (DRAWING_MODE === DrawingMode.Skin) {
                let osuTexture = gameState.currentGameplaySkin.textures["sliderTick"];

                let factor = circleDiameter / 128;
                let width = osuTexture.getWidth() * factor;
                let height = osuTexture.getHeight() * factor;

                let sprite = new PIXI.Sprite(osuTexture.getDynamic(Math.max(width, height)));
                sprite.anchor.set(0.5, 0.5);
                sprite.width = width;
                sprite.height = height;

                let wrapper = new PIXI.Container();
                wrapper.addChild(sprite);

                tickElement = wrapper;
            }

            let sliderTickPos = this.toCtxCoord(this.getPosFromPercentage(MathUtil.reflect(completion)));

            tickElement.x = sliderTickPos.x;
            tickElement.y = sliderTickPos.y;

            this.sliderTickContainer.addChild(tickElement);
        }

        this.overlayContainer = new PIXI.Container();
        if (this.sliderTickCompletions.length > 0) this.overlayContainer.addChild(this.sliderTickContainer);
        this.overlayContainer.addChild(this.sliderBall.container);
        this.overlayContainer.addChild(this.followCircle);

        this.container.addChild(this.baseSprite);
        this.container.addChild(this.hitCirclePrimitiveContainer);
        this.container.addChild(this.reverseArrowContainer);
        this.container.addChild(this.overlayContainer);
    }

    position() {
        super.position(); // Haha, superposition. Yes. This joke is funny and not funny at the same time. Until observed, of course.

        let { circleDiameterOsuPx } = gameState.currentPlay;

        this.container.x = gameState.currentPlay.toScreenCoordinatesX(this.minX - circleDiameterOsuPx/2);
        this.container.y = gameState.currentPlay.toScreenCoordinatesY(this.minY - circleDiameterOsuPx/2);
    }

    update(currentTime: number) {
        if (currentTime > this.endTime + HIT_OBJECT_FADE_OUT_TIME) {
            this.renderFinished = true;
            return;
        }

        this.updateHeadElements(currentTime);
        let fadeInCompletion = this.head.getFadeInCompletion(currentTime);

        if (currentTime < this.endTime) {
            this.baseSprite.alpha = fadeInCompletion;
            this.overlayContainer.alpha = fadeInCompletion;
        } else {
            let fadeOutCompletion = (currentTime - (this.endTime)) / HIT_OBJECT_FADE_OUT_TIME;
            fadeOutCompletion = MathUtil.clamp(fadeOutCompletion, 0, 1);
            fadeOutCompletion = MathUtil.ease(EaseType.EaseOutQuad, fadeOutCompletion);

            let alpha = 1 - fadeOutCompletion;
            
            this.baseSprite.alpha = alpha;
            this.overlayContainer.alpha = alpha;
        }

        this.renderSubelements(currentTime);
    }

    remove() {
        super.remove();

        //this.sliderBall.destroy();
        this.sliderTickContainer.destroy();
    }

    addPlayEvents(playEventArray: PlayEvent[]) {
        super.addPlayEvents(playEventArray);

        let sliderEndCheckTime = this.startTime + Math.max(this.duration - 36, this.duration/2); // "Slider ends are a special case and checked exactly 36ms before the end of the slider (unless the slider is <72ms in duration, then it checks exactly halfway time wise)." https://www.reddit.com/r/osugame/comments/9rki8o/how_are_slider_judgements_calculated/
        let sliderEndCheckCompletion = (this.timingInfo.sliderVelocity * (sliderEndCheckTime - this.startTime)) / this.hitObject.length;
        sliderEndCheckCompletion = MathUtil.reflect(sliderEndCheckCompletion);
        let sliderEndCheckPosition = this.getPosFromPercentage(sliderEndCheckCompletion);

        playEventArray.push({
            type: PlayEventType.SliderEndCheck,
            hitObject: this,
            time: sliderEndCheckTime,
            position: sliderEndCheckPosition
        });
        
        playEventArray.push({
            type: PlayEventType.SliderEnd,
            hitObject: this,
            time: this.endTime,
            hitSound: last(this.hitSounds)
        });

        // Add repeats
        if (this.hitObject.repeat > 1) {
            let repeatCycleDuration = (this.endTime - this.startTime) / this.hitObject.repeat;

            for (let i = 1; i < this.hitObject.repeat; i++) {
                let position = (i % 2 === 0)? this.startPoint : this.endPoint;

                playEventArray.push({
                    type: PlayEventType.SliderRepeat,
                    hitObject: this,
                    time: this.startTime + i * repeatCycleDuration,
                    position: position,
                    hitSound: this.hitSounds[i]
                });
            }
        }

        // Add ticks
        for (let i = 0; i < this.sliderTickCompletions.length; i++) {
            let tickCompletion = this.sliderTickCompletions[i];

            // Time that the tick should be hit, relative to the slider start time
            let time = tickCompletion * this.hitObject.length / this.timingInfo.sliderVelocity;
            let position = this.getPosFromPercentage(MathUtil.reflect(tickCompletion));

            playEventArray.push({
                type: PlayEventType.SliderTick,
                hitObject: this,
                time: this.startTime + time,
                position: position,
                hitSound: this.tickSounds[i]
            });
        }
    }

    beginSliderSlideSound() {
        for (let emitter of this.slideEmitters) {
            emitter.start();
        }
    }

    stopSliderSlideSound() {
        for (let emitter of this.slideEmitters) {
            emitter.stop();
        }
    }

    score() {
        let total = 0;
        if (this.scoring.head.hit !== ScoringValue.Miss) total++;
        if (this.scoring.end) total++;
        total += this.scoring.ticks;
        total += this.scoring.repeats;

        let fraction = total / (2 + this.sliderTickCompletions.length + (this.hitObject.repeat - 1));
        assert(fraction >= 0 && fraction <= 1);

        let resultingRawScore = (() => {
            if (fraction === 1) {
                return 300;
            } else if (fraction >= 0.5) {
                return 100;
            } else if (fraction > 0) {
                return 50;
            }
            return 0;
        })();

        gameState.currentPlay.scoreCounter.add(resultingRawScore, false, false, true, this, this.endTime);
    }

    hitHead(time: number) {
        if (this.scoring.head.hit !== ScoringValue.NotHit) return;
        
        let { processedBeatmap, scoreCounter } = gameState.currentPlay;

        let timeInaccuracy = time - this.startTime;
        let hitDelta = Math.abs(timeInaccuracy);
        let judgement = processedBeatmap.beatmap.difficulty.getJudgementForHitDelta(hitDelta);

        this.scoring.head.hit = judgement;
        this.scoring.head.time = time;

        let score = (judgement === ScoringValue.Miss)? 0 : ScoringValue.SliderHead;

        scoreCounter.add(score, true, true, false, this, time);
        if (judgement !== 0) {
            gameState.currentGameplaySkin.playHitSound(this.hitSounds[0]);

            this.head.setFadeOut({
                type: HitCirclePrimitiveFadeOutType.ScaleOut,
                time: time
            });
        } else {
            this.head.setFadeOut({
                type: HitCirclePrimitiveFadeOutType.FadeOut,
                time: time
            });
        }

        accuracyMeter.addAccuracyLine(timeInaccuracy, time);
    }

    getPosFromPercentage(percent: number) : Point {
        if (this.curve instanceof SliderCurveBézier) {
            return interpolatePointInPointArray(this.curve.equalDistancePoints, percent);
        } else if (this.curve instanceof SliderCurvePerfect) {
            let angle = this.curve.startingAngle + this.curve.angleDifference * percent;

            return {
                x: this.curve.centerPos.x + this.curve.radius * Math.cos(angle),
                y: this.curve.centerPos.y + this.curve.radius * Math.sin(angle)
            };
        } else if (this.curve instanceof SliderCurveEmpty) {
            // TODO
            console.warn("Tried to access position from empty slider curve. Empty. Slider. Curve. What's that?");
        } else {
            throw new Error("Tried to get position on non-existing slider curve.");
        }
    }

    applyStackPosition() {
        super.applyStackPosition();

        if (true /* This was if(fullCalc) before */) {
            this.minX += this.stackHeight * -4;
            this.minY += this.stackHeight * -4;
            this.maxX += this.stackHeight * -4;
            this.maxY += this.stackHeight * -4;

            this.curve.applyStackPosition();
        }
    }

    private getLowestTickCompletionFromCurrentRepeat(completion: number) {
        let currentRepeat = Math.floor(completion);
        for (let i = 0; i < this.sliderTickCompletions.length; i++) {
            if (this.sliderTickCompletions[i] > currentRepeat) {
                return this.sliderTickCompletions[i];
            }
        }
    }

    private renderSubelements(currentTime: number) {
        let completion = 0;
        let currentSliderTime = currentTime - this.hitObject.time;

        completion = (this.timingInfo.sliderVelocity * currentSliderTime) / this.hitObject.length;
        completion = MathUtil.clamp(completion, 0, this.hitObject.repeat);

        this.renderSliderEnds(completion, currentTime);
        this.renderSliderBall(completion, currentTime, currentSliderTime);
        if (this.sliderTickCompletions.length > 0) this.renderSliderTicks(completion, currentSliderTime);
    }

    private renderSliderEnds(completion: number, currentTime: number) {
        for (let i = 0; i < this.sliderEnds.length; i++) {
            let sliderEnd = this.sliderEnds[i];

            if (completion >= (i+1) && !sliderEnd.isFadingOut()) {
                let time = this.startTime + (i+1) * this.hitObject.length / this.timingInfo.sliderVelocity;

                sliderEnd.setFadeOut({
                    type: HitCirclePrimitiveFadeOutType.ScaleOut,
                    time: time
                });
            } 

            sliderEnd.update(currentTime);
        }
    }

    private renderSliderBall(completion: number, currentTime: number, currentSliderTime: number) {
        if (completion === 0) return;

        let { circleDiameter } = gameState.currentPlay;

        let sliderBallPos = this.toCtxCoord(this.getPosFromPercentage(MathUtil.reflect(completion)));

        if (currentTime < this.endTime) {
            this.sliderBall.container.visible = true;
            this.sliderBall.container.x = sliderBallPos.x;
            this.sliderBall.container.y = sliderBallPos.y;
            this.sliderBall.base.rotation = this.curve.getAngleFromPercentage(MathUtil.reflect(completion));

            let osuTex = gameState.currentGameplaySkin.textures["sliderBall"];
            let frameCount = osuTex.getAnimationFrameCount();
            if (frameCount > 1) {
                let velocityRatio = Math.min(1, MAX_SLIDER_BALL_SLIDER_VELOCITY/this.timingInfo.sliderVelocity);
                let rolledDistance = this.hitObject.length * velocityRatio * MathUtil.reflect(completion);
                let radians = rolledDistance / 15;
                let currentFrame = Math.floor(frameCount * (radians % (Math.PI/2) / (Math.PI/2))); // TODO: Is this correct for all skins?

                let sprite = this.sliderBall.base as PIXI.Sprite;
                let factor = circleDiameter / 128;
                let width = osuTex.getWidth() * factor;
                let height = osuTex.getHeight() * factor;

                sprite.texture = osuTex.getDynamic(Math.max(width, height), currentFrame);
                sprite.width = width;
                sprite.height = height;
            }

            if (gameState.currentGameplaySkin.config.general.sliderBallFlip) {
                // Flip the scale when necessary
                if      (completion % 2 <= 1 && this.sliderBall.base.scale.x < 0) this.sliderBall.base.scale.x *= -1;
                else if (completion % 2 > 1  && this.sliderBall.base.scale.x > 0) this.sliderBall.base.scale.x *= -1;
            }
        } else {
            // The slider ball disappears upon slider completion
            this.sliderBall.container.visible = false;
        }

        this.followCircle.visible = true;
        this.followCircle.x = sliderBallPos.x;
        this.followCircle.y = sliderBallPos.y;

        let enlargeCompletion = (currentTime - this.startTime) / FOLLOW_CIRCLE_SCALE_IN_DURATION;
        enlargeCompletion = MathUtil.clamp(enlargeCompletion, 0, 1);
        enlargeCompletion = MathUtil.ease(EaseType.EaseOutQuad, enlargeCompletion);

        let followCircleSizeFactor = 0;
        followCircleSizeFactor += (2 - 1) * enlargeCompletion; // Enlarge to 2 on start

        let biggestCurrentTickCompletion = -Infinity;
        let biggestCurrentRepeatCompletion = -Infinity;
        for (let c of this.sliderTickCompletions) {
            if (c > completion) break;
            biggestCurrentTickCompletion = c;
        }
        biggestCurrentRepeatCompletion = Math.floor(completion);
        if (biggestCurrentRepeatCompletion === 0 || biggestCurrentRepeatCompletion === this.hitObject.repeat)
            biggestCurrentRepeatCompletion = null; // We don't want the "pulse" on slider beginning and end, only on hitting repeats

        outer:
        if (biggestCurrentTickCompletion !== null || biggestCurrentRepeatCompletion !== null) {
            let biggestCompletion = Math.max(biggestCurrentTickCompletion, biggestCurrentRepeatCompletion);
            if (biggestCompletion === -Infinity) break outer; // Breaking ifs, yay! Tbh, it's a useful thing.

            // Time of the slider tick or the reverse, relative to the slider start time
            let time = biggestCompletion * this.hitObject.length / this.timingInfo.sliderVelocity;

            let pulseFactor = (currentSliderTime - time) / FOLLOW_CIRCLE_PULSE_DURATION;
            pulseFactor = 1 - MathUtil.ease(EaseType.EaseOutQuad, MathUtil.clamp(pulseFactor, 0, 1));
            pulseFactor *= 0.20;

            followCircleSizeFactor += pulseFactor;
        }

        let shrinkCompletion = (currentTime - this.endTime) / FOLLOW_CIRCLE_SCALE_OUT_DURATION;
        shrinkCompletion = MathUtil.clamp(shrinkCompletion, 0, 1);
        shrinkCompletion = MathUtil.ease(EaseType.EaseOutQuad, shrinkCompletion);

        followCircleSizeFactor *= 1 * (1 - shrinkCompletion) + 0.75 * shrinkCompletion; // Shrink on end, to 1.5x
        followCircleSizeFactor += 1; // Base. Never get smaller than this.

        let followCircleOsuTexture = gameState.currentGameplaySkin.textures["followCircle"];
        let factor = circleDiameter / 128 * followCircleSizeFactor / 2;
        let width = followCircleOsuTexture.getWidth() * factor;
        let height = followCircleOsuTexture.getHeight() * factor;

        this.followCircle.width = width;
        this.followCircle.height = height;
    }

    private renderSliderTicks(completion: number, currentSliderTime: number) {
        let { ARMs, circleDiameter } = gameState.currentPlay;

        let lowestTickCompletionFromCurrentRepeat = this.getLowestTickCompletionFromCurrentRepeat(completion);
        let currentCycle = Math.floor(completion);

        for (let i = 0; i < this.sliderTickContainer.children.length; i++) {
            let tickElement = this.sliderTickContainer.children[i] as PIXI.Container;

            let tickCompletionIndex = this.sliderTickContainer.children.length * currentCycle;
            if (currentCycle % 2 === 0) {
                tickCompletionIndex += i;
            } else {
                tickCompletionIndex += this.sliderTickContainer.children.length - 1 - i;
            }
            let tickCompletion = this.sliderTickCompletions[tickCompletionIndex];

            if (tickCompletion <= completion) {
                tickElement.visible = false;
                continue;
            } else {
                tickElement.visible = true;
            }
            
            // The currentSliderTime at the beginning of the current repeat cycle
            let msPerRepeatCycle = this.hitObject.length / this.timingInfo.sliderVelocity;
            let currentRepeatTime = currentCycle * msPerRepeatCycle;
            // The time the tick should have fully appeared (animation complete), relative to the current repeat cycle
            // Slider velocity here is doubled, meaning the ticks appear twice as fast as the slider ball moves.
            let relativeTickTime = ((tickCompletion - lowestTickCompletionFromCurrentRepeat) * this.hitObject.length / (this.timingInfo.sliderVelocity * 2)) + SLIDER_TICK_APPEARANCE_ANIMATION_DURATION;
            // Sum both up to get the timing of the tick relative to the beginning of the whole slider:
            let tickTime = currentRepeatTime + relativeTickTime;
            
            // If we're in the first cycle, slider ticks appear a certain duration earlier. Experiments have lead to the value being subtracted here:
            if (currentCycle === 0) {
                tickTime -= ARMs * 2/3 - 100;
            }

            let animationStart = tickTime - SLIDER_TICK_APPEARANCE_ANIMATION_DURATION;
            let animationCompletion = (currentSliderTime - animationStart) / SLIDER_TICK_APPEARANCE_ANIMATION_DURATION;
            animationCompletion = MathUtil.clamp(animationCompletion, 0, 1);

            // Creates a bouncing scaling effect.
            let parabola = (-1.875 * animationCompletion*animationCompletion + 2.875 * animationCompletion);

            if (animationCompletion === 0) parabola = 0;
            if (animationCompletion >= 1) parabola = 1;

            tickElement.scale.set(parabola);
        }
    }
}

class SliderBall {
    public container: PIXI.Container;
    public base: PIXI.Container;
    public background: PIXI.Container;
    public spec: PIXI.Container;

    constructor(slider: DrawableSlider) {
        let { circleDiameter } = gameState.currentPlay;

        this.container = new PIXI.Container();

        if (DRAWING_MODE === DrawingMode.Procedural) {
            let sliderBall = new PIXI.Graphics();
            sliderBall = new PIXI.Graphics();
            sliderBall.beginFill(colorToHexNumber(slider.comboInfo.color));
            sliderBall.lineStyle(0);
            sliderBall.drawCircle(0, 0, slider.sliderBodyRadius);
            sliderBall.endFill();

            this.base = sliderBall;
        } else if (DRAWING_MODE === DrawingMode.Skin) {
            let osuTexture = gameState.currentGameplaySkin.textures["sliderBall"];

            let factor = circleDiameter / 128;
            let width = osuTexture.getWidth() * factor;
            let height = osuTexture.getHeight() * factor;
            let maxDimension = Math.max(width, height);

            let sliderBall = new PIXI.Sprite(osuTexture.getDynamic(maxDimension));
            sliderBall.anchor.set(0.5, 0.5);
            sliderBall.width = width;
            sliderBall.height = height;

            if (gameState.currentGameplaySkin.config.general.allowSliderBallTint) sliderBall.tint = colorToHexNumber(slider.comboInfo.color);
            else sliderBall.tint = colorToHexNumber(gameState.currentGameplaySkin.config.colors.sliderBall);

            this.base = sliderBall;

            if (!osuTexture.hasActualBase()) {
                let bgTexture = gameState.currentGameplaySkin.textures["sliderBallBg"];
                let tex = bgTexture.getDynamic(maxDimension);
                if (tex) {
                    let sliderBallBg = new PIXI.Sprite(tex);
                    sliderBallBg.anchor.set(0.5, 0.5);
                    sliderBallBg.width = width;
                    sliderBallBg.height = height;
                    sliderBallBg.tint = 0x000000; // Always tinted black.
    
                    this.background = sliderBallBg;
                }
            }

            let specTexture = gameState.currentGameplaySkin.textures["sliderBallSpec"];
            let tex = specTexture.getDynamic(maxDimension);
            if (tex) {
                let sliderBallSpec = new PIXI.Sprite(tex);
                sliderBallSpec.anchor.set(0.5, 0.5);
                sliderBallSpec.width = width;
                sliderBallSpec.height = height;
                sliderBallSpec.blendMode = PIXI.BLEND_MODES.ADD;

                this.spec = sliderBallSpec;
            }
        }

        if (this.background) this.container.addChild(this.background);
        this.container.addChild(this.base);
        if (this.spec) this.container.addChild(this.spec);
    }
}