"use strict";

import {CIRCLE_BORDER_WIDTH, GraphicUtil, PI2} from "../util/graphicutil";
import {GAME_STATE, AUDIO_MANAGER} from "../main";
import {TimingUtil} from "../util/timingutil";
import {SliderCurveBezier} from "../util/slidercurvebezier";
import {SliderCurvePassthrough} from "../util/slidercurvepassthrough";
import {DrawableHitObject} from "./drawablehitobject";
import {MathUtil} from "../util/mathutil";

const SNAKING_SLIDERS = false;

export class DrawableSlider extends DrawableHitObject {
    constructor(slider) {
        super(slider);

        this.reductionFactor = 0.92;

        this.curve = null;
        this.init();

        this.scoring = { // Holds scoring information about slider
            head: false,
            ticks: 0,
            end: false
        };
        this.currentSliderTick = 0;
        this.currentRepeat = 0;
        this.lastPulseTime = -10e6;
        this.hittable = true;
        this.fadingOut = false;
        this.letGoTime = null;

        if(this.hitObject.repeat % 2 === 0) {
            this.endPoint = this.startPoint;
        }
        else {
            this.endPoint = {
                x: this.curve.equalDistancePoints[this.curve.equalDistancePoints.length - 1].x / GraphicUtil.getPixelRatio(),
                y: this.curve.equalDistancePoints[this.curve.equalDistancePoints.length - 1].y / GraphicUtil.getPixelRatio()
            };
        }
    }

    show(offset) {
        super.show(offset);
        this.renderOverlay();

        if (SNAKING_SLIDERS) {
            this.renderBase.bind(this)(false);
        }
    }

    hit(timeDelta) {
        let score = TimingUtil.getScoreFromHitDelta(Math.abs(timeDelta));
        this.scoring.head = score !== 0;
        this.hittable = false;

        if (score) {
            GAME_STATE.currentPlay.score.addScore(30, true);
            DrawableHitObject.playHitSound(this.hitSoundInfo.sliderEndHitSoundInfos[0]);
            GAME_STATE.currentPlay.accmeter.addRating(timeDelta);
        } else {
            GAME_STATE.currentPlay.score.addScore(0, true, true);
        }

        this.sliderHeadContainer.style.animation = (score) ? "0.15s destroyHitCircle linear forwards" : "0.15s fadeOut linear forwards";
        this.approachCircleCanvas.style.display = "none";
    }

    score() {
        let fraction = (((this.scoring.head) ? 1 : 0) + ((this.scoring.end) ? 1 : 0) + this.scoring.ticks) / (1 + this.hitObject.repeat + this.sliderTickCompletions.length);

        GAME_STATE.currentPlay.score.addScore((function () {
            if (fraction === 1) {
                return 300;
            } else if (fraction >= 0.5) {
                return 100;
            } else if (fraction > 0) {
                return 50;
            }
            return 0;
        })(), false, true, this);
    }

    playTickSound() {
        let skin = GAME_STATE.currentSkin || GAME_STATE.defaultSkin;

        let audioObj = skin.skinElements[this.hitSoundInfo.bodySampleSet + "-slidertick"];

        AUDIO_MANAGER.playSound(audioObj, this.hitSoundInfo.sliderEndHitSoundInfos[0].volume);
    }

    applyStackPosition() {
        this.x += this.stackHeight * -4;
        this.y += this.stackHeight * -4;

        this.minX += this.stackHeight * -4 * GraphicUtil.getPixelRatio();
        this.minY += this.stackHeight * -4 * GraphicUtil.getPixelRatio();
        this.maxX += this.stackHeight * -4 * GraphicUtil.getPixelRatio();
        this.maxY += this.stackHeight * -4 * GraphicUtil.getPixelRatio();

        for (let i = 0; i < this.curve.equalDistancePoints.length; i++) {
            this.curve.equalDistancePoints[i].x += this.stackHeight * -4 * GraphicUtil.getPixelRatio();
            this.curve.equalDistancePoints[i].y += this.stackHeight * -4 * GraphicUtil.getPixelRatio()
        }
    }

    init() { // Calculates slider path
        if (this.hitObject.sections[0].type === "circle") {
            this.curve = new SliderCurvePassthrough(this);
        }
        else {
            this.curve = new SliderCurveBezier(this);
        }
    };

    draw() {
        this.sliderWidth = this.maxX - this.minX;
        this.sliderHeight = this.maxY - this.minY;
        this.sliderBodyRadius = GAME_STATE.currentPlay.halfCsPixel * (this.reductionFactor - CIRCLE_BORDER_WIDTH);
        this.maxFollowCircleRadius = (GAME_STATE.currentPlay.halfCsPixel * 2.18);

        this.containerDiv = document.createElement("div");
        this.containerDiv.className = "sliderContainer";
        this.containerDiv.style.left = (this.minX - GAME_STATE.currentPlay.halfCsPixel) + GAME_STATE.currentPlay.marginWidth * GraphicUtil.getPixelRatio() + "px"
        this.containerDiv.style.top = (this.minY - GAME_STATE.currentPlay.halfCsPixel) + GAME_STATE.currentPlay.marginHeight * GraphicUtil.getPixelRatio() + "px";
        this.containerDiv.style.visibility = "hidden";
        this.containerDiv.style.opacity = 0;
        this.containerDiv.style.zIndex = this.zIndex;

        this.baseCanvas = document.createElement("canvas"); // Create local object canvas
        this.baseCanvas.setAttribute("width", Math.ceil(this.sliderWidth + GAME_STATE.currentPlay.csPixel));
        this.baseCanvas.setAttribute("height", Math.ceil(this.sliderHeight + GAME_STATE.currentPlay.csPixel));

        this.baseCtx = this.baseCanvas.getContext("2d");

        if (!SNAKING_SLIDERS) {
            this.renderBase.bind(this)(true);
        }
        this.containerDiv.appendChild(this.baseCanvas);

        this.overlay = document.createElement("canvas");
        this.overlay.setAttribute("width", Math.ceil(this.sliderWidth + GAME_STATE.currentPlay.csPixel));
        this.overlay.setAttribute("height", Math.ceil(this.sliderHeight + GAME_STATE.currentPlay.csPixel));
        this.overlayCtx = this.overlay.getContext("2d");

        this.followCircleCanvas = document.createElement("canvas");
        this.followCircleCanvas.setAttribute("width", this.maxFollowCircleRadius * 2);
        this.followCircleCanvas.setAttribute("height", this.maxFollowCircleRadius * 2);
        this.sliderBallCtx = this.followCircleCanvas.getContext("2d");

        this.sliderHeadContainer = document.createElement("div");
        this.sliderHeadContainer.className = "hitCircleContainer";
        this.sliderHeadContainer.style.width = GAME_STATE.currentPlay.csPixel + "px";
        this.sliderHeadContainer.style.height = GAME_STATE.currentPlay.csPixel + "px";
        this.sliderHeadContainer.style.left = this.curve.equalDistancePoints[0].x - this.minX + "px";
        this.sliderHeadContainer.style.top = this.curve.equalDistancePoints[0].y - this.minY + "px";

        let sliderHeadBaseCanvas = document.createElement("canvas"); // Create local object canvas
        sliderHeadBaseCanvas.setAttribute("width", GAME_STATE.currentPlay.csPixel);
        sliderHeadBaseCanvas.setAttribute("height", GAME_STATE.currentPlay.csPixel);

        let sliderHeadBaseCtx = sliderHeadBaseCanvas.getContext("2d");
        GraphicUtil.drawCircle(sliderHeadBaseCtx, 0, 0, this.comboInfo);

        this.approachCircleCanvas = document.createElement("canvas");
        this.approachCircleCanvas.setAttribute("width", GAME_STATE.currentPlay.csPixel);
        this.approachCircleCanvas.setAttribute("height", GAME_STATE.currentPlay.csPixel);
        this.approachCircleCanvas.style.transform = "scale(3.5)";

        let approachCtx = this.approachCircleCanvas.getContext("2d");
        GraphicUtil.drawApproachCircle(approachCtx, 0, 0, this.comboInfo.comboNum);

        this.sliderHeadContainer.appendChild(sliderHeadBaseCanvas);
        this.sliderHeadContainer.appendChild(this.approachCircleCanvas);

        this.containerDiv.appendChild(this.overlay);
        this.containerDiv.appendChild(this.sliderHeadContainer);
        this.containerDiv.appendChild(this.followCircleCanvas);
    }

    getLowestTickCompletionFromCurrentRepeat(completion) {
        let currentRepeat = Math.floor(completion);
        for (let i = 0; i < this.sliderTickCompletions.length; i++) {
            if (this.sliderTickCompletions[i] > currentRepeat) {
                return this.sliderTickCompletions[i];
            }
        }
    }

    renderBase(initialRender) {
        let thisCompletion = 0;

        if (initialRender) {
            thisCompletion = 1;
        } else {
            thisCompletion = Math.min(1, (AUDIO_MANAGER.getCurrentSongTime() - (this.startTime - GAME_STATE.currentPlay.ARMs)) / GAME_STATE.currentPlay.ARMs * 2.5);
        }

        let targetIndex = Math.floor(thisCompletion * (this.curve.equalDistancePoints.length - 1));
        let pointsToDraw = this.curve.equalDistancePoints.slice(0, targetIndex + 1);

        this.baseCtx.clearRect(0, 0, Math.ceil(this.sliderWidth + GAME_STATE.currentPlay.csPixel), Math.ceil(this.sliderHeight + GAME_STATE.currentPlay.csPixel));
        this.baseCtx.beginPath();
        this.baseCtx.moveTo(this.curve.equalDistancePoints[0].x - this.minX + GAME_STATE.currentPlay.halfCsPixel, this.curve.equalDistancePoints[0].y - this.minY + GAME_STATE.currentPlay.halfCsPixel);
        for (let i = 0; i < pointsToDraw.length; i++) {
            this.baseCtx.lineTo(pointsToDraw[i].x - this.minX + GAME_STATE.currentPlay.halfCsPixel, pointsToDraw[i].y - this.minY + GAME_STATE.currentPlay.halfCsPixel);
        }

        this.baseCtx.lineWidth = GAME_STATE.currentPlay.csPixel * this.reductionFactor;
        this.baseCtx.strokeStyle = "white";
        this.baseCtx.lineCap = "round";
        this.baseCtx.lineJoin = "round";
        this.baseCtx.globalCompositeOperation = "source-over";
        this.baseCtx.stroke();

        for (let i = this.sliderBodyRadius; i > 1; i -= 2) {
            this.baseCtx.lineWidth = i * 2;
            let completionRgb = Math.floor((1 - (i / this.sliderBodyRadius)) * 130);
            this.baseCtx.strokeStyle = "rgb(" + completionRgb + ", " + completionRgb + ", " + completionRgb + ")";
            this.baseCtx.stroke();
        }
        this.baseCtx.lineWidth = this.sliderBodyRadius * 2;
        this.baseCtx.strokeStyle = "rgba(255, 255, 255, 0.5)";
        this.baseCtx.globalCompositeOperation = "destination-out"; // Transparency
        this.baseCtx.stroke();

        if (!initialRender && thisCompletion < 1) {
            requestAnimationFrame(function () {
                this.renderBase.bind(this)(false);
            }.bind(this));
        }
    }

    renderOverlay() {
        let completion = 0;
        let currentSliderTime = window.performance.now() - GAME_STATE.currentPlay.audioStartTime + GAME_STATE.currentPlay.audioOffset - this.startTime;
        let isMoving = currentSliderTime >= 0;

        this.overlayCtx.clearRect(0, 0, Math.ceil(this.sliderWidth + GAME_STATE.currentPlay.csPixel), Math.ceil(this.sliderHeight + GAME_STATE.currentPlay.csPixel));

        if (isMoving) {
            completion = Math.min(this.hitObject.repeat, (this.timingInfo.sliderVelocity * currentSliderTime) / this.hitObject.length);
        }

        let animationDuration = 85;
        let completionForSliderTicks = completion;
        if (completion < 1) {
            completionForSliderTicks = (this.timingInfo.sliderVelocity * (currentSliderTime + animationDuration)) / this.hitObject.length;
        }

        // Draws slider ticks. Ticks in the first slider cycle appear animationDuration ms earlier.
        if (this.sliderTickCompletions[this.currentSliderTick] !== undefined) {
            let lowestTickCompletionFromCurrentRepeat = this.getLowestTickCompletionFromCurrentRepeat(completion);
            for (let i = 0; this.sliderTickCompletions[i] < Math.floor(completion + 1) && this.sliderTickCompletions[i] < lowestTickCompletionFromCurrentRepeat + (completionForSliderTicks % 1) * 2; i++) {
                if (this.sliderTickCompletions[i] >= completion) {
                    let sliderTickPos = GraphicUtil.getCoordFromCoordArray(this.curve.equalDistancePoints, MathUtil.reflect(this.sliderTickCompletions[i]));
                    let x = sliderTickPos.x - this.minX + GAME_STATE.currentPlay.halfCsPixel,
                        y = sliderTickPos.y - this.minY + GAME_STATE.currentPlay.halfCsPixel;
                    let tickMs =
                        /* ms of current repeat */ Math.floor(completion) * this.hitObject.length / this.timingInfo.sliderVelocity
                        + /* ms of tick showing up */ ((this.sliderTickCompletions[i] - lowestTickCompletionFromCurrentRepeat) * this.hitObject.length / this.timingInfo.sliderVelocity) / 2;
                    let animationCompletion = Math.min(1, (currentSliderTime - tickMs + ((completion < 1) ? animationDuration : 0)) / animationDuration);

                    this.overlayCtx.beginPath();
                    this.overlayCtx.arc(x, y, GAME_STATE.currentPlay.csPixel * 0.038 * (/* parabola */ -2.381 * animationCompletion * animationCompletion + 3.381 * animationCompletion), 0, PI2);
                    this.overlayCtx.fillStyle = "white";
                    this.overlayCtx.fill();
                }
            }
        }

        // Draws reverse arrow
        if (this.hitObject.repeat - completion > 1) {
            let reverseArrowPos = null;
            let p2 = null;

            if (Math.floor(completion) % 2 === 0) {
                reverseArrowPos = this.curve.equalDistancePoints[this.curve.equalDistancePoints.length - 1];
                p2 = this.curve.equalDistancePoints[this.curve.equalDistancePoints.length - 2];
            } else {
                reverseArrowPos = this.curve.equalDistancePoints[0];
                p2 = this.curve.equalDistancePoints[1];
            }
            let angle = Math.atan2(p2.y - reverseArrowPos.y, p2.x - reverseArrowPos.x);
            let x = reverseArrowPos.x - this.minX;
            let y = reverseArrowPos.y - this.minY;

            // Create second off-screen canvas used for rotating the text
            let reverseArrowCanvas = document.createElement("canvas");
            reverseArrowCanvas.setAttribute("width", GAME_STATE.currentPlay.csPixel);
            reverseArrowCanvas.setAttribute("height", GAME_STATE.currentPlay.csPixel);

            let reverseArrowCtx = reverseArrowCanvas.getContext("2d");
            reverseArrowCtx.translate(GAME_STATE.currentPlay.halfCsPixel, GAME_STATE.currentPlay.halfCsPixel);
            reverseArrowCtx.rotate(angle);
            reverseArrowCtx.translate(-GAME_STATE.currentPlay.halfCsPixel, -GAME_STATE.currentPlay.halfCsPixel);
            reverseArrowCtx.font = "lighter " + (GAME_STATE.currentPlay.csPixel * 0.6) + "px Arial";
            reverseArrowCtx.textAlign = "center";
            reverseArrowCtx.textBaseline = "middle";
            reverseArrowCtx.fillStyle = "white";
            reverseArrowCtx.fillText("➔", GAME_STATE.currentPlay.halfCsPixel, GAME_STATE.currentPlay.halfCsPixel);

            this.overlayCtx.drawImage(reverseArrowCanvas, x, y);
        }

        // Draws slider ball and follow circle to additional canvas
        if (isMoving) {
            let sliderBallPos = GraphicUtil.getCoordFromCoordArray(this.curve.equalDistancePoints, MathUtil.reflect(completion));
            let fadeOutCompletion = Math.min(1, Math.max(0, (AUDIO_MANAGER.getCurrentSongTime() - this.letGoTime) / 120));
            this.followCircleCanvas.style.transform = "translate(" + (sliderBallPos.x - this.minX + GAME_STATE.currentPlay.halfCsPixel - this.maxFollowCircleRadius) + "px," + (sliderBallPos.y - this.minY + GAME_STATE.currentPlay.halfCsPixel - this.maxFollowCircleRadius) + "px) scale(" + ((this.letGoTime === null) ? 1 : 1 + fadeOutCompletion * 0.5) + ")"; // transform is gazillions of times faster than absolute positioning
            this.followCircleCanvas.style.opacity = (this.letGoTime === null) ? 1 : (1 - fadeOutCompletion);

            let colour = GAME_STATE.currentBeatmap.colours[this.comboInfo.comboNum % GAME_STATE.currentBeatmap.colours.length];
            let colourString = "rgb(" + colour.r + "," + colour.g + "," + colour.b + ")";

            this.overlayCtx.beginPath();
            this.overlayCtx.arc(sliderBallPos.x - this.minX + GAME_STATE.currentPlay.halfCsPixel, sliderBallPos.y - this.minY + GAME_STATE.currentPlay.halfCsPixel, this.sliderBodyRadius, 0, PI2);
            this.overlayCtx.fillStyle = colourString;
            this.overlayCtx.fill();

            let followCircleRadius = GAME_STATE.currentPlay.halfCsPixel * (
                    /* base */ 1
                    + /* enlarge on start */ Math.max(0, Math.min(1, (AUDIO_MANAGER.getCurrentSongTime() - this.startTime) / 100))
                    + ((this.letGoTime === null) ?
                            /* pulse */ Math.max(0, Math.min(0.15, 0.15 - (currentSliderTime - this.lastPulseTime) / 150 * 0.18))
                            + /* shrink on end */ -0.5 + Math.pow(Math.max(0, Math.min(1, (1 - (AUDIO_MANAGER.getCurrentSongTime() - this.endTime) / 175))), 2) * 0.5 : 0
                    )
                );
            let lineWidth = followCircleRadius * 0.1;

            this.sliderBallCtx.clearRect(0, 0, this.maxFollowCircleRadius * 2, this.maxFollowCircleRadius * 2);
            this.sliderBallCtx.beginPath();
            this.sliderBallCtx.arc(this.maxFollowCircleRadius, this.maxFollowCircleRadius, followCircleRadius - lineWidth / 2, 0, PI2);
            this.sliderBallCtx.strokeStyle = "white";
            this.sliderBallCtx.lineWidth = lineWidth;
            this.sliderBallCtx.stroke();
        }

        if (currentSliderTime < this.endTime - this.startTime + 175) {
            requestAnimationFrame(this.renderOverlay.bind(this));
        }
    }
}