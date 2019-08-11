import { Slider } from "../datamodel/slider";
import { SliderCurve } from "./slider_curve";
import { SliderCurveEmpty } from "./slider_curve_empty";
import { SliderCurvePassthrough } from "./slider_curve_passthrough";
import { SliderCurveBezier } from "./slider_curve_bezier";
import { MathUtil, EaseType } from "../util/math_util";
import { Point, interpolatePointInPointArray, pointDistance } from "../util/point";
import { gameState } from "./game_state";
import { SLIDER_TICK_APPEARANCE_ANIMATION_DURATION, FOLLOW_CIRCLE_THICKNESS_FACTOR, HIT_OBJECT_FADE_OUT_TIME, CIRCLE_BORDER_WIDTH, DRAWING_MODE, DrawingMode } from "../util/constants";
import { colorToHexNumber } from "../util/graphics_util";
import { PlayEvent, PlayEventType } from "./play_events";
import { normalHitSoundEffect } from "../audio/audio";
import { ScoringValue } from "./score";
import { assert } from "../util/misc_util";
import { accuracyMeter } from "./hud";
import { sliderBallTexture, followCircleTexture, reverseArrowTexture, sliderTickTexture } from "./skin";
import { HeadedDrawableHitObject, SliderScoring, getDefaultSliderScoring } from "./headed_drawable_hit_object";
import { HitCirclePrimitiveFadeOutType, HitCirclePrimitive, HitCirclePrimitiveType } from "./hit_circle_primitive";

const SLIDER_BALL_CS_RATIO = 1; // OLD COMMENT, WHEN THE NUMBER WAS 1.328125: As to how this was determined, I'm not sure, this was taken from the old osu!web source. Back then, I didn't know how toxic magic numbers were.
const FOLLOW_CIRCLE_CS_RATIO = 256/118; // Based on the resolution of the images for hit circles and follow circles.
const SLIDER_TICK_CS_RATIO = 16/118;
const FOLLOW_CIRCLE_SCALE_IN_DURATION = 200;
const FOLLOW_CIRCLE_SCALE_OUT_DURATION = 200;
const FOLLOW_CIRCLE_PULSE_DURATION = 200;

export interface SliderTimingInfo {
    msPerBeat: number,
    msPerBeatMultiplier: number,
    sliderVelocity: number
}

export class DrawableSlider extends HeadedDrawableHitObject {
    public baseSprite: PIXI.Sprite;
    public baseCtx: CanvasRenderingContext2D;
    public overlayContainer: PIXI.Container;
    public sliderBall: PIXI.Container;
    public reverseArrow: PIXI.Container;
    public sliderTickContainer: PIXI.Container;
    public followCircle: PIXI.Container;
    public sliderEnds: HitCirclePrimitive[];
    public hitCirclePrimitiveContainer: PIXI.Container;

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

    constructor(hitObject: Slider) {
        super(hitObject);
    }

    init() {
        this.reductionFactor = 0.92;
        this.curve = null;
        this.complete = true;

        this.endTime = this.startTime + this.hitObject.repeat * this.hitObject.length / this.timingInfo.sliderVelocity;

        this.renderStartTime = this.startTime - gameState.currentPlay.ARMs;

        if (this.hitObject.sections.length === 0) {
            this.curve = new SliderCurveEmpty(this);
        } else if (this.hitObject.sections[0].type === "passthrough") {
            this.curve = new SliderCurvePassthrough(this);

            (<SliderCurvePassthrough>this.curve).calculateValues(false);
        } else {
            this.curve = new SliderCurveBezier(this, false);
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
        }

        this.sliderWidth = this.maxX - this.minX;
        this.sliderHeight = this.maxY - this.minY;
        this.sliderBodyRadius = circleDiameter/2 * (this.reductionFactor - CIRCLE_BORDER_WIDTH);

        let canvas = document.createElement('canvas');
        canvas.setAttribute('width', String(Math.ceil(this.sliderWidth * pixelRatio + circleDiameter)));
        canvas.setAttribute('height', String(Math.ceil(this.sliderHeight * pixelRatio + circleDiameter)));
        let ctx = canvas.getContext('2d');
        this.baseCtx = ctx;
        this.curve.render(1);
        this.baseSprite = new PIXI.Sprite(PIXI.Texture.from(canvas));

        if (DRAWING_MODE === DrawingMode.Procedural) {
            let sliderBall = new PIXI.Graphics();
            sliderBall = new PIXI.Graphics();
            sliderBall.beginFill(colorToHexNumber(this.comboInfo.color));
            sliderBall.lineStyle(0);
            sliderBall.drawCircle(0, 0, this.sliderBodyRadius);
            sliderBall.endFill();

            this.sliderBall = sliderBall;
        } else if (DRAWING_MODE === DrawingMode.Skin) {
            let diameter = circleDiameter * SLIDER_BALL_CS_RATIO;

            let sliderBall = new PIXI.Sprite(sliderBallTexture);
            sliderBall.pivot.x = sliderBall.width / 2;
            sliderBall.pivot.y = sliderBall.height / 2;
            sliderBall.width = diameter;
            sliderBall.height = diameter;
            sliderBall.tint = colorToHexNumber(this.comboInfo.color);

            this.sliderBall = sliderBall;
        }
        this.sliderBall.visible = false;

        if (DRAWING_MODE === DrawingMode.Procedural) {
            let followCircle = new PIXI.Graphics();
            let thickness = FOLLOW_CIRCLE_THICKNESS_FACTOR * circleDiameter;
            followCircle.lineStyle(thickness, 0xFFFFFF);
            followCircle.drawCircle(0, 0, (circleDiameter - thickness) / 2);

            this.followCircle = followCircle;
        } else if (DRAWING_MODE === DrawingMode.Skin) {
            let followCircle = new PIXI.Sprite(followCircleTexture);
            followCircle.pivot.x = followCircle.width / 2;
            followCircle.pivot.y = followCircle.height / 2;
            followCircle.width = circleDiameter;
            followCircle.height = circleDiameter;

            this.followCircle = followCircle;
        }
        this.followCircle.visible = false;

        if (DRAWING_MODE === DrawingMode.Procedural) {
            let reverseArrow = new PIXI.Graphics();
            let triangleRadius = circleDiameter / 4;
            let startingAngle = 0; // "East" on the unit circle
            let points: PIXI.Point[] = [];

            for (let i = 0; i < 3; i++) {
                let angle = startingAngle + i*(Math.PI*2 / 3);
                let point = new PIXI.Point(triangleRadius * Math.cos(angle), triangleRadius * Math.sin(angle));
                points.push(point);
            }

            reverseArrow.beginFill(0xFFFFFF);
            reverseArrow.drawPolygon(points);
            reverseArrow.endFill();

            this.reverseArrow = reverseArrow;
        } else if (DRAWING_MODE === DrawingMode.Skin) {
            let reverseArrow = new PIXI.Sprite(reverseArrowTexture);
            let yes1 = reverseArrow.width; // Keep the original width at the start.
            let yes2 = reverseArrow.height; // Keep the original width at the start.

            // Make all this a bit... cleaner.
            // Essentially what this does is set the width OR height, whatever is bigger, to the circleDiameter, and adjust the other dimension so that the ratio is kept.
            let no1, no2, r = yes1/yes2;
            if (yes1 > yes2) {
                no1 = circleDiameter;
                no2 = circleDiameter / r;
            } else {
                no1 = circleDiameter / r;
                no2 = circleDiameter;
            }

            reverseArrow.width = no1;
            reverseArrow.height = no2;
            reverseArrow.pivot.x = yes1 / 2;
            reverseArrow.pivot.y = yes2 / 2;

            this.reverseArrow = reverseArrow;
        }
        this.reverseArrow.visible = false;

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
                let sprite = new PIXI.Sprite(sliderTickTexture);

                sprite.anchor.set(0.5, 0.5);
                sprite.width = circleDiameter * SLIDER_TICK_CS_RATIO;
                sprite.height = circleDiameter * SLIDER_TICK_CS_RATIO;

                tickElement = sprite;
            }

            let sliderTickPos = this.toCtxCoord(this.getPosFromPercentage(MathUtil.reflect(completion)));

            tickElement.x = sliderTickPos.x;
            tickElement.y = sliderTickPos.y;

            this.sliderTickContainer.addChild(tickElement);
        }

        this.overlayContainer = new PIXI.Container();
        if (this.sliderTickCompletions.length > 0) this.overlayContainer.addChild(this.sliderTickContainer);
        this.overlayContainer.addChild(this.sliderBall);
        this.overlayContainer.addChild(this.reverseArrow);
        this.overlayContainer.addChild(this.followCircle);

        this.container.addChild(this.baseSprite);
        this.container.addChild(this.hitCirclePrimitiveContainer);
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

        this.reverseArrow.destroy();
        this.sliderBall.destroy();
        this.sliderTickContainer.destroy();
    }

    addPlayEvents(playEventArray: PlayEvent[]) {
        super.addPlayEvents(playEventArray);

        let { processedBeatmap } = gameState.currentPlay;

        playEventArray.push({
            type: PlayEventType.SliderEnd,
            hitObject: this,
            time: this.endTime
        });

        if (this.hitObject.repeat > 1) {
            let repeatCycleDuration = (this.endTime - this.startTime) / this.hitObject.repeat;

            for (let i = 1; i < this.hitObject.repeat; i++) {
                let position = (i % 2 === 0)? this.startPoint : this.endPoint;

                playEventArray.push({
                    type: PlayEventType.SliderRepeat,
                    hitObject: this,
                    time: this.startTime + i * repeatCycleDuration,
                    position: position
                });
            }
        }

        for (let tickCompletion of this.sliderTickCompletions) {
            // Time that the tick should be hit, relative to the slider start time
            let time = tickCompletion * this.hitObject.length / this.timingInfo.sliderVelocity;
            let position = this.getPosFromPercentage(MathUtil.reflect(tickCompletion));

            playEventArray.push({
                type: PlayEventType.SliderTick,
                hitObject: this,
                time: this.startTime + time,
                position: position
            });
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

        scoreCounter.add(ScoringValue.SliderHead, true, true, false, this, time);
        if (judgement !== 0) {
            normalHitSoundEffect.start();

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
        if (this.curve instanceof SliderCurveBezier) {
            return interpolatePointInPointArray(this.curve.equalDistancePoints, percent);
        } else if (this.curve instanceof SliderCurvePassthrough) {
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

        let sliderBallPos = this.toCtxCoord(this.getPosFromPercentage(MathUtil.reflect(completion)));

        if (currentTime < this.endTime) {
            this.sliderBall.visible = true;
            this.sliderBall.x = sliderBallPos.x;
            this.sliderBall.y = sliderBallPos.y;
        } else {
            // The slider ball disappears upon slider completion
            this.sliderBall.visible = false;
        }

        this.followCircle.visible = true;
        this.followCircle.x = sliderBallPos.x;
        this.followCircle.y = sliderBallPos.y;

        let enlargeCompletion = (currentTime - this.startTime) / FOLLOW_CIRCLE_SCALE_IN_DURATION;
        enlargeCompletion = MathUtil.clamp(enlargeCompletion, 0, 1);
        enlargeCompletion = MathUtil.ease(EaseType.EaseOutQuad, enlargeCompletion);

        let followCircleSizeFactor = 0;
        followCircleSizeFactor += (FOLLOW_CIRCLE_CS_RATIO - 1) * enlargeCompletion; // Enlarge to FOLLOW_CIRCLE_CS_RATIO on start

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

        let followCircleDiameter = gameState.currentPlay.circleDiameter;
        followCircleDiameter *= followCircleSizeFactor;
        this.followCircle.width = followCircleDiameter;
        this.followCircle.height = followCircleDiameter;
    }

    private renderSliderTicks(completion: number, currentSliderTime: number) {
        let lowestTickCompletionFromCurrentRepeat = this.getLowestTickCompletionFromCurrentRepeat(completion);
        let currentCycle = Math.floor(completion);

        for (let i = 0; i < this.sliderTickContainer.children.length; i++) {
            let tickElement = this.sliderTickContainer.children[i];

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
            let relativeTickTime = ((tickCompletion - lowestTickCompletionFromCurrentRepeat) * this.hitObject.length / (this.timingInfo.sliderVelocity * 2));
            // Sum both up to get the timing of the tick relative to the beginning of the whole slider:
            let tickTime = currentRepeatTime + relativeTickTime;
            
            // If we're past the first cycle, slider ticks have to appear exactly animationDuration ms later, so that we can actually fit an appearance animation of animationDuration ms into that cycle.
            if (currentCycle > 0) tickTime += SLIDER_TICK_APPEARANCE_ANIMATION_DURATION;

            let animationStart = tickTime - SLIDER_TICK_APPEARANCE_ANIMATION_DURATION;
            let animationCompletion = (currentSliderTime - animationStart) / SLIDER_TICK_APPEARANCE_ANIMATION_DURATION;
            animationCompletion = MathUtil.clamp(animationCompletion, 0, 1);

            // Creates a bouncing scaling effect.
            let parabola = (-2.381 * animationCompletion * animationCompletion + 3.381 * animationCompletion);

            if (animationCompletion === 0) parabola = 0;
            if (animationCompletion >= 1) parabola = 1;

            tickElement.scale.set(parabola);
        }
    }
}