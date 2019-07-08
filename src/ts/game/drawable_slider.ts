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

export class DrawableSlider extends DrawableHitObject {
    public reductionFactor: number;
    public curve: SliderCurve | null;
    public complete: boolean;
    public baseSprite: any;
    public overlaySprite: any;
    private overlayCanvas: HTMLCanvasElement | null = null;
    private overlayCtx: CanvasRenderingContext2D | null = null;
    public headSprite: any;
    public baseCtx: CanvasRenderingContext2D | null = null
    public sliderWidth: number = 0;
    public sliderHeight: number = 0;
    public minX: number = 0;
    public maxX: number = 0;
    public minY: number = 0;
    public maxY: number = 0;
    public sliderBodyRadius: number = 0;
    public maxFollowCircleRadius: number = 0;
    public endTime: number = 0;
    public timingInfo: any = {};
    public stackHeight: number = 0;
    public letGoTime: number = 0;
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

    toCtxCoord(pos: Point) {
        return {
            x: pos.x * gameState.currentPlay!.pixelRatio! - this.minX + gameState.currentPlay!.circleDiameter!/2,
            y: pos.y * gameState.currentPlay!.pixelRatio! - this.minY + gameState.currentPlay!.circleDiameter!/2
        };
    }

    draw() {
        if (!this.curve) return;

        this.sliderWidth = this.maxX - this.minX;
        this.sliderHeight = this.maxY - this.minY;
        this.sliderBodyRadius = gameState.currentPlay!.circleDiameter!/2 * (this.reductionFactor - CIRCLE_BORDER_WIDTH);
        this.maxFollowCircleRadius = (gameState.currentPlay!.circleDiameter!/2 * 2.20);

        let canvas = document.createElement('canvas');
        canvas.setAttribute('width', String(Math.ceil(this.sliderWidth + gameState.currentPlay!.circleDiameter!)));
        canvas.setAttribute('height', String(Math.ceil(this.sliderHeight + gameState.currentPlay!.circleDiameter!)));
        let ctx = canvas.getContext('2d');
        this.baseCtx = ctx;
        this.curve.render(1);

        this.baseSprite = new PIXI.Sprite(PIXI.Texture.from(canvas));

        let headCanvas = document.createElement('canvas');
        headCanvas.setAttribute('width', String(gameState.currentPlay!.circleDiameter));
        headCanvas.setAttribute('height', String(gameState.currentPlay!.circleDiameter));
        let headCtx = headCanvas.getContext('2d');
        drawCircle(headCtx!, 0, 0, this.comboInfo);

        this.headSprite = new PIXI.Sprite(PIXI.Texture.from(headCanvas));
        this.headSprite.width = gameState.currentPlay!.circleDiameter;
        this.headSprite.height = gameState.currentPlay!.circleDiameter;

        this.approachCircle = new PIXI.Sprite(APPROACH_CIRCLE_TEXTURE);
        this.approachCircle.width = gameState.currentPlay!.circleDiameter;
        this.approachCircle.height = gameState.currentPlay!.circleDiameter;

        this.overlayCanvas = document.createElement('canvas');
        this.overlayCanvas.setAttribute('width', String(Math.ceil(this.sliderWidth + gameState.currentPlay!.circleDiameter!)));
        this.overlayCanvas.setAttribute('height', String(Math.ceil(this.sliderHeight + gameState.currentPlay!.circleDiameter!)));
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

        let yes = (currentTime - (this.hitObject.time - gameState.currentPlay!.ARMs)) / gameState.currentPlay!.ARMs;
        yes = MathUtil.clamp(yes, 0, 1);
        yes = MathUtil.ease('easeOutQuad', yes);

        //let fadeInCompletion = MathUtil.clamp(1 - ((this.hitObject.time - gameState.currentPlay!.ARMs/2) - currentTime) / 300, 0, 1);
        let fadeInCompletion = yes;
        this.container.alpha = fadeInCompletion;
        this.approachCircle.alpha = fadeInCompletion;

        this.container.x = window.innerWidth / 2 + (this.minX - gameState.currentPlay!.circleDiameter! / 2 - PLAYFIELD_DIMENSIONS.width/2 * gameState.currentPlay!.pixelRatio!);
        this.container.y = window.innerHeight / 2 + (this.minY - gameState.currentPlay!.circleDiameter! / 2 - PLAYFIELD_DIMENSIONS.height/2 * gameState.currentPlay!.pixelRatio!);

        this.headSprite.x = this.hitObject.x * gameState.currentPlay!.pixelRatio! - this.minX;
        this.headSprite.y = this.hitObject.y * gameState.currentPlay!.pixelRatio! - this.minY;

        let approachCircleCompletion = MathUtil.clamp((this.hitObject.time - currentTime) / gameState.currentPlay!.ARMs, 0, 1);
        let approachCircleFactor = 3 * (approachCircleCompletion) + 1;
        let approachCircleDiameter = gameState.currentPlay!.circleDiameter! * approachCircleFactor;
        this.approachCircle.width = this.approachCircle.height = approachCircleDiameter;
        this.approachCircle.x = window.innerWidth / 2 + (this.hitObject.x - PLAYFIELD_DIMENSIONS.width/2) * gameState.currentPlay!.pixelRatio! - approachCircleDiameter / 2;
        this.approachCircle.y = window.innerHeight / 2 + (this.hitObject.y - PLAYFIELD_DIMENSIONS.height/2) * gameState.currentPlay!.pixelRatio! - approachCircleDiameter / 2;

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
            return interpolatePointInPointArray(this.curve!.equalDistancePoints, percent);
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
        let pixelRatio = gameState.currentPlay!.pixelRatio;
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

        this.overlayCtx!.clearRect(0, 0, Math.ceil(this.sliderWidth + gameState.currentPlay!.circleDiameter!), Math.ceil(this.sliderHeight + gameState.currentPlay!.circleDiameter!));

        if (isMoving) {
            completion = Math.min(this.hitObject.repeat, (this.timingInfo.sliderVelocity * currentSliderTime) / this.hitObject.length);
        }

        // Draws reverse arrow
        if (this.hitObject.repeat - completion > 1 && this.complete) {
            let reverseArrowPos = null;
            let p2 = null;
            const INFINITESIMAL = 0.00001; // Okay, not really infinitely small. But you get the point.

            if (Math.floor(completion) % 2 === 0) {
                reverseArrowPos = this.getPosFromPercentage(1) as Point;
                p2 = this.getPosFromPercentage(1 - INFINITESIMAL) as Point;
            } else {
                reverseArrowPos = this.getPosFromPercentage(0) as Point;
                p2 = this.getPosFromPercentage(0 + INFINITESIMAL) as Point;
            }
            let angle = Math.atan2(p2.y - reverseArrowPos.y, p2.x - reverseArrowPos.x);
            let x = reverseArrowPos.x * gameState.currentPlay!.pixelRatio! - this.minX;
            let y = reverseArrowPos.y * gameState.currentPlay!.pixelRatio! - this.minY;

            // Create second off-screen canvas used for rotating the text
            let reverseArrowCanvas = document.createElement("canvas");
            reverseArrowCanvas.setAttribute("width", String(gameState.currentPlay!.circleDiameter));
            reverseArrowCanvas.setAttribute("height", String(gameState.currentPlay!.circleDiameter));

            let reverseArrowCtx = reverseArrowCanvas.getContext("2d") as CanvasRenderingContext2D;
            reverseArrowCtx.translate(gameState.currentPlay!.circleDiameter!/2, gameState.currentPlay!.circleDiameter!/2);
            reverseArrowCtx.rotate(angle);
            reverseArrowCtx.translate(-gameState.currentPlay!.circleDiameter!/2, -gameState.currentPlay!.circleDiameter!/2);
            reverseArrowCtx.font = "lighter " + (gameState.currentPlay!.circleDiameter! * 0.6) + "px Arial";
            reverseArrowCtx.textAlign = "center";
            reverseArrowCtx.textBaseline = "middle";
            reverseArrowCtx.fillStyle = "white";
            reverseArrowCtx.fillText("➔", gameState.currentPlay!.circleDiameter!/2, gameState.currentPlay!.circleDiameter!/2);

            this.overlayCtx!.drawImage(reverseArrowCanvas, x, y);
        }

        // Draws slider ball and follow circle to additional canvas
        let sliderBallPos;
        if (isMoving) {
            sliderBallPos = this.toCtxCoord(this.getPosFromPercentage(MathUtil.reflect(completion)) as Point);
            let fadeOutCompletion = Math.min(1, Math.max(0, (currentTime - this.letGoTime) / 120));

            let colourArray = gameState.currentPlay!.processedBeatmap.beatmap.colours;
            let colour = colourArray[this.comboInfo.comboNum % colourArray.length];

            // Draw slider ball
            if (completion < this.hitObject.repeat) {
                if (DRAWING_MODE === 0) {
                    let colourString = "rgb(" + colour.r + "," + colour.g + "," + colour.b + ")";

                    this.overlayCtx!.beginPath();
                    this.overlayCtx!.arc(sliderBallPos.x, sliderBallPos.y, this.sliderBodyRadius, 0, Math.PI * 2);
                    this.overlayCtx!.fillStyle = colourString;
                    this.overlayCtx!.fill();
                } else if (DRAWING_MODE === 1) {
                    //this.overlayCtx.drawImage(GAME_STATE.gameState.currentPlay.drawElements.sliderBall, sliderBallPos.x - GAME_STATE.gameState.currentPlay.halfCsPixel * SLIDER_BALL_CS_RATIO, sliderBallPos.y - GAME_STATE.gameState.currentPlay.halfCsPixel * SLIDER_BALL_CS_RATIO, GAME_STATE.gameState.currentPlay.csPixel * SLIDER_BALL_CS_RATIO, GAME_STATE.gameState.currentPlay.csPixel * SLIDER_BALL_CS_RATIO);
                }
            }
        }
    }
}