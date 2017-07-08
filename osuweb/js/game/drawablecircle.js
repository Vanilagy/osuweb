"use strict";

import {DrawableHitObject} from "./drawablehitobject";
import {GAME_STATE} from "../main";
import {GraphicUtil} from "../util/graphicutil";

export class DrawableCircle extends DrawableHitObject {
    constructor(circle, beatmap) {
        super(circle);

        this.beatmap = beatmap;
        this.hittable = true;
    }

    hit(timeDelta) {
        let score = GAME_STATE.currentPlay.beatmap.difficulty.getRatingForHitDelta(Math.abs(timeDelta));
        this.hittable = false;

        if (score) {
            GAME_STATE.currentPlay.score.addScore(score, false, false, this);
            DrawableHitObject.playHitSound(this.hitSoundInfo);
            GAME_STATE.currentPlay.accmeter.addRating(timeDelta);
        } else {
            GAME_STATE.currentPlay.score.addScore(0, false, true, this);
        }

        this.containerDiv.style.animation = (score) ? "0.10s destroyHitCircle linear forwards" : "0.10s fadeOut linear forwards";
        this.approachCircleCanvas.style.display = "none";
    }

    destroy() {
        this.remove();

        this.containerDiv = null;
        this.baseCanvas = null;
        this.baseCtx = null;
        this.approachCircleCanvas = null;
    }

    draw() {
        let pixelRatio = GraphicUtil.getPixelRatio();

        this.containerDiv = document.createElement("div");
        this.containerDiv.className = "hitCircleContainer";
        this.containerDiv.style.width = GAME_STATE.currentPlay.csPixel + "px";
        this.containerDiv.style.height = GAME_STATE.currentPlay.csPixel + "px";
        this.containerDiv.style.left = ((this.x + GAME_STATE.currentPlay.marginWidth) * pixelRatio - GAME_STATE.currentPlay.halfCsPixel) + "px";
        this.containerDiv.style.top = ((this.y + GAME_STATE.currentPlay.marginHeight) * pixelRatio - GAME_STATE.currentPlay.halfCsPixel) + "px";
        this.containerDiv.style.zIndex = this.zIndex;

        this.containerDiv.style.visibility = "hidden";
        this.containerDiv.style.opacity = 0;
        this.containerDiv.style.transform = "translateZ(0)";
        this.containerDiv.style.backfaceVisibility = "hidden";
        this.containerDiv.style.transition = "opacity " + (GAME_STATE.currentPlay.ARMs / 1000 / 3) + "s linear";

        this.baseCanvas = document.createElement("canvas"); // Create local object canvas
        this.baseCanvas.setAttribute("width", GAME_STATE.currentPlay.csPixel);
        this.baseCanvas.setAttribute("height", GAME_STATE.currentPlay.csPixel);

        this.baseCtx = this.baseCanvas.getContext("2d");
        GraphicUtil.drawCircle(this.baseCtx, 0, 0, this.comboInfo);

        this.approachCircleCanvas = document.createElement("canvas");
        this.approachCircleCanvas.setAttribute("width", GAME_STATE.currentPlay.csPixel);
        this.approachCircleCanvas.setAttribute("height", GAME_STATE.currentPlay.csPixel);
        this.approachCircleCanvas.style.transform = "scale(4)";

        let approachCtx = this.approachCircleCanvas.getContext("2d");
        GraphicUtil.drawApproachCircle(approachCtx, 0, 0, this.comboInfo.comboNum);

        this.containerDiv.appendChild(this.baseCanvas);
        this.containerDiv.appendChild(this.approachCircleCanvas);
    }
}