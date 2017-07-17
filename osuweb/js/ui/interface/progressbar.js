"use strict";

import {GAME_STATE, AUDIO_MANAGER, SCENE_MANAGER} from "../../main";

export class ProgressBar {
    constructor() {
        this._canvas = SCENE_MANAGER.getScene().elements.progressCanvas;
        this.ctx = this._canvas.getContext("2d");

        this.prelude = GAME_STATE.currentPlay.audioInterlude;
        this.mapStartTime = GAME_STATE.currentPlay.beatmap.hitObjects[0].startTime;
        this.mapEndTime = GAME_STATE.currentPlay.beatmap.hitObjects[GAME_STATE.currentPlay.beatmap.hitObjects.length - 1].endTime;

        this.sizeSet = false;
    }

    render(currentTime) {
        if (!this.sizeSet && this._canvas.clientWidth > 0) {
            this._canvas.width = this._canvas.clientWidth;
            this._canvas.height = this._canvas.clientHeight;

            this.sizeSet = true;
        }

        this.ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);

        this.ctx.beginPath();
        this.ctx.lineWidth = this._canvas.height / 2.0 + 1;
        if (GAME_STATE.currentPlay.audioStarted && currentTime < this.mapStartTime) {
            let preludeProgress = (currentTime + this.prelude) / (this.mapStartTime + this.prelude);

            this.ctx.strokeStyle = "rgba(0,255,0,0.5)";
            this.ctx.arc(this._canvas.width / 2.0, this._canvas.height / 2.0, this._canvas.height / 4.0 - 3, -Math.PI / 2, preludeProgress * Math.PI * 2 - Math.PI / 2);
        }
        else if (GAME_STATE.currentPlay.audioStarted) {
            let songProgress = (currentTime - this.mapStartTime) / (this.mapEndTime - this.mapStartTime);

            if (songProgress > 1) songProgress = 1;

            this.ctx.strokeStyle = "rgba(200,200,200,0.8)";
            this.ctx.arc(this._canvas.width / 2.0, this._canvas.height / 2.0, this._canvas.height / 4.0 - 3, -Math.PI / 2, songProgress * Math.PI * 2 - Math.PI / 2);
        }
        this.ctx.stroke();


        this.ctx.beginPath();
        this.ctx.fillStyle = "white";
        this.ctx.arc(this._canvas.width / 2.0, this._canvas.height / 2.0, 3, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.beginPath();
        this.ctx.strokeStyle = "white";
        this.ctx.lineWidth = 3;
        this.ctx.arc(this._canvas.width / 2.0, this._canvas.height / 2.0, this._canvas.height / 2.0 - 2, 0, Math.PI * 2);
        this.ctx.stroke();
    }
}