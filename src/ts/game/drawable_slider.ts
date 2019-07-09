import { Slider } from "../datamodel/slider";
import { SliderCurve } from "./slider_curve";
import { SliderCurveEmpty } from "./slider_curve_empty";
import { SliderCurvePassthrough } from "./slider_curve_passthrough";
import { SliderCurveBezier } from "./slider_curve_bezier";
import { MathUtil } from "../util/math_util";
import { DrawableHitObject, drawCircle } from "./drawable_hit_object";
import { Point, interpolatePointInPointArray } from "../util/point";
import { gameState } from "./game_state";
import { PLAYFIELD_DIMENSIONS, APPROACH_CIRCLE_TEXTURE, REVERSE_ARROW_TEXTURE, SQUARE_TEXTURE, SLIDER_TICK_APPEARANCE_ANIMATION_DURATION, FOLLOW_CIRCLE_THICKNESS_FACTOR, HIT_OBJECT_FADE_OUT_TIME, CIRCLE_BORDER_WIDTH, DRAWING_MODE } from "../util/constants";
import { mainHitObjectContainer, approachCircleContainer } from "../visuals/rendering";
import { colorToHexNumber } from "../util/graphics_util";

export interface SliderTimingInfo {
    msPerBeat: number,
    msPerBeatMultiplier: number,
    sliderVelocity: number
}

export class DrawableSlider extends DrawableHitObject {
    public headSprite: PIXI.Sprite;
    public baseSprite: PIXI.Sprite;
    public baseCtx: CanvasRenderingContext2D;
    public overlayContainer: PIXI.Container;
    public sliderBall: PIXI.Graphics;
    public reverseArrow: PIXI.Sprite;
    public sliderTickGraphics: PIXI.Graphics;
    public followCircle: PIXI.Container;

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
    public stackHeight: number;
    public hitObject: Slider;
    public sliderTickCompletions: number[];

    constructor(hitObject: Slider) {
        super(hitObject);

        this.reductionFactor = 0.92;
        this.curve = null;
        this.complete = true;

        this.baseSprite = null;
        this.headSprite = null;
        this.approachCircle = null;
        this.overlayContainer = new PIXI.Container();

        this.init();

        // this.endTime will be defined in Play

        if (this.hitObject.repeat % 2 === 0) {
            this.endPoint = this.startPoint;
        } else {
            this.endPoint = this.getPosFromPercentage(1) as Point;
        }
    }

    init() {
        if (this.hitObject.sections.length === 0) {
            this.curve = new SliderCurveEmpty(this);
        } else if (this.hitObject.sections[0].type === "passthrough") {
            this.curve = new SliderCurvePassthrough(this);

            (<SliderCurvePassthrough>this.curve).calculateValues(false);
        } else {
            this.curve = new SliderCurveBezier(this, false);
        }
    }

    toCtxCoord(pos: Point): Point {
        let { pixelRatio, circleDiameter } = gameState.currentPlay;

        return {
            x: (pos.x - this.minX) * pixelRatio + circleDiameter/2,
            y: (pos.y - this.minY) * pixelRatio + circleDiameter/2
        };
    }

    draw() {
        let { circleDiameter, pixelRatio } = gameState.currentPlay;

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

        let headCanvas = document.createElement('canvas');
        headCanvas.setAttribute('width', String(circleDiameter));
        headCanvas.setAttribute('height', String(circleDiameter));
        let headCtx = headCanvas.getContext('2d');
        drawCircle(headCtx, 0, 0, this.comboInfo);

        this.headSprite = new PIXI.Sprite(PIXI.Texture.from(headCanvas));
        this.headSprite.pivot.x = this.headSprite.width / 2;
        this.headSprite.pivot.y = this.headSprite.height / 2;
        this.headSprite.width = circleDiameter;
        this.headSprite.height = circleDiameter;
        let headPos = this.toCtxCoord({x: this.x, y: this.y});
        this.headSprite.x = headPos.x;
        this.headSprite.y = headPos.y;

        this.approachCircle = new PIXI.Sprite(APPROACH_CIRCLE_TEXTURE);
        this.approachCircle.pivot.x = this.approachCircle.width / 2;
        this.approachCircle.pivot.y = this.approachCircle.height / 2;
        this.approachCircle.width = circleDiameter;
        this.approachCircle.height = circleDiameter;

        this.sliderBall = new PIXI.Graphics();
        this.sliderBall.beginFill(colorToHexNumber(this.comboInfo.color));
        this.sliderBall.lineStyle(0);
        this.sliderBall.drawCircle(0, 0, this.sliderBodyRadius);
        this.sliderBall.endFill();
        this.sliderBall.visible = false;

        let followCircle = new PIXI.Graphics();
        let thickness = FOLLOW_CIRCLE_THICKNESS_FACTOR * circleDiameter;
        followCircle.lineStyle(thickness, 0xFFFFFF);
        followCircle.drawCircle(0, 0, (circleDiameter - thickness) / 2);
        followCircle.visible = false;
        this.followCircle = followCircle;

        this.reverseArrow = new PIXI.Sprite(REVERSE_ARROW_TEXTURE);
        let yes1 = this.reverseArrow.width; // Keep the original width at the start.
        let yes2 = this.reverseArrow.height; // Keep the original width at the start.

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
        this.reverseArrow.width = no1;
        this.reverseArrow.height = no2;
        this.reverseArrow.pivot.x = yes1 / 2;
        this.reverseArrow.pivot.y = yes2 / 2;
        this.reverseArrow.visible = false;

        this.sliderTickGraphics = new PIXI.Graphics();

        this.overlayContainer.addChild(this.sliderTickGraphics);
        this.overlayContainer.addChild(this.sliderBall);
        this.overlayContainer.addChild(this.reverseArrow);
        this.overlayContainer.addChild(this.followCircle);

        this.container.addChild(this.baseSprite);
        this.container.addChild(this.overlayContainer);
        this.container.addChild(this.headSprite);
    }

    show(currentTime: number) {
        mainHitObjectContainer.addChildAt(this.container, 0);
        approachCircleContainer.addChild(this.approachCircle);

        this.position();
        this.update(currentTime);
    }

    position() {
        let { circleDiameterOsuPx } = gameState.currentPlay;

        this.container.x = gameState.currentPlay.toScreenCoordinatesX(this.minX - circleDiameterOsuPx/2);
        this.container.y = gameState.currentPlay.toScreenCoordinatesY(this.minY - circleDiameterOsuPx/2);
        this.approachCircle.x = gameState.currentPlay.toScreenCoordinatesX(this.x);
        this.approachCircle.y = gameState.currentPlay.toScreenCoordinatesY(this.y);
    }

    update(currentTime: number) {
        let { fadeInCompletion } = this.updateHeadElements(currentTime);
        let containerAlpha = fadeInCompletion;

        if (currentTime > this.endTime) {
            let fadeOutCompletion = (currentTime - (this.endTime)) / HIT_OBJECT_FADE_OUT_TIME;
            fadeOutCompletion = MathUtil.clamp(fadeOutCompletion, 0, 1);
            fadeOutCompletion = MathUtil.ease('easeOutQuad', fadeOutCompletion);

            let alpha = 1 - fadeOutCompletion;
            containerAlpha = alpha;
        }

        this.container.alpha = containerAlpha;      

        this.renderOverlay(currentTime);
    }

    remove() {
        mainHitObjectContainer.removeChild(this.container);
        approachCircleContainer.removeChild(this.approachCircle);
        this.reverseArrow.destroy();
        this.sliderBall.destroy();
        this.sliderTickGraphics.destroy();
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
        } else {
            console.warn("Tried to access position from empty slider. Empty. Slider. What's that?");
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

    private renderOverlay(currentTime: number) {
        let completion = 0;
        let currentSliderTime = currentTime - this.hitObject.time;
        let isMoving = currentSliderTime >= 0;

        completion = (this.timingInfo.sliderVelocity * currentSliderTime) / this.hitObject.length;
        completion = MathUtil.clamp(completion, 0, this.hitObject.repeat);

        this.renderSliderBall(completion, currentTime);
        this.renderReverseArrow(completion);
        if (this.sliderTickCompletions.length > 0) this.renderSliderTicks(completion, currentSliderTime);
    }

    private renderSliderBall(completion: number, currentTime: number) {
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

        let followCircleSizeFactor = 1; // Base
        followCircleSizeFactor += 1 * MathUtil.clamp((currentTime - this.startTime) / 100, 0, 1); // Enlarge on start
        followCircleSizeFactor += -0.333 * MathUtil.clamp((currentTime - this.endTime) / 100, 0, 1); // Shrink on end

        //let followCircleSizeFactor = (
        //    /* base */ 1
        //    + /* enlarge on start */ Math.max(0, Math.min(1, (currentTime - this.startTime) / 100))
        //    + ((this.letGoTime === null) ?
        //            /* pulse */ /*Math.max(0, Math.min(0.15, 0.15 - (currentSliderTime - this.lastPulseTime) / 150 * 0.20))*/
        //            + /* shrink on end */ -0.5 + Math.pow(Math.max(0, Math.min(1, (1 - (currentTime - this.endTime) / 175))), 2) * ///0.5 : 0
        //    )
        //);

        let followCircleDiameter = gameState.currentPlay.circleDiameter;
        followCircleDiameter *= followCircleSizeFactor;
        this.followCircle.width = followCircleDiameter;
        this.followCircle.height = followCircleDiameter;
    }

    private renderReverseArrow(completion: number) {
        if (this.hitObject.repeat - completion > 1) {
            const INFINITESIMAL = 0.00001; // Okay, not really infinitely small. But you get the point.
            let reverseArrowPos: Point;
            let p2: Point;

            if (Math.floor(completion) % 2 === 0) {
                reverseArrowPos = this.getPosFromPercentage(1) as Point;
                p2 = this.getPosFromPercentage(1 - INFINITESIMAL) as Point;
            } else {
                reverseArrowPos = this.getPosFromPercentage(0) as Point;
                p2 = this.getPosFromPercentage(0 + INFINITESIMAL) as Point;
            }

            let angle = Math.atan2(p2.y - reverseArrowPos.y, p2.x - reverseArrowPos.x);

            let shit = this.toCtxCoord(reverseArrowPos);
            this.reverseArrow.x = shit.x;
            this.reverseArrow.y = shit.y;
            this.reverseArrow.rotation = angle;

            this.reverseArrow.visible = true;
        } else {
            this.reverseArrow.visible = false;
        }
    }

    private renderSliderTicks(completion: number, currentSliderTime: number) {
        this.sliderTickGraphics.clear();
        this.sliderTickGraphics.lineStyle(0);

        let lowestTickCompletionFromCurrentRepeat = this.getLowestTickCompletionFromCurrentRepeat(completion);
        let currentCycle = Math.floor(completion);

        for (let i = 0; i < this.sliderTickCompletions.length; i++) {
            let tickCompletion = this.sliderTickCompletions[i];
            if (tickCompletion <= completion) continue; // If we're already past that tick
            if (tickCompletion - currentCycle >= 1) break; // If tick does not belong to this repeat cycle

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

            if (animationCompletion === 0) continue;

            let sliderTickPos = this.toCtxCoord(this.getPosFromPercentage(MathUtil.reflect(tickCompletion)));

            if (DRAWING_MODE === 0) {
                let radius = gameState.currentPlay.circleDiameter * 0.038;
                // Creates a bouncing scaling effect.
                let parabola = (-2.381 * animationCompletion * animationCompletion + 3.381 * animationCompletion);
                radius *= parabola;

                this.sliderTickGraphics.beginFill(0xFFFFFF);
                this.sliderTickGraphics.drawCircle(sliderTickPos.x, sliderTickPos.y, radius);
                this.sliderTickGraphics.endFill();
            } else if (DRAWING_MODE === 1) {
                //let diameter = GAME_STATE.currentPlay.csPixel / SLIDER_BALL_CS_RATIO / 4 * (-2.381 * animationCompletion * animationCompletion + 3.381 * animationCompletion);

                //this.overlayCtx.drawImage(GAME_STATE.currentPlay.drawElements.sliderTick, sliderTickPos.x - diameter / 2, sliderTickPos.y - diameter / 2, diameter, diameter);
            }
        }
    }
}