import { Slider } from "../datamodel/slider";
import { SliderCurve } from "./slider_curve";
import { SliderCurveEmpty } from "./slider_curve_empty";
import { SliderCurvePassthrough } from "./slider_curve_passthrough";
import { SliderCurveBezier } from "./slider_curve_bezier";
import { MathUtil } from "../util/math_util";
import { DrawableHitObject, drawCircle, CIRCLE_BORDER_WIDTH, DRAWING_MODE } from "./drawable_hit_object";
import { Point, interpolatePointInPointArray } from "../util/point";
import { gameState } from "./game_state";
import { PLAYFIELD_DIMENSIONS, APPROACH_CIRCLE_TEXTURE } from "../util/constants";
import { mainHitObjectContainer, approachCircleContainer } from "../visuals/rendering";

export interface SliderTimingInfo {
    msPerBeat: number,
    msPerBeatMultiplier: number,
    sliderVelocity: number
}

export class DrawableSlider extends DrawableHitObject {
    public headSprite: PIXI.Sprite;
    public baseSprite: PIXI.Sprite;
    public baseCtx: CanvasRenderingContext2D;
    public overlaySprite: PIXI.Sprite;
    public overlayCanvas: HTMLCanvasElement;
    public overlayCtx: CanvasRenderingContext2D;

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
    public maxFollowCircleRadius: number;
    public endTime: number;
    public timingInfo: SliderTimingInfo;
    public stackHeight: number;
    public letGoTime: number;
    public hitObject: Slider;

    constructor(hitObject: Slider) {
        super(hitObject);

        this.reductionFactor = 0.92;
        this.curve = null;
        this.complete = true;

        this.baseSprite = null;
        this.overlaySprite = null;
        this.headSprite = null;
        this.approachCircle = null;

        this.init();
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
            x: pos.x * pixelRatio - this.minX + circleDiameter/2,
            y: pos.y * pixelRatio - this.minY + circleDiameter/2
        };
    }

    draw() {
        if (!this.curve) return;

        let { circleDiameter } = gameState.currentPlay;

        this.sliderWidth = this.maxX - this.minX;
        this.sliderHeight = this.maxY - this.minY;
        this.sliderBodyRadius = circleDiameter/2 * (this.reductionFactor - CIRCLE_BORDER_WIDTH);
        this.maxFollowCircleRadius = (circleDiameter/2 * 2.20);

        let canvas = document.createElement('canvas');
        canvas.setAttribute('width', String(Math.ceil(this.sliderWidth + circleDiameter)));
        canvas.setAttribute('height', String(Math.ceil(this.sliderHeight + circleDiameter)));
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
        this.headSprite.width = circleDiameter;
        this.headSprite.height = circleDiameter;

        this.approachCircle = new PIXI.Sprite(APPROACH_CIRCLE_TEXTURE);
        this.approachCircle.width = circleDiameter;
        this.approachCircle.height = circleDiameter;

        this.overlayCanvas = document.createElement('canvas');
        this.overlayCanvas.setAttribute('width', String(Math.ceil(this.sliderWidth + circleDiameter)));
        this.overlayCanvas.setAttribute('height', String(Math.ceil(this.sliderHeight + circleDiameter)));
        let overlayCtx = this.overlayCanvas.getContext('2d');
        this.overlayCtx = overlayCtx;
        this.overlaySprite = new PIXI.Sprite();
        this.overlaySprite.texture = PIXI.Texture.from(this.overlayCanvas);
    }

    show(currentTime: number) {
        if (!this.curve) return;

        this.container.addChild(this.baseSprite);
        this.container.addChild(this.overlaySprite);
        this.container.addChild(this.headSprite);
        mainHitObjectContainer.addChildAt(this.container, 0);
        approachCircleContainer.addChild(this.approachCircle);

        this.update(currentTime);
    }

    update(currentTime: number) {
        if (!this.curve) return;

        let { ARMs, circleDiameter, pixelRatio } = gameState.currentPlay;

        let fadeInCompletion = (currentTime - (this.hitObject.time - ARMs)) / ARMs;
        fadeInCompletion = MathUtil.clamp(fadeInCompletion, 0, 1);
        fadeInCompletion = MathUtil.ease('easeOutQuad', fadeInCompletion);

        this.container.alpha = fadeInCompletion;
        this.approachCircle.alpha = fadeInCompletion;

        this.container.x = window.innerWidth / 2 + (this.minX - circleDiameter / 2 - PLAYFIELD_DIMENSIONS.width/2 * pixelRatio);
        this.container.y = window.innerHeight / 2 + (this.minY - circleDiameter / 2 - PLAYFIELD_DIMENSIONS.height/2 * pixelRatio);

        this.headSprite.x = this.hitObject.x * pixelRatio - this.minX;
        this.headSprite.y = this.hitObject.y * pixelRatio - this.minY;

        let approachCircleCompletion = MathUtil.clamp((this.hitObject.time - currentTime) / ARMs, 0, 1);
        let approachCircleFactor = 3 * (approachCircleCompletion) + 1;
        let approachCircleDiameter = circleDiameter * approachCircleFactor;
        this.approachCircle.width = this.approachCircle.height = approachCircleDiameter;
        this.approachCircle.x = window.innerWidth / 2 + (this.hitObject.x - PLAYFIELD_DIMENSIONS.width/2) * pixelRatio - approachCircleDiameter / 2;
        this.approachCircle.y = window.innerHeight / 2 + (this.hitObject.y - PLAYFIELD_DIMENSIONS.height/2) * pixelRatio - approachCircleDiameter / 2;

        this.renderOverlay(currentTime);
        this.overlaySprite.texture.update();

        if (currentTime >= this.hitObject.time) {
            this.container.removeChild(this.headSprite);
            approachCircleContainer.removeChild(this.approachCircle);
        }
    }

    remove() {
        mainHitObjectContainer.removeChild(this.container);
        approachCircleContainer.removeChild(this.approachCircle);
    }

    getPosFromPercentage(percent: number) : Point | void {
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

    renderOverlay(currentTime: number) {
        let { circleDiameter, pixelRatio, processedBeatmap } = gameState.currentPlay;
        let completion = 0;
        let currentSliderTime = currentTime - this.hitObject.time;
        let isMoving = currentSliderTime >= 0;

        /*
        if (GAME_STATE.gameState.currentPlay.mods.HD) { // Slowly fade out slider body
            this.baseCanvas.style.opacity = MathUtil.clamp(1 - ((currentSliderTime + GAME_STATE.gameState.currentPlay.ARMs / 2) / (this.endTime - this.startTime + GAME_STATE.gameState.currentPlay.ARMs / 2)), 0, 1);

            if (currentSliderTime >= -GAME_STATE.gameState.currentPlay.ARMs / 2 && !isMoving) {
                this.baseCanvas.style.webkitMask = "radial-gradient(" + (GAME_STATE.gameState.currentPlay.halfCsPixel * (this.reductionFactor - CIRCLE_BORDER_WIDTH / 2)) + "px at " + (this.startPoint.x * pixelRatio - this.minX + GAME_STATE.gameState.currentPlay.halfCsPixel) + "px " + (this.startPoint.y * pixelRatio - this.minY + GAME_STATE.gameState.currentPlay.halfCsPixel) + "px, rgba(0, 0, 0, " + MathUtil.clamp((currentSliderTime + GAME_STATE.gameState.currentPlay.ARMs / 2) / (GAME_STATE.gameState.currentPlay.ARMs / 4), 0, 1) + ") 99%, rgba(0, 0, 0, 1) 100%)";
            }
        }*/

        if(currentSliderTime >= this.endTime - this.hitObject.time + 175) return;

        this.overlayCtx.clearRect(0, 0, Math.ceil(this.sliderWidth + circleDiameter), Math.ceil(this.sliderHeight + circleDiameter));

        if (isMoving) {
            completion = Math.min(this.hitObject.repeat, (this.timingInfo.sliderVelocity * currentSliderTime) / this.hitObject.length);
        }

        // Draws reverse arrow
        if (this.hitObject.repeat - completion > 1 && this.complete) {
            let reverseArrowPos: Point;
            let p2: Point;
            const INFINITESIMAL = 0.00001; // Okay, not really infinitely small. But you get the point.

            if (Math.floor(completion) % 2 === 0) {
                reverseArrowPos = this.getPosFromPercentage(1) as Point;
                p2 = this.getPosFromPercentage(1 - INFINITESIMAL) as Point;
            } else {
                reverseArrowPos = this.getPosFromPercentage(0) as Point;
                p2 = this.getPosFromPercentage(0 + INFINITESIMAL) as Point;
            }
            let angle = Math.atan2(p2.y - reverseArrowPos.y, p2.x - reverseArrowPos.x);
            let x = reverseArrowPos.x * pixelRatio - this.minX;
            let y = reverseArrowPos.y * pixelRatio - this.minY;

            // Create second off-screen canvas used for rotating the text
            let reverseArrowCanvas = document.createElement("canvas");
            reverseArrowCanvas.setAttribute("width", String(circleDiameter));
            reverseArrowCanvas.setAttribute("height", String(circleDiameter));

            let reverseArrowCtx = reverseArrowCanvas.getContext("2d") as CanvasRenderingContext2D;
            reverseArrowCtx.translate(circleDiameter/2, circleDiameter/2);
            reverseArrowCtx.rotate(angle);
            reverseArrowCtx.translate(-circleDiameter/2, -circleDiameter/2);
            reverseArrowCtx.font = "lighter " + (circleDiameter * 0.6) + "px Arial";
            reverseArrowCtx.textAlign = "center";
            reverseArrowCtx.textBaseline = "middle";
            reverseArrowCtx.fillStyle = "white";
            reverseArrowCtx.fillText("➔", circleDiameter/2, circleDiameter/2);

            this.overlayCtx.drawImage(reverseArrowCanvas, x, y);
        }

        // Draws slider ball and follow circle to additional canvas
        let sliderBallPos: Point;
        if (isMoving) {
            sliderBallPos = this.toCtxCoord(this.getPosFromPercentage(MathUtil.reflect(completion)) as Point);
            let fadeOutCompletion = Math.min(1, Math.max(0, (currentTime - this.letGoTime) / 120));

            let colorArray = processedBeatmap.beatmap.colors;
            let color = colorArray[this.comboInfo.comboNum % colorArray.length];

            // Draw slider ball
            if (completion < this.hitObject.repeat) {
                if (DRAWING_MODE === 0) {
                    let colorString = "rgb(" + color.r + "," + color.g + "," + color.b + ")";

                    this.overlayCtx.beginPath();
                    this.overlayCtx.arc(sliderBallPos.x, sliderBallPos.y, this.sliderBodyRadius, 0, Math.PI * 2);
                    this.overlayCtx.fillStyle = colorString;
                    this.overlayCtx.fill();
                } else if (DRAWING_MODE === 1) {
                    //this.overlayCtx.drawImage(GAME_STATE.gameState.currentPlay.drawElements.sliderBall, sliderBallPos.x - GAME_STATE.gameState.currentPlay.halfCsPixel * SLIDER_BALL_CS_RATIO, sliderBallPos.y - GAME_STATE.gameState.currentPlay.halfCsPixel * SLIDER_BALL_CS_RATIO, GAME_STATE.gameState.currentPlay.csPixel * SLIDER_BALL_CS_RATIO, GAME_STATE.gameState.currentPlay.csPixel * SLIDER_BALL_CS_RATIO);
                }
            }
        }
    }
}