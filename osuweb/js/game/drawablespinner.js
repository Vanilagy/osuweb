"use strict";

import {GAME_STATE, AUDIO_MANAGER, SCENE_MANAGER} from "../main";
import {INPUT_STATE, InputUtil} from "../util/inpututil";
import {GraphicUtil, PI2} from "../util/graphicutil";
import {DrawableHitObject} from "./drawablehitobject";
import {MathUtil} from "../util/mathutil";

export class DrawableSpinner extends DrawableHitObject {
    constructor(spinner, beatmap) {
        super(spinner);

        this.beatmap = beatmap;
        this.endTime = spinner.endTime;

        this.duration = this.endTime - this.startTime;
        this.requiredSpins = (100 + beatmap.difficulty.OD * 15) * this.duration / 60000 * 0.88; // This shit's approximate af. But I mean it's ppy.
        this.active = false;
        this.cleared = false;
        this.completed = false;
        this.absoluteDegreesRotated = 0;
        this.totalDegreesRotated = 0;
        this.completedSpins = 0;
        this.completedBonusSpins = 0;
        this.SPMSamples = [0];
        this.lastTimeSampled = null;
        this.readyForSound = false;

        this.centerRadius = 5;
    }

    destroy() {
        this.remove();

        this.containerDiv = null;
        this.approachCircleCanvas = null;
        this.spmContainer = null;
        this.bonusSpinsCounter = null;
        this.hasBeenClearedDisplay = null;
        this.circleElement = null;
    }

    remove() {
        if(SCENE_MANAGER.getScene().elements["spinnerContainerContainer"].contains(this.containerDiv)) SCENE_MANAGER.getScene().elements["spinnerContainerContainer"].removeChild(this.containerDiv);
    }

    append() {
        SCENE_MANAGER.getScene().elements["spinnerContainerContainer"].appendChild(this.containerDiv);
    }

    show() {
        this.containerDiv.style.visibility = "visible";
        this.containerDiv.style.transition = "opacity 0.4s linear";
        this.containerDiv.style.opacity = 1;
        this.spmContainer.style.transform = "translate(-50%, 0)";

        this.render();
    }

    render() {
        let accurateCurrentTime = AUDIO_MANAGER.getCurrentSongTime();
        let completion = (accurateCurrentTime - this.startTime) / this.duration;

        if (completion >= 1) return;

        if (accurateCurrentTime >= this.startTime && accurateCurrentTime < this.endTime) {
            let currentAngle = Math.atan2(InputUtil.getCursorPlayfieldCoords().y - 192, InputUtil.getCursorPlayfieldCoords().x - 256);
            let angleDifference = 0;
            let now = window.performance.now();
            let timeDifference = this.lastTimeSampled === null ? 0 : now - this.lastTimeSampled;

            if (this.lastPoint !== undefined && INPUT_STATE.isHolding || GAME_STATE.currentPlay.autoplay) {
                if (GAME_STATE.currentPlay.autoplay) {
                    angleDifference = 10000; // something large (like my dick - A)
                } else {
                    let angleFromLastPoint = Math.atan2(InputUtil.getCursorPlayfieldCoords().y - this.lastPoint.y, InputUtil.getCursorPlayfieldCoords().x - this.lastPoint.x);
                    let optimalAngle = Math.atan2(Math.sin(currentAngle) - Math.sin(this.lastAngle), Math.cos(currentAngle) - Math.cos(this.lastAngle));
                    angleDifference = MathUtil.getNormalizedAngleDelta(currentAngle, this.lastAngle);
                    let circularInaccuracy = MathUtil.getNormalizedAngleDelta(angleFromLastPoint, optimalAngle);
                    let pheta = MathUtil.getNormalizedAngleDelta(currentAngle, optimalAngle); // angle between mousePos, center point and optimalAngle
                    let circularCorrectness = 1 - Math.abs(circularInaccuracy) / Math.abs(pheta) * 0.15 /* less punishment */;

                    angleDifference *= circularCorrectness;
                }

                angleDifference = Math.min(angleDifference, 0.05 * timeDifference /* peppy only allows 5% a spin per millisecond */);

                this.absoluteDegreesRotated += Math.abs(angleDifference);
                this.totalDegreesRotated += angleDifference;

                if (angleDifference && this.readyForSound) {
                    let skin = GAME_STATE.currentSkin || GAME_STATE.defaultSkin;
                    let audioObj = skin.skinElements["spinnerspin"];

                    AUDIO_MANAGER.playSound(audioObj, this.hitSoundInfo.volume);

                    this.readyForSound = false;
                }
            }

            this.SPMSamples.push(Math.abs((angleDifference / (Math.PI * 2)) / timeDifference) * 60000);
            if (this.SPMSamples.length > 12) {
                this.SPMSamples.splice(0, 1);
            }

            this.lastTimeSampled = now;
            this.lastPoint = InputUtil.getCursorPlayfieldCoords();
            this.lastAngle = currentAngle;

            this.updateApproachCircle(Math.max(0, 1 - completion));
            this.circleElement.style.transform = "translate(-50%, -50%) rotate(" + this.totalDegreesRotated + "rad)";
            this.spmDisplay.innerHTML = "SPM: " + Math.floor(MathUtil.getAvg(this.SPMSamples));
        }
    }

    clear() {
        this.cleared = true;
        this.hasBeenClearedDisplay.style.opacity = 1;
    }

    scoreBonusSpin() {
        let newCompletedBonusSpins = Math.floor((this.absoluteDegreesRotated - this.requiredSpins * Math.PI * 2) / (Math.PI * 2));
        GAME_STATE.currentPlay.score.addScore((newCompletedBonusSpins - this.completedBonusSpins) * 1000, true, true);
        this.completedBonusSpins = newCompletedBonusSpins;
        this.bonusSpinsCounter.innerHTML = newCompletedBonusSpins * 1000;
        this.bonusSpinsCounter.style.animation = "none";
        this.bonusSpinsCounter.style.animation = "0.15s increaseSpinnerBonus ease-out forwards";

        let skin = GAME_STATE.currentSkin || GAME_STATE.defaultSkin;
        let audioObj = skin.skinElements["spinnerbonus"];

        AUDIO_MANAGER.playSound(audioObj, this.hitSoundInfo.volume);
    }

    score() {
        let spinsSpinned = this.absoluteDegreesRotated / (Math.PI * 2);

        if (spinsSpinned < this.requiredSpins) {
            GAME_STATE.currentPlay.score.addScore(0, false, true, this);
        } else {
            DrawableHitObject.playHitSound(this.hitSoundInfo);

            GAME_STATE.currentPlay.score.addScore((function () {
                if (spinsSpinned >= this.requiredSpins + 0.5) {
                    return 300;
                } else if (spinsSpinned >= this.requiredSpins + 0.25) {
                    return 100;
                } else {
                    return 50;
                }
            }.bind(this)()), false, false, this);
        }
    }

    draw() {
        let pixelRatio = GraphicUtil.getPixelRatio();

        this.containerDiv = document.createElement("div");
        this.containerDiv.className = "spinnerContainer";
        this.containerDiv.style.visibility = "hidden";
        this.containerDiv.style.opacity = 0;

        this.circleElement = document.createElement("canvas");
        this.circleElement.setAttribute("width", 70 * pixelRatio);
        this.circleElement.setAttribute("height", 70 * pixelRatio);
        this.circleElement.className = "center";

        let circleCtx = this.circleElement.getContext("2d");

        circleCtx.arc(35 * pixelRatio, 35 * pixelRatio, 30 * pixelRatio, -Math.PI * 0.75, -Math.PI * 0.25);
        circleCtx.lineWidth = 10 * pixelRatio;
        circleCtx.strokeStyle = "white";
        circleCtx.stroke();

        circleCtx.beginPath();
        circleCtx.arc(35 * pixelRatio, 35 * pixelRatio, this.centerRadius * pixelRatio, 0, PI2);
        circleCtx.fillStyle = "white";
        circleCtx.fill();

        this.containerDiv.appendChild(this.circleElement);

        this.approachCircleElement = document.createElement("canvas");
        this.approachCircleElement.setAttribute("width", 400 * pixelRatio);
        this.approachCircleElement.setAttribute("height", 400 * pixelRatio);
        this.approachCircleElement.className = "center";

        this.approachCircleCtx = this.approachCircleElement.getContext("2d");

        this.updateApproachCircle(1);
        this.containerDiv.appendChild(this.approachCircleElement);

        let spinnerTitle = document.createElement("h1");
        spinnerTitle.innerHTML = "Spin!";
        spinnerTitle.style.fontSize = 35 * pixelRatio + "px";
        spinnerTitle.style.bottom = 80 * pixelRatio + "px";
        this.containerDiv.appendChild(spinnerTitle);

        this.hasBeenClearedDisplay = document.createElement("h1");
        this.hasBeenClearedDisplay.innerHTML = "Clear!";
        this.hasBeenClearedDisplay.style.fontSize = 31 * pixelRatio + "px";
        this.hasBeenClearedDisplay.style.top = 125 * pixelRatio + "px";
        this.hasBeenClearedDisplay.style.opacity = 0;
        this.hasBeenClearedDisplay.style.transition = "opacity 0.4s";
        this.containerDiv.appendChild(this.hasBeenClearedDisplay);

        this.bonusSpinsCounter = document.createElement("h1");
        this.bonusSpinsCounter.style.fontSize = 50 * pixelRatio + "px";
        this.bonusSpinsCounter.style.fontFamily = "monospace";
        this.bonusSpinsCounter.style.bottom = 120 * pixelRatio + "px";
        this.bonusSpinsCounter.style.fontWeight = 100;
        this.containerDiv.appendChild(this.bonusSpinsCounter);

        this.spmContainer = document.createElement("div");
        this.spmContainer.className = "spmContainer";

        this.spmDisplay = document.createElement("p");
        this.spmDisplay.innerHTML = "SPM: 0";
        this.spmContainer.appendChild(this.spmDisplay);

        this.containerDiv.appendChild(this.spmContainer);
    }

    updateApproachCircle(scalar)
    {
        let pixelRatio = GraphicUtil.getPixelRatio();

        this.approachCircleCtx.clearRect(0, 0, 400 * pixelRatio, 400 * pixelRatio);
        this.approachCircleCtx.beginPath();
        this.approachCircleCtx.arc(200 * pixelRatio, 200 * pixelRatio, (195 - this.centerRadius) * pixelRatio * scalar + this.centerRadius * pixelRatio, 0, PI2);
        this.approachCircleCtx.lineWidth = Math.sqrt(5 * pixelRatio * scalar) * 2;
        this.approachCircleCtx.strokeStyle = "white";
        this.approachCircleCtx.stroke();
    }
}