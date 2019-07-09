import { HitObject } from "../datamodel/hit_object";
import { gameState } from "./game_state";
import { ComboInfo } from "./processed_beatmap";
import { Point } from "../util/point";
import { CIRCLE_BORDER_WIDTH, DRAWING_MODE } from "../util/constants";

export abstract class DrawableHitObject {
    public id: number = 0;
    public comboInfo: ComboInfo;
    public hitObject: HitObject;
    public container: PIXI.Container;
    public approachCircle: PIXI.Sprite;
    public stackHeight: number = 0;

    public x: number;
    public y: number;
    public startPoint: Point;
    public endPoint: Point;
    public startTime: number;
    public endTime: number;

    constructor(hitObject: HitObject) {
        this.hitObject = hitObject;
        this.container = new PIXI.Container();
        this.approachCircle;

        this.startPoint = {
            x: this.hitObject.x,
            y: this.hitObject.y
        };
        this.startTime = this.hitObject.time;

        this.x = this.hitObject.x;
        this.y = this.hitObject.y;
    }

    abstract draw(): any;

    abstract show(currentTime: number): any;

    abstract update(currentTime: number): any;

    abstract remove(): any;

    applyStackPosition() {
        this.x += this.stackHeight * -4;
        this.y += this.stackHeight * -4;
    }
}

export function drawCircle(context: CanvasRenderingContext2D, x: number, y: number, comboInfo: ComboInfo) { // Draws circle used for Hit Circles, Slider Heads and Repeat Tails
    let { circleDiameter, processedBeatmap } = gameState.currentPlay;

    let color = comboInfo.color;

    //color = {r: 255, g: 20, b: 20};

    if (DRAWING_MODE === 0) {
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
    } else if (DRAWING_MODE === 1) {
        //context.drawImage(GAME_STATE.currentPlay.drawElements.coloredHitcircles[comboInfo.comboNum % GAME_STATE.currentBeatmap.colors.length], x, y);
    }

    context.globalCompositeOperation = "source-over";
    if (DRAWING_MODE === 0) {
        let innerType = "number";

        if (innerType === "number") {
            context.font = (circleDiameter * 0.41) + "px 'Nunito'";
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.fillStyle = "white";
            context.fillText(String(comboInfo.n), x + circleDiameter / 2, y + circleDiameter / 2 * 1.05)
        } else {
            context.beginPath();
            context.arc(x + circleDiameter / 2, y + circleDiameter / 2, circleDiameter / 2 * 0.25, 0, Math.PI * 2);
            context.fillStyle = "white";
            context.fill();
        }
    } else if (DRAWING_MODE === 1) {
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