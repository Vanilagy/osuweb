import { HitObject } from "../datamodel/hit_object";
import { gameState } from "./game_state";

export abstract class DrawableHitObject {
    public id: number = 0;
    public comboInfo: any;
    public hitObject: HitObject;
    public container: any;
    public approachCircle: any;

    constructor(hitObject: HitObject) {
        this.hitObject = hitObject;
        this.container = new PIXI.Container();
        this.approachCircle = null;
    }

    draw() {}

    show(currentTime: number) {}

    update(currentTime: number) {}

    remove() {}
}

export const DRAWING_MODE = 0;
export const CIRCLE_BORDER_WIDTH = 1.75 / 16;
export function drawCircle(context: CanvasRenderingContext2D, x: number, y: number, comboInfo: any) { // Draws circle used for Hit Circles, Slider Heads and Repeat Tails
    let colourArray = gameState.currentPlay!.processedBeatmap.beatmap.colours;
    let colour = colourArray[comboInfo.comboNum % colourArray.length];

    //let colour = {r: 255, g: 20, b: 20};


    if (DRAWING_MODE === 0) {
        context.beginPath(); // Draw circle base (will become border)
        context.arc(x + gameState.currentPlay!.circleDiameter! / 2, y + gameState.currentPlay!.circleDiameter! / 2, gameState.currentPlay!.circleDiameter! / 2, 0, Math.PI * 2);
        context.fillStyle = "white";
        context.fill();

        let colourString = "rgb(" + Math.round(colour.r * 0.68) + "," + Math.round(colour.g * 0.68) + "," + Math.round(colour.b * 0.68) + ")";
        let darkColourString = "rgb(" + Math.round(colour.r * 0.2) + "," + Math.round(colour.g * 0.2) + "," + Math.round(colour.b * 0.2) + ")";

        let radialGradient = context.createRadialGradient(x + gameState.currentPlay!.circleDiameter! / 2, y + gameState.currentPlay!.circleDiameter! / 2, 0, x + gameState.currentPlay!.circleDiameter! / 2, y + gameState.currentPlay!.circleDiameter! / 2, gameState.currentPlay!.circleDiameter! / 2);
        radialGradient.addColorStop(0, colourString);
        radialGradient.addColorStop(1, darkColourString);

        context.beginPath(); // Draw circle body with radial gradient
        context.arc(x + gameState.currentPlay!.circleDiameter! / 2, y + gameState.currentPlay!.circleDiameter! / 2, (gameState.currentPlay!.circleDiameter! / 2) * (1 - CIRCLE_BORDER_WIDTH), 0, Math.PI * 2);
        context.fillStyle = radialGradient;
        context.fill();
        context.fillStyle = "rgba(255, 255, 255, 0.5)";
        context.globalCompositeOperation = "destination-out"; // Transparency
        context.fill();
    } else if (DRAWING_MODE === 1) {
        //context.drawImage(GAME_STATE.currentPlay.drawElements.coloredHitcircles[comboInfo.comboNum % GAME_STATE.currentBeatmap.colours.length], x, y);
    }

    context.globalCompositeOperation = "source-over";
    if (DRAWING_MODE === 0) {
        let innerType = "dot";

        if (innerType === "number") {
            //context.font = "lighter " + (GAME_STATE.currentPlay.csPixel * 0.41) + "px monospace";
            //context.textAlign = "center";
            //context.textBaseline = "middle";
            //context.fillStyle = "white";
            //context.fillText(/*comboInfo.n*/ Math.ceil(Math.random() * 9), x + circleDiameter / 2, y + circleDiameter / 2)
        } else {
            context.beginPath();
            context.arc(x + gameState.currentPlay!.circleDiameter! / 2, y + gameState.currentPlay!.circleDiameter! / 2, gameState.currentPlay!.circleDiameter! / 2 * 0.25, 0, Math.PI * 2);
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