"use strict";

import {GAME_STATE, AUDIO_MANAGER, SCENE_MANAGER} from "../main";

export class ProgressBar {
    constructor() {
        // TODO: insert real max width of accuracy text
        SCENE_MANAGER.getScene().elements.accContainerDiv.style.width = "calc(5vh + 1vw + 6vw)";

        this.canvas = SCENE_MANAGER.getScene().elements.progressCanvas;
        this.ctx = this.canvas.getContext("2d");

        this.prelude = 2000;
        this.mapStartTime = GAME_STATE.currentPlay.beatmap.hitObjects[0].startTime;
        this.mapEndTime = GAME_STATE.currentPlay.beatmap.hitObjects[GAME_STATE.currentPlay.beatmap.hitObjects.length - 1].endTime;

        this.sizeSet = false;
    }

    render() {
        if (!this.sizeSet && this.canvas.clientWidth > 0) {
            this.canvas.width = this.canvas.clientWidth;
            this.canvas.height = this.canvas.clientHeight;

            this.sizeSet = true;
        }

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.beginPath();
        this.ctx.lineWidth = this.canvas.height / 2.0 + 1;
        if (GAME_STATE.currentPlay.audioStarted && AUDIO_MANAGER.getCurrentSongTime() < this.mapStartTime) {
            let preludeProgress = (AUDIO_MANAGER.getCurrentSongTime() + this.prelude) / (this.mapStartTime + this.prelude);

            this.ctx.strokeStyle = "rgba(0,255,0,0.5)";
            this.ctx.arc(this.canvas.width / 2.0, this.canvas.height / 2.0, this.canvas.height / 4.0 - 3, Math.PI * 2 * preludeProgress + Math.PI * 1.5, Math.PI * 1.5);
        }
        else if (GAME_STATE.currentPlay.audioStarted) {
            let songProgress = (AUDIO_MANAGER.getCurrentSongTime() - this.mapStartTime) / (this.mapEndTime - this.mapStartTime);

            if (songProgress > 1) songProgress = 1;

            this.ctx.strokeStyle = "rgba(200,200,200,0.8)";
            this.ctx.arc(this.canvas.width / 2.0, this.canvas.height / 2.0, this.canvas.height / 4.0 - 3, Math.PI * 1.5, Math.PI * 2 * songProgress + Math.PI * 1.5);
        }
        this.ctx.stroke();


        this.ctx.beginPath();
        this.ctx.fillStyle = "white";
        this.ctx.arc(this.canvas.width / 2.0, this.canvas.height / 2.0, 3, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.beginPath();
        this.ctx.strokeStyle = "white";
        this.ctx.lineWidth = 3;
        this.ctx.arc(this.canvas.width / 2.0, this.canvas.height / 2.0, this.canvas.height / 2.0 - 2, 0, Math.PI * 2);
        this.ctx.stroke();
    }
}