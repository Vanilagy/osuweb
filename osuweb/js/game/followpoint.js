"use strict";

import {GraphicUtil} from "../util/graphicutil";
import {AUDIO_MANAGER, GAME_STATE} from "../main";

export class FollowPoint {
    constructor(hitObjectStart, hitObjectEnd) {
        this.startTime = hitObjectStart.endTime;
        this.endTime = hitObjectEnd.startTime;
        this.startPos = {
            x: hitObjectStart.endPoint.x - hitObjectStart.stackHeight * 4,
            y: hitObjectStart.endPoint.y - hitObjectStart.stackHeight * 4
        };
        this.endPos = {
            x: hitObjectEnd.startPoint.x - hitObjectEnd.stackHeight * 4,
            y: hitObjectEnd.startPoint.y - hitObjectEnd.stackHeight * 4
        };

        this.length = Math.hypot(this.startPos.x - this.endPos.x, this.startPos.y - this.endPos.y) * GraphicUtil.getPixelRatio();
        this.height = 2 * GraphicUtil.getPixelRatio();
        this.angle = Math.atan2(this.endPos.y - this.startPos.y, this.endPos.x - this.startPos.x);
        this.centerPoint = {
            x: (this.startPos.x + this.endPos.x) / 2,
            y: (this.startPos.y + this.endPos.y) / 2
        };

    }

    spawn() {
        this.canvas = document.createElement("canvas");
        this.canvas.className = "followPoint";
        this.canvas.setAttribute("height", this.height);
        this.canvas.setAttribute("width", this.length);
        this.canvas.style.zIndex = 0;
        this.canvas.style.left = (this.centerPoint.x + GAME_STATE.currentPlay.marginWidth) * GraphicUtil.getPixelRatio() + "px";
        this.canvas.style.top = (this.centerPoint.y + GAME_STATE.currentPlay.marginHeight) * GraphicUtil.getPixelRatio() + "px";
        this.canvas.style.transform = "translate(-50%, -50%) rotate(" + this.angle + "rad)";

        GAME_STATE.currentScene.elements["objectContainerDiv"].appendChild(this.canvas);
        this.ctx = this.canvas.getContext("2d");

        this.update.bind(this)();
    }

    update() {
        let shouldEnd = AUDIO_MANAGER.getCurrentSongTime() >= this.endTime + 300;
        if (shouldEnd) {
            GAME_STATE.currentScene.elements["objectContainerDiv"].removeChild(this.canvas);
        } else {
            let timeDif = this.endTime - this.startTime;
            let startingPointX = Math.max(0, Math.min(1, (AUDIO_MANAGER.getCurrentSongTime() - (this.startTime + 300)) / timeDif)) * this.length;
            let endPointX = Math.max(0, Math.min(1, (AUDIO_MANAGER.getCurrentSongTime() - (this.startTime - 450)) / timeDif)) * this.length;
            this.ctx.clearRect(0, 0, this.length, this.height);
            this.ctx.beginPath();
            this.ctx.rect(startingPointX, 0, endPointX, this.height);
            this.ctx.fillStyle = "white";
            this.ctx.globalCompositeOperation = "source-over";
            this.ctx.fill();

            this.ctx.globalCompositeOperation = "destination-out";
            let fadeInLength = 90 * GraphicUtil.getPixelRatio();

            if (isNaN(startingPointX) && !shouldEnd) {
                //requestAnimationFrame(this.render.bind(this));
                return;
            }

            let leftGradient = this.ctx.createLinearGradient(startingPointX, 0, startingPointX + fadeInLength, 0);
            leftGradient.addColorStop(0, "rgba(255, 255, 255, 1.0)");
            leftGradient.addColorStop(1, "rgba(255, 255, 255, 0.0)");

            this.ctx.beginPath();
            this.ctx.rect(startingPointX, 0, fadeInLength, this.height);
            this.ctx.fillStyle = leftGradient;
            this.ctx.fill();

            let rightGradient = this.ctx.createLinearGradient(this.length - fadeInLength, 0, this.length, 0);
            rightGradient.addColorStop(0, "rgba(255, 255, 255, 0.0)");
            rightGradient.addColorStop(1, "rgba(255, 255, 255, 1.0)");

            this.ctx.beginPath();
            this.ctx.rect(this.length - fadeInLength, 0, fadeInLength, this.height);
            this.ctx.fillStyle = rightGradient;
            this.ctx.fill();

            requestAnimationFrame(this.update.bind(this));
        }
    }
}