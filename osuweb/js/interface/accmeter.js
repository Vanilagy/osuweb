"use strict";

import {GAME_STATE, SCENE_MANAGER} from "../main";
import {MathUtil} from "../util/mathutil";
import {BeatmapDifficulty} from "../datamodel/beatmapdifficulty";
import {TransformationObjectField} from "../game/scenes/transformation";

export class AccMeter {
    constructor() {
        this.scale = 2;

        this.lastRatings = [];

        this._width = BeatmapDifficulty.getHitDeltaForRating(GAME_STATE.currentPlay.beatmap.difficulty.OD, 50) * 2 * this.scale;
        this._height = Math.round(GAME_STATE.screen.height * 0.04);

        /**
         * @type {HTMLCanvasElement}
         * @private
         */
        this._canvas = SCENE_MANAGER.getScene().elements["accmeterCanvas"];
        /**
         * @type {CanvasRenderingContext2D}
         * @private
         */
        this._ctx = this._canvas.getContext("2d");

        this._canvas.setAttribute("width", this._width+"px");
        this._canvas.setAttribute("height", this._height+"px");

        this._ctx.width = this._width;
        this._ctx.height = this._height;

        this._center = Math.floor(this._width / 2) - Math.floor(this.scale / 2);

        this._accArrowPos = 0;
        this._arrowTransformation = null;
    }

    render() {
        this._ctx.clearRect(0, 0, this._width, this._height);

        let accStripHeight = this._height * 0.2;
        let accStripWidth50 = BeatmapDifficulty.getHitDeltaForRating(GAME_STATE.currentPlay.beatmap.difficulty.OD, 50) * 2 * this.scale;
        let accStripWidth100 = BeatmapDifficulty.getHitDeltaForRating(GAME_STATE.currentPlay.beatmap.difficulty.OD, 100) * 2 * this.scale;
        let accStripWidth300 = BeatmapDifficulty.getHitDeltaForRating(GAME_STATE.currentPlay.beatmap.difficulty.OD, 300) * 2 * this.scale;

        this._ctx.fillStyle = "orange";
        this._ctx.fillRect(this._width / 2 - accStripWidth50 / 2, this._height / 2 - accStripHeight / 2, accStripWidth50, accStripHeight);
        this._ctx.fillStyle = "greenyellow";
        this._ctx.fillRect(this._width / 2 - accStripWidth100 / 2, this._height / 2 - accStripHeight / 2, accStripWidth100, accStripHeight);
        this._ctx.fillStyle = "deepskyblue";
        this._ctx.fillRect(this._width / 2 - accStripWidth300 / 2, this._height / 2 - accStripHeight / 2, accStripWidth300, accStripHeight);

        this._ctx.fillStyle = "white";
        this._ctx.fillRect(this._width / 2 - Math.floor(this.scale / 2), 0, this.scale, this._height);


        let deltaCount = 0;
        let deltaSum = 0;

        for (let index in this.lastRatings) {
            let rating = this.lastRatings[index];

            if (typeof rating === "function") continue;

            if (rating.time < window.performance.now() - 10000) {
                this.lastRatings.splice(index, 1);
            }
            else {
                this._ctx.fillStyle = rating.color;
                this._ctx.globalAlpha = 1 - Math.min(1, Math.max(0, (window.performance.now() - rating.time) / 10000));
                this._ctx.fillRect(rating.position - Math.floor(this.scale / 2), 0, this.scale, this._height);

                deltaSum += rating.delta;
                deltaCount++;
            }
        }
        this._ctx.globalAlpha = 1;

        if (this.newRating) {
            this.lastAvgDelta = deltaSum / deltaCount;

            if(this._arrowTransformation) this._arrowTransformation.cancel();
            this._arrowTransformation = new TransformationObjectField(this, "_accArrowPos", null, this.lastAvgDelta * this.scale, 500, "easeOutQuad").submit();

            this.newRating = false;
        }

        if (deltaCount > 0) {
            this._ctx.beginPath();
            this._ctx.moveTo(this._accArrowPos + this._width / 2, this._height * 0.35);
            this._ctx.lineTo(this._accArrowPos + this._width / 2 - this._height * 0.2, this._height * 0.05);
            this._ctx.lineTo(this._accArrowPos + this._width / 2 + this._height * 0.2, this._height * 0.05);
            this._ctx.lineTo(this._accArrowPos + this._width / 2, this._height * 0.35);
            this._ctx.fillStyle = "white";
            this._ctx.fill();
        }
    }

    addRating(timeDelta) {
        let color = null;

        if (Math.abs(timeDelta) < 79.5 - 6 * GAME_STATE.currentPlay.beatmap.difficulty.OD) {
            color = "deepskyblue";
        }
        else if (Math.abs(timeDelta) < 139.5 - 8 * GAME_STATE.currentPlay.beatmap.difficulty.OD) {
            color = "greenyellow";
        }
        else {
            color = "orange";
        }

        this.lastRatings.push({time: window.performance.now(), color: color, delta: timeDelta, position: this._center + this.scale * timeDelta});

        this.newRating = true;
    }
}