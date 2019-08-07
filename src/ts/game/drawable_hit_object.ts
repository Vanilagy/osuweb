import { HitObject } from "../datamodel/hit_object";
import { gameState } from "./game_state";
import { ComboInfo } from "./processed_beatmap";
import { Point } from "../util/point";
import { CIRCLE_BORDER_WIDTH, DRAWING_MODE, HIT_OBJECT_FADE_OUT_TIME, DrawingMode } from "../util/constants";
import { MathUtil, EaseType } from "../util/math_util";
import { PlayEvent } from "./play_events";
import { DrawableCircle } from "./drawable_circle";
import { DrawableSlider } from "./drawable_slider";
import { ScoringValue } from "./score";
import { hitCircleImage } from "./skin";

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

export abstract class DrawableHitObject {
    public id: number = 0;
    public comboInfo: ComboInfo;
    public hitObject: HitObject;
    public container: PIXI.Container;
    public headSprite: PIXI.Sprite;
    public approachCircle: PIXI.Container;
    public stackHeight: number = 0;

    public x: number;
    public y: number;
    public startPoint: Point;
    public endPoint: Point;
    public startTime: number;
    public endTime: number;

    // Specifies the timeframe is which the object is visible and needs to be rendered.
    public renderStartTime: number;
    /** When true, the hit object has ended its short life as a graphical element and need not be rendered anymore. */
    public renderFinished: boolean;

    constructor(hitObject: HitObject) {
        this.hitObject = hitObject;
        this.container = new PIXI.Container();

        this.startPoint = {
            x: this.hitObject.x,
            y: this.hitObject.y
        };
        this.startTime = this.hitObject.time;

        this.x = this.hitObject.x;
        this.y = this.hitObject.y;
    }

    abstract init(): void;

    abstract draw(): void;

    abstract show(currentTime: number): void;

    abstract position(): void;

    abstract update(currentTime: number): void;

    abstract remove(): void;

    abstract addPlayEvents(playEventArray: PlayEvent[]): void;

    /** @returns A boolean, indicating whether or not the object was handled by the button press. It could be false, for example, if the mouse wasn't over it or the object was already hit. */
    abstract handleButtonPress(osuMouseCoordinates: Point, currentTime: number): boolean;

    applyStackPosition() {
        this.x += this.stackHeight * -4;
        this.y += this.stackHeight * -4;
        this.startPoint.x += this.stackHeight * -4;
        this.startPoint.y += this.stackHeight * -4;
        this.endPoint.x += this.stackHeight * -4;
        this.endPoint.y += this.stackHeight * -4;
    }
}

export function drawCircle(context: CanvasRenderingContext2D, x: number, y: number, comboInfo: ComboInfo) { // Draws circle used for Hit Circles, Slider Heads and Repeat Tails
    let { circleDiameter, processedBeatmap } = gameState.currentPlay;

    let color = comboInfo.color;

    //color = {r: 255, g: 20, b: 20};

    if (DRAWING_MODE === DrawingMode.Procedural) {
        console.log("Get donw on it")

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
    } else if (DRAWING_MODE === DrawingMode.Skin) {
        //context.drawImage(hitCircleImage, x, y, circleDiameter, circleDiameter);

        context.drawImage(gameState.currentPlay.coloredHitCircles[comboInfo.colorIndex], x, y);

        //context.drawImage(GAME_STATE.currentPlay.drawElements.coloredHitcircles[comboInfo.comboNum % GAME_STATE.currentBeatmap.colors.length], x, y);
    }

    context.globalCompositeOperation = "source-over";
    if (DRAWING_MODE === DrawingMode.Procedural) {
        let innerType = "number";

        if (innerType === "number") {
            context.font = (circleDiameter * 0.41) + "px 'Nunito'";
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.fillStyle = "white";
            context.fillText(String(comboInfo.n), x + circleDiameter / 2, y + circleDiameter / 2 * 1.06); // 1.06 = my attempt to make it centered.
        } else {
            context.beginPath();
            context.arc(x + circleDiameter / 2, y + circleDiameter / 2, circleDiameter / 2 * 0.25, 0, Math.PI * 2);
            context.fillStyle = "white";
            context.fill();
        }
    } else if (DRAWING_MODE === DrawingMode.Skin) {
        //let numberWidth = 70 / 256 * GAME_STATE.currentPlay.csPixel,
        //    numberHeight = 104 / 256 * GAME_STATE.currentPlay.csPixel,
        //    numberString = comboInfo.n.toString(),
        //    hitCircleOverlap = 6;
//
        //for (let i = 0; i < numberString.length; i++) {
        //    context.drawImage(GAME_STATE.currentPlay.drawElements.numbers[numberString.charAt(i)], GAME_STATE.currentPlay.halfCsPixel - numberWidth * numberString.length / 2 + hitCircleOverlap * (numberString.length - 1) / 2 + ((numberWidth - hitCircleOverlap) * i), GAME_STATE.currentPlay.halfCsPixel - numberHeight / 2, numberWidth, numberHeight);
        //}
    }
}

// Updates the head and approach circle based on current time.
export function updateHeadElements(hitObject: DrawableCircle | DrawableSlider, currentTime: number) {
    let { ARMs, circleDiameter } = gameState.currentPlay;

    let fadeInCompletion = 1;
    let headScoring = hitObject.scoring.head;

    if (headScoring.hit === ScoringValue.NotHit) {
        if (currentTime < hitObject.startTime) {
            fadeInCompletion = (currentTime - (hitObject.hitObject.time - ARMs)) / ARMs;
            fadeInCompletion = MathUtil.clamp(fadeInCompletion, 0, 1);
            fadeInCompletion = MathUtil.ease(EaseType.EaseOutQuad, fadeInCompletion);

            let approachCircleAppearTime = hitObject.startTime - ARMs;
            let approachCircleCompletion = (currentTime - approachCircleAppearTime) / ARMs;
            approachCircleCompletion = MathUtil.clamp(approachCircleCompletion, 0, 1);

            let approachCircleFactor = (1-approachCircleCompletion) * 3 + 1; // Goes from 4.0 -> 1.0
            let approachCircleDiameter = circleDiameter * approachCircleFactor;
            hitObject.approachCircle.width = hitObject.approachCircle.height = approachCircleDiameter;

            hitObject.approachCircle.alpha = fadeInCompletion;
        } else {
            hitObject.approachCircle.visible = false;
        }
    } else {
        hitObject.approachCircle.visible = false;

        let time = headScoring.time;

        let fadeOutCompletion = (currentTime - (time)) / HIT_OBJECT_FADE_OUT_TIME;
        fadeOutCompletion = MathUtil.clamp(fadeOutCompletion, 0, 1);
        fadeOutCompletion = MathUtil.ease(EaseType.EaseOutQuad, fadeOutCompletion);

        let alpha = 1 - fadeOutCompletion;
        let scale = 1 + fadeOutCompletion * 0.333; // Max scale: 1.333

        hitObject.headSprite.alpha = alpha;
        if (headScoring.hit !== ScoringValue.Miss) { // Misses just fade out, whereas all other hit judgements also cause an 'expansion' effect
            hitObject.headSprite.width = circleDiameter * scale;
            hitObject.headSprite.height = circleDiameter * scale;
        }
    }

    return { fadeInCompletion };
}