"use strict";

import {GAME_STATE} from "../main";
import {DRAWING_MODE} from "../game/drawablehitobject";

export const PI2 = Math.PI * 2;
export const CIRCLE_BORDER_WIDTH = 1.75 / 16; // in relation to circle radius

const windowDimensions = {
    width: 640,
    height: 480
};
const playfieldDimensions = {
    width: 512,
    height: 384
};
const screenDimensions = {
    width: 640,
    height: 480
};

export class GraphicUtil {
    static getAspectRatio() {
        let baseDimensions = this.getBasePlayfieldDimensions();

        return baseDimensions.height / baseDimensions.width;
    }
    static setWindowDimensions(width, height) {
        windowDimensions.width = width;
        windowDimensions.height = height;
    }
    static getWindowDimensions() {
        return windowDimensions;
    }
    static getBasePlayfieldDimensions() {
        return playfieldDimensions;
    }
    static getBaseScreenDimensions() {
        return screenDimensions;
    }
    static getGameScalingFactor() {
        return GAME_STATE.screen.height / 480;
    }
    static getUIScalingFactor() {
        return GAME_STATE.screen.height / 1080;
    }
    static getPlayAreaDimensions() {
        let playAreaHeight = Math.floor(window.innerHeight * 0.95 / 4) * 4;
        let playAreaWidth = playAreaHeight / GraphicUtil.getAspectRatio();

        return {width: playAreaWidth, height: playAreaHeight};
    }
    static getPixelRatio() {
        return GraphicUtil.getPlayAreaDimensions().width / GraphicUtil.getBaseScreenDimensions().width;
    }
    static drawCircle(context, x, y, comboInfo) { // Draws circle used for Hit Circles, Slider Heads and Repeat Tails
        let colour = GAME_STATE.currentBeatmap.colours[comboInfo.comboNum % GAME_STATE.currentBeatmap.colours.length];

        if (DRAWING_MODE === 0) {
            context.beginPath(); // Draw circle base (will become border)
            context.arc(x + GAME_STATE.currentPlay.halfCsPixel, y + GAME_STATE.currentPlay.halfCsPixel, GAME_STATE.currentPlay.halfCsPixel, 0, PI2);
            context.fillStyle = "white";
            context.fill();

            let colourString = "rgb(" + Math.round(colour.r * 0.68) + "," + Math.round(colour.g * 0.68) + "," + Math.round(colour.b * 0.68) + ")";
            let darkColourString = "rgb(" + Math.round(colour.r * 0.2) + "," + Math.round(colour.g * 0.2) + "," + Math.round(colour.b * 0.2) + ")";

            let radialGradient = context.createRadialGradient(x + GAME_STATE.currentPlay.halfCsPixel, y + GAME_STATE.currentPlay.halfCsPixel, 0, x + GAME_STATE.currentPlay.halfCsPixel, y + GAME_STATE.currentPlay.halfCsPixel, GAME_STATE.currentPlay.halfCsPixel);
            radialGradient.addColorStop(0, colourString);
            radialGradient.addColorStop(1, darkColourString);

            context.beginPath(); // Draw circle body with radial gradient
            context.arc(x + GAME_STATE.currentPlay.halfCsPixel, y + GAME_STATE.currentPlay.halfCsPixel, (GAME_STATE.currentPlay.halfCsPixel) * (1 - CIRCLE_BORDER_WIDTH), 0, PI2);
            context.fillStyle = radialGradient;
            context.fill();
            context.fillStyle = "rgba(255, 255, 255, 0.5)";
            context.globalCompositeOperation = "destination-out"; // Transparency
            context.fill();
        } else if (DRAWING_MODE === 1) {
            context.drawImage(GAME_STATE.currentPlay.drawElements.coloredHitcircles[comboInfo.comboNum % GAME_STATE.currentBeatmap.colours.length], x, y);
        }

        context.globalCompositeOperation = "source-over";
        if (DRAWING_MODE === 0) {
            let innerType = "number";

            if (innerType === "number") {
                context.font = "lighter " + (GAME_STATE.currentPlay.csPixel * 0.41) + "px Space_Mono";
                context.textAlign = "center";
                context.textBaseline = "middle";
                context.fillStyle = "white";
                context.fillText(comboInfo.n, x + GAME_STATE.currentPlay.halfCsPixel, y + GAME_STATE.currentPlay.halfCsPixel)
            } else {
                context.beginPath();
                context.arc(x + GAME_STATE.currentPlay.halfCsPixel, y + GAME_STATE.currentPlay.halfCsPixel, GAME_STATE.currentPlay.halfCsPixel * 0.25, 0, PI2);
                context.fillStyle = "white";
                context.fill();
            }
        } else if (DRAWING_MODE === 1) {
            let numberWidth = 70 / 256 * GAME_STATE.currentPlay.csPixel,
                numberHeight = 104 / 256 * GAME_STATE.currentPlay.csPixel,
                numberString = comboInfo.n.toString(),
                hitCircleOverlap = 6;

            for (let i = 0; i < numberString.length; i++) {
                context.drawImage(GAME_STATE.currentPlay.drawElements.numbers[numberString.charAt(i)], GAME_STATE.currentPlay.halfCsPixel - numberWidth * numberString.length / 2 + hitCircleOverlap * (numberString.length - 1) / 2 + ((numberWidth - hitCircleOverlap) * i), GAME_STATE.currentPlay.halfCsPixel - numberHeight / 2, numberWidth, numberHeight);
            }
        }
    }
    static drawApproachCircle(context, x, y, comboNum) {
        context.beginPath();
        context.arc(x + GAME_STATE.currentPlay.halfCsPixel, y + GAME_STATE.currentPlay.halfCsPixel, (GAME_STATE.currentPlay.halfCsPixel - 5) * ((1 - CIRCLE_BORDER_WIDTH) + 1) / 2, 0, PI2);
        let color = GAME_STATE.currentPlay.beatmap.colours[comboNum % GAME_STATE.currentPlay.beatmap.colours.length];
        context.strokeStyle = "rgb(" + color.r + ", " + color.g + ", " + color.b + ")";
        context.lineWidth = GAME_STATE.currentPlay.halfCsPixel * CIRCLE_BORDER_WIDTH / 2.75;
        context.stroke();
    }
    static getCoordFromCoordArray(arr, percent) {
        let actualIdx = percent * (arr.length - 1);
        let lowerIdx = Math.floor(actualIdx), upperIdx = Math.ceil(actualIdx);
        let lowerPos = arr[lowerIdx];
        let upperPos = arr[upperIdx];

        return { // Linear interpolation
            x: lowerPos.x * (1 - (actualIdx - lowerIdx)) + upperPos.x * (actualIdx - lowerIdx),
            y: lowerPos.y * (1 - (actualIdx - lowerIdx)) + upperPos.y * (actualIdx - lowerIdx)
        }
    }
}