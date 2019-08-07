import { DrawableHitObject } from "./drawable_hit_object";
import { HitObject } from "../datamodel/hit_object";
import { gameState } from "./game_state";
import { ScoringValue } from "./score";
import { MathUtil, EaseType } from "../util/math_util";
import { HIT_OBJECT_FADE_OUT_TIME, DRAWING_MODE, DrawingMode, CIRCLE_BORDER_WIDTH, NUMBER_HEIGHT_CS_RATIO, PROCEDURAL_HEAD_INNER_TYPE } from "../util/constants";
import { ComboInfo } from "./processed_beatmap";
import { SpriteNumber } from "../visuals/sprite_number";
import { digitTextures, approachCircleTexture, hitCircleTexture, hitCircleOverlayTexture } from "./skin";
import { colorToHexNumber } from "../util/graphics_util";
import { mainHitObjectContainer, approachCircleContainer } from "../visuals/rendering";
import { Point, pointDistance } from "../util/point";
import { PlayEvent, PlayEventType } from "./play_events";

export interface HitObjectHeadScoring {
    hit: ScoringValue,
    time: number
}

export function getDefaultHitObjectHeadScoring(): HitObjectHeadScoring {
    return {
        hit: ScoringValue.NotHit,
        time: null
    };
}

export interface CircleScoring {
    head: HitObjectHeadScoring
}

export function getDefaultCircleScoring(): CircleScoring {
    return {
        head: getDefaultHitObjectHeadScoring()
    };
}

// Keeps track of what the player has successfully hit
export interface SliderScoring {
    head: HitObjectHeadScoring,
    ticks: number,
    repeats: number,
    end: boolean
}

export function getDefaultSliderScoring(): SliderScoring {
    return {
        head: getDefaultHitObjectHeadScoring(),
        ticks: 0,
        repeats: 0,
        end: false
    };
}

export abstract class HeadedDrawableHitObject extends DrawableHitObject {
    public headContainer: PIXI.Container;
    public approachCircle: PIXI.Container;
    public stackHeight: number = 0;
    public scoring: CircleScoring | SliderScoring;

    constructor(hitObject: HitObject) {
        super(hitObject);
    }

    applyStackPosition() {
        this.x += this.stackHeight * -4;
        this.y += this.stackHeight * -4;
        this.startPoint.x += this.stackHeight * -4;
        this.startPoint.y += this.stackHeight * -4;
        this.endPoint.x += this.stackHeight * -4;
        this.endPoint.y += this.stackHeight * -4;
    }

    draw() {
        let circleDiameter = gameState.currentPlay.circleDiameter;

        let headBase: PIXI.Sprite;
        if (DRAWING_MODE === DrawingMode.Procedural) {
            let canvas = document.createElement('canvas');
            canvas.setAttribute('width', String(circleDiameter));
            canvas.setAttribute('height', String(circleDiameter));
            let ctx = canvas.getContext('2d');
            drawHitObjectHead(ctx, 0, 0, this.comboInfo);

            headBase = new PIXI.Sprite(PIXI.Texture.from(canvas));
        } else if (DRAWING_MODE === DrawingMode.Skin) {
            headBase = new PIXI.Sprite(hitCircleTexture);
            headBase.tint = colorToHexNumber(this.comboInfo.color);
        }

        headBase.pivot.x = headBase.width / 2;
        headBase.pivot.y = headBase.height / 2;
        headBase.width = circleDiameter;
        headBase.height = circleDiameter;

        let headOverlay: PIXI.Container;
        if (DRAWING_MODE === DrawingMode.Skin) {
            headOverlay = new PIXI.Sprite(hitCircleOverlayTexture);

            headOverlay.pivot.x = headOverlay.width / 2;
            headOverlay.pivot.y = headOverlay.height / 2;
            headOverlay.width = circleDiameter;
            headOverlay.height = circleDiameter;
        }

        let headNumber: PIXI.Container;
        if (DRAWING_MODE === DrawingMode.Skin) {
            let text = new SpriteNumber({
                textures: digitTextures,
                horizontalAlign: "center",
                verticalAlign: "middle",
                digitHeight: NUMBER_HEIGHT_CS_RATIO * circleDiameter,
                overlap: 15
            });
            text.setValue(this.comboInfo.n);

            headNumber = text.container;
        }

        if (DRAWING_MODE === DrawingMode.Procedural) {
            let approachCircle = new PIXI.Graphics();
            let actualApproachCircleWidth = CIRCLE_BORDER_WIDTH * circleDiameter / 2; // Should be as wide as circle border once it hits it
            approachCircle.lineStyle(actualApproachCircleWidth, colorToHexNumber(this.comboInfo.color));
            approachCircle.drawCircle(0, 0, (circleDiameter - actualApproachCircleWidth) / 2); 

            this.approachCircle = approachCircle;
        } else if (DRAWING_MODE === DrawingMode.Skin) {
            let approachCircle = new PIXI.Sprite(approachCircleTexture);
            approachCircle.pivot.x = approachCircle.width / 2;
            approachCircle.pivot.y = approachCircle.height / 2;
            approachCircle.width = circleDiameter;
            approachCircle.height = circleDiameter;
            approachCircle.tint = colorToHexNumber(this.comboInfo.color);

            this.approachCircle = approachCircle;
        }

        let headContainer = new PIXI.Container();
        headContainer.addChild(headBase);
        if (headOverlay) headContainer.addChild(headOverlay);
        if (headNumber) headContainer.addChild(headNumber);

        this.headContainer = headContainer;
        this.container.addChild(this.headContainer);
    }

    show(currentTime: number) {
        mainHitObjectContainer.addChildAt(this.container, 0);
        approachCircleContainer.addChild(this.approachCircle);

        this.position();
        this.update(currentTime);
    }

    position() {
        this.approachCircle.x = gameState.currentPlay.toScreenCoordinatesX(this.x);
        this.approachCircle.y = gameState.currentPlay.toScreenCoordinatesY(this.y);
    }

    remove() {
        mainHitObjectContainer.removeChild(this.container);
        approachCircleContainer.removeChild(this.approachCircle);
    }

    abstract hitHead(time: number): void;
    
    handleButtonPress(osuMouseCoordinates: Point, currentTime: number) {
        let { circleRadiusOsuPx } = gameState.currentPlay;

        let distance = pointDistance(osuMouseCoordinates, this.startPoint);

        if (distance <= circleRadiusOsuPx) {
            if (this.scoring.head.hit === ScoringValue.NotHit) {
                this.hitHead(currentTime);
                return true;
            }
        }

        return false;
    }

    addPlayEvents(playEventArray: PlayEvent[]) {
        let { processedBeatmap } = gameState.currentPlay;

        playEventArray.push({
            type: PlayEventType.PerfectHeadHit,
            hitObject: this,
            time: this.startTime
        });

        playEventArray.push({
            type: PlayEventType.HeadHitWindowEnd,
            hitObject: this,
            time: this.startTime + processedBeatmap.beatmap.difficulty.getHitDeltaForJudgement(50)
        });
    }

    updateHeadElements(currentTime: number) {
        let { ARMs, circleDiameter } = gameState.currentPlay;
    
        let fadeInCompletion = 1;
        let headScoring = this.scoring.head;
    
        if (headScoring.hit === ScoringValue.NotHit) {
            if (currentTime < this.startTime) {
                fadeInCompletion = (currentTime - (this.hitObject.time - ARMs)) / ARMs;
                fadeInCompletion = MathUtil.clamp(fadeInCompletion, 0, 1);
                fadeInCompletion = MathUtil.ease(EaseType.EaseOutQuad, fadeInCompletion);
    
                let approachCircleAppearTime = this.startTime - ARMs;
                let approachCircleCompletion = (currentTime - approachCircleAppearTime) / ARMs;
                approachCircleCompletion = MathUtil.clamp(approachCircleCompletion, 0, 1);
    
                let approachCircleFactor = (1-approachCircleCompletion) * 3 + 1; // Goes from 4.0 -> 1.0
                let approachCircleDiameter = circleDiameter * approachCircleFactor;
                this.approachCircle.width = this.approachCircle.height = approachCircleDiameter;
    
                this.approachCircle.alpha = fadeInCompletion;
            } else {
                this.approachCircle.visible = false;
            }
        } else {
            this.approachCircle.visible = false;
    
            let time = headScoring.time;
    
            let fadeOutCompletion = (currentTime - (time)) / HIT_OBJECT_FADE_OUT_TIME;
            fadeOutCompletion = MathUtil.clamp(fadeOutCompletion, 0, 1);
            fadeOutCompletion = MathUtil.ease(EaseType.EaseOutQuad, fadeOutCompletion);
    
            let alpha = 1 - fadeOutCompletion;
            let scale = 1 + fadeOutCompletion * 0.333; // Max scale: 1.333
    
            this.headContainer.alpha = alpha;
            if (headScoring.hit !== ScoringValue.Miss) { // Misses just fade out, whereas all other hit judgements also cause an 'expansion' effect
                this.headContainer.width = circleDiameter * scale;
                this.headContainer.height = circleDiameter * scale;
            }
        }
    
        return { fadeInCompletion };
    }
}

/** Draws a hit object head procedurally, complete with base, overlay and number. */
export function drawHitObjectHead(context: CanvasRenderingContext2D, x: number, y: number, comboInfo: ComboInfo) {
    console.trace()
    let { circleDiameter } = gameState.currentPlay;

    let color = comboInfo.color;

    context.beginPath(); // Draw circle base (will become border)
    context.arc(x + circleDiameter / 2, y + circleDiameter / 2, circleDiameter / 2, 0, Math.PI * 2);
    context.fillStyle = "white";
    context.fill();

    let colorString = "rgb(" + Math.round(color.r * 0.68) + "," + Math.round(color.g * 0.68) + "," + Math.round(color.b * 0.68) + ")";
    let darkColorString = "rgb(" + Math.round(color.r * 0.2) + "," + Math.round(color.g * 0.2) + "," + Math.round(color.b * 0.2) + ")";

    let radialGradient = context.createRadialGradient(x + circleDiameter / 2, y + circleDiameter / 2, 0, x + circleDiameter / 2, y + circleDiameter / 2, circleDiameter / 2);
    radialGradient.addColorStop(0, colorString);
    radialGradient.addColorStop(1, darkColorString);

    context.beginPath(); // Draw circle body with radial gradient
    context.arc(x + circleDiameter / 2, y + circleDiameter / 2, (circleDiameter / 2) * (1 - CIRCLE_BORDER_WIDTH), 0, Math.PI * 2);
    context.fillStyle = radialGradient;
    context.fill();
    context.fillStyle = "rgba(255, 255, 255, 0.5)";
    context.globalCompositeOperation = "destination-out"; // Transparency
    context.fill();

    context.globalCompositeOperation = "source-over";

    if (PROCEDURAL_HEAD_INNER_TYPE === "number") {
        context.font = (circleDiameter * 0.41) + "px 'Nunito'";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillStyle = "white";
        context.fillText(String(comboInfo.n), x + circleDiameter / 2, y + circleDiameter / 2 * 1.06); // 1.06 = my attempt to make it centered.
    } else if (PROCEDURAL_HEAD_INNER_TYPE === "dot") {
        context.beginPath();
        context.arc(x + circleDiameter / 2, y + circleDiameter / 2, circleDiameter / 2 * 0.25, 0, Math.PI * 2);
        context.fillStyle = "white";
        context.fill();
    }
}