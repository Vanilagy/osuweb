"use strict";

import {GraphicUtil} from "../util/graphicutil";
import {AUDIO_MANAGER, GAME_STATE, SCENE_MANAGER} from "../main";

export const POINT_DISTANCE = 32;
export const PRE_EMPT = 450;

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

        SCENE_MANAGER.getScene().elements["objectContainerDiv"].appendChild(this.canvas);
        this.ctx = this.canvas.getContext("2d");

        GAME_STATE.currentPlay.onScreenFollowPoints[this.startTime] = this;
    }

    render() {
        let duration = this.endTime - this.startTime;
        let relTime = AUDIO_MANAGER.getCurrentSongTime() - this.startTime;

        let renderStart = relTime / duration;
        let renderEnd = (relTime + PRE_EMPT) / duration;

        if(renderStart >= 1) {
            SCENE_MANAGER.getScene().elements["objectContainerDiv"].removeChild(this.canvas);
            delete GAME_STATE.currentPlay.onScreenFollowPoints[this.startTime];
            return;
        }

        if(!(renderEnd < 0 || renderStart > 1)) {
            let renderStartX = Math.max(0, Math.min(1, renderStart)) * this.length;
            let renderEndX = Math.max(0, Math.min(1, renderEnd)) * this.length;

            this.ctx.clearRect(0, 0, this.length, this.height);
            this.ctx.beginPath();
            this.ctx.rect(renderStartX, 0, renderEndX - renderStartX, this.height);
            this.ctx.fillStyle = "white";
            this.ctx.globalCompositeOperation = "source-over";
            this.ctx.fill();
            this.ctx.globalCompositeOperation = "destination-out";
            let fadeInLength = this.length * 0.2 * GraphicUtil.getPixelRatio();

            if (isNaN(renderStartX)) {
                //requestAnimationFrame(this.render.bind(this));
                return;
            }

            let leftGradient = this.ctx.createLinearGradient(renderStartX, 0, renderStartX + fadeInLength, 0);
            leftGradient.addColorStop(0, "rgba(255, 255, 255, 1.0)");
            leftGradient.addColorStop(1, "rgba(255, 255, 255, 0.0)");

            this.ctx.beginPath();
            this.ctx.rect(renderStartX, 0, fadeInLength, this.height);
            this.ctx.fillStyle = leftGradient;
            this.ctx.fill();

            let rightGradient = this.ctx.createLinearGradient(this.length - fadeInLength, 0, this.length, 0);
            rightGradient.addColorStop(0, "rgba(255, 255, 255, 0.0)");
            rightGradient.addColorStop(1, "rgba(255, 255, 255, 1.0)");

            this.ctx.beginPath();
            this.ctx.rect(this.length - fadeInLength, 0, fadeInLength, this.height);
            this.ctx.fillStyle = rightGradient;
            this.ctx.fill();
        }
    }
}