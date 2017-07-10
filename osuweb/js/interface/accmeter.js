"use strict";

import {GAME_STATE, SCENE_MANAGER} from "../main";
import {MathUtil} from "../util/mathutil";

export class AccMeter {
    constructor() {
        this.scale = 2;
        this.wrapper = SCENE_MANAGER.getScene().elements.accmeterDiv;

        this.lastRatings = [];

        SCENE_MANAGER.getScene().elements.accmeterDiv.style.width = (199.5 - 10 * GAME_STATE.currentPlay.beatmap.difficulty.OD) * 2 * this.scale;

        SCENE_MANAGER.getScene().elements.accstrip50Div.style.width = (199.5 - 10 * GAME_STATE.currentPlay.beatmap.difficulty.OD) * 2 * this.scale;
        SCENE_MANAGER.getScene().elements.accstrip100Div.style.width = (139.5 - 8 * GAME_STATE.currentPlay.beatmap.difficulty.OD) * 2 * this.scale;
        SCENE_MANAGER.getScene().elements.accstrip300Div.style.width = (79.5 - 6 * GAME_STATE.currentPlay.beatmap.difficulty.OD) * 2 * this.scale;

        SCENE_MANAGER.getScene().elements.acctickXDiv.style.width = this.scale;

        this.center = Math.floor((199.5 - 10 * GAME_STATE.currentPlay.beatmap.difficulty.OD) * 2 * this.scale / 2) - Math.floor(this.scale / 2);
    }

    render() {
        let deltaCount = 0;
        let deltaSum = 0;

        for (let index in this.lastRatings) {
            let rating = this.lastRatings[index];

            if (typeof rating === "function") continue;

            if (rating.time < window.performance.now() - 10000) {
                this.lastRatings.splice(index, 1);

                this.wrapper.removeChild(rating._element);
            }
            else {
                deltaSum += rating.delta;
                deltaCount++;
            }
        }

        if (deltaCount === 0) {
            SCENE_MANAGER.getScene().elements.accarrowImg.style.display = "none";
        }

        if (this.newRating) {
            this.lastAvgDelta = deltaSum / deltaCount;

            if (deltaCount > 0) {
                SCENE_MANAGER.getScene().elements.accarrowImg.style.display = "block";

                let oldValue = Math.round(SCENE_MANAGER.getScene().elements.accarrowImg.style.left.substr(0, SCENE_MANAGER.getScene().elements.accarrowImg.style.left.length - 2));
                let newValue = SCENE_MANAGER.getScene().elements.accmeterDiv.clientWidth / 2 - SCENE_MANAGER.getScene().elements.accarrowImg.clientWidth / 2.0 + this.lastAvgDelta * this.scale;

                if (SCENE_MANAGER.getScene().elements.accarrowImg.style.left === "") {
                    SCENE_MANAGER.getScene().elements.accarrowImg.style.left = newValue;
                }
                else {
                    MathUtil.interpolate(oldValue, newValue, 500, "easeOutQuad", function (val) {
                        SCENE_MANAGER.getScene().elements.accarrowImg.style.left = val;
                    }, "accarrow", 60);
                }
            }

            this.newRating = false;
        }
    }

    addRating(timeDelta) {
        let tickDiv = document.createElement("div");

        tickDiv.className = "acctick";

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

        tickDiv.style.left = (this.center + this.scale * timeDelta) + "px";
        tickDiv.style.width = this.scale + "px";
        tickDiv.style.backgroundColor = color;

        this.wrapper.appendChild(tickDiv);

        this.lastRatings.push({time: window.performance.now(), delta: timeDelta, _element: tickDiv});

        this.newRating = true;
    }
}