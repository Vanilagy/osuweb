"use strict";

import {CIRCLE_BORDER_WIDTH, GraphicUtil, PI2} from "../util/graphicutil";
import {GAME_STATE, AUDIO_MANAGER} from "../main";
import {SliderCurveBezier} from "../util/slidercurvebezier";
import {SliderCurvePassthrough} from "../util/slidercurvepassthrough";
import {DrawableHitObject, DRAWING_MODE} from "./drawablehitobject";
import {MathUtil} from "../util/mathutil";
import {Console} from "../console";
import {SliderCurveEmpty} from "../util/slidercurveempty";

const DEBUG_PREFIX = "[SLIDER]";
const SLIDER_BALL_CS_RATIO = 1.328125;

export let SLIDER_SETTINGS = {
    snaking: false,
    debugDrawing: false // Draws the traced points as dots
};

export class DrawableSlider extends DrawableHitObject {
    constructor(slider, beatmap, fullCalc) {
        super(slider);

        this.beatmap = beatmap;

        if (fullCalc) {
            this.curve = null;
            this.init();
            if (this.curve.constructor.name === "SliderCurveBezier" && this.curve.equalDistancePoints.length >= 1000) {
                this.suppressSnaking = true;
            }

            this.scoring = { // Holds scoring information about slider
                head: false,
                ticks: 0,
                end: false
            };
            this.reductionFactor = 0.92;
            this.currentSliderTick = 0;
            this.currentRepeat = 0;
            this.lastPulseTime = -10e6;
            this.hittable = true;
            this.fadingOut = false;
            this.letGoTime = null;

            if (this.hitObject.repeat % 2 === 0) {
                this.endPoint = this.startPoint;
            } else {
                this.endPoint = this.getPosFromPercentage(1);
            }
        } else {
            if (this.hitObject.repeat % 2 === 0) {
                this.endPoint = this.startPoint;
            } else {
                this.calculateEndPoint();
            }
        }
    }

    show(offset) {
        super.show(offset);
        this.renderOverlay();

        if (SLIDER_SETTINGS.snaking && !this.suppressSnaking) {
            this.renderBase.bind(this)(false);
        }
    }

    getPosFromPercentage(percent) {
        if (this.curve.constructor.name === "SliderCurveBezier") {
            return GraphicUtil.getCoordFromCoordArray(this.curve.equalDistancePoints, percent);
        } else if (this.curve.constructor.name === "SliderCurvePassthrough") {
            let angle = this.curve.startingAngle + this.curve.angleDifference * percent;

            return {
                x: this.curve.centerPos.x + this.curve.radius * Math.cos(angle),
                y: this.curve.centerPos.y + this.curve.radius * Math.sin(angle)
            };
        } else {
            Console.warn("Tried to access position from empty slider. Empty. Slider. What's that?");
        }
    }

    hit(timeDelta) {
        Console.verbose(DEBUG_PREFIX+" Slider head hit (error: "+(timeDelta)+")");

        let score = GAME_STATE.currentPlay.beatmap.difficulty.getRatingForHitDelta(Math.abs(timeDelta));
        this.scoring.head = score !== 0;
        this.hittable = false;

        if (score) {
            GAME_STATE.currentPlay.score.addScore(30, true);
            DrawableHitObject.playHitSound(this.hitSoundInfo.sliderEndHitSoundInfos[0]);
            GAME_STATE.currentPlay.accmeter.addRating(timeDelta);
        } else {
            GAME_STATE.currentPlay.score.addScore(0, true, true);
        }

        Console.verbose(DEBUG_PREFIX+" Animating hitcircle fade-out...");
        this.sliderHeadContainer.style.animation = (score) ? "0.10s destroyHitCircle linear forwards" : "0.10s fadeOut linear forwards";
        this.approachCircleCanvas.style.display = "none";
    }

    score() {
        let fraction = (((this.scoring.head) ? 1 : 0) + ((this.scoring.end) ? 1 : 0) + this.scoring.ticks) / (1 + this.hitObject.repeat + this.sliderTickCompletions.length);

        GAME_STATE.currentPlay.score.addScore((function () {
            Console.verbose(DEBUG_PREFIX+" Slider scoring: "+(fraction * 100)+"% hit");

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

    applyStackPosition(fullCalc) {
        this.x += this.stackHeight * -4;
        this.y += this.stackHeight * -4;

        if (fullCalc) {
            let pixelRatio = GAME_STATE.currentPlay.pixelRatio;

            this.minX += this.stackHeight * -4 * pixelRatio;
            this.minY += this.stackHeight * -4 * pixelRatio;
            this.maxX += this.stackHeight * -4 * pixelRatio;
            this.maxY += this.stackHeight * -4 * pixelRatio;

            this.curve.applyStackPosition();
        }
    }

    init() { // Calculates slider path
        if (this.hitObject.sections.length === 0) {
            this.curve = new SliderCurveEmpty(this);
        } else if (this.hitObject.sections[0].type === "circle") {
            this.curve = new SliderCurvePassthrough(this);

            this.curve.calculateValues();
        } else {
            this.curve = new SliderCurveBezier(this);
        }
    };

    calculateEndPoint() { // Method to get to the endPoint as fast as possible
        if (this.hitObject.sections.length === 0) {
            this.endPoint = this.startPoint;
        } else {
            if (this.hitObject.sections[0].type === "circle") {
                this.curve = new SliderCurvePassthrough(this);
                this.curve.calculateValues(true);
            } else {
                this.curve = new SliderCurveBezier(this, true);
            }

            this.endPoint = this.curve.getEndPoint();
        }
    }

    destroy() {
        this.remove();

        this.containerDiv = null;
        this.baseCanvas = null;
        this.baseCtx = null;
        this.approachCircleCanvas = null;
        this.overlay = null;
        this.overlayCtx = null;
        this.followCircleCanvas = null;
        this.sliderBallCtx = null;
        this.sliderHeadContainer = null;
    }

    draw() {
        Console.verbose(DEBUG_PREFIX+" Creating slider DOM elements...");
        let time = window.performance.now();
        let pixelRatio = GAME_STATE.currentPlay.pixelRatio;

        this.sliderWidth = this.maxX - this.minX;
        this.sliderHeight = this.maxY - this.minY;
        this.sliderBodyRadius = GAME_STATE.currentPlay.halfCsPixel * (this.reductionFactor - CIRCLE_BORDER_WIDTH);
        this.maxFollowCircleRadius = (GAME_STATE.currentPlay.halfCsPixel * 2.20);

        Console.verbose(DEBUG_PREFIX+" Creating container element...");
        this.containerDiv = document.createElement("div");
        this.containerDiv.className = "sliderContainer";
        this.containerDiv.style.left = (this.minX - GAME_STATE.currentPlay.halfCsPixel) + GAME_STATE.currentPlay.marginWidth * pixelRatio + "px";
        this.containerDiv.style.top = (this.minY - GAME_STATE.currentPlay.halfCsPixel) + GAME_STATE.currentPlay.marginHeight * pixelRatio + "px";
        this.containerDiv.style.visibility = "hidden";
        this.containerDiv.style.opacity = 0;
        this.containerDiv.style.transform = "translateZ(0)";
        this.containerDiv.style.backfaceVisibility = "hidden";
        this.containerDiv.style.zIndex = this.zIndex;

        Console.verbose(DEBUG_PREFIX+" Creating base canvas...");
        this.baseCanvas = document.createElement("canvas"); // Create local object canvas
        this.baseCanvas.setAttribute("width", Math.ceil(this.sliderWidth + GAME_STATE.currentPlay.csPixel));
        this.baseCanvas.setAttribute("height", Math.ceil(this.sliderHeight + GAME_STATE.currentPlay.csPixel));

        this.baseCanvas.style.webkitMask = "radial-gradient(" + (GAME_STATE.currentPlay.halfCsPixel * (this.reductionFactor - CIRCLE_BORDER_WIDTH / 2)) + "px at " + (this.startPoint.x * pixelRatio - this.minX + GAME_STATE.currentPlay.halfCsPixel) + "px " + (this.startPoint.y * pixelRatio - this.minY + GAME_STATE.currentPlay.halfCsPixel) + "px, transparent 99%, rgba(0, 0, 0, 1) 100%)";

        this.baseCtx = this.baseCanvas.getContext("2d");

        if (!SLIDER_SETTINGS.snaking || this.suppressSnaking) {
            Console.verbose(DEBUG_PREFIX+" Pre-rendering slider body since snaking is disabled.");
            this.renderBase.bind(this)(true);
        }

        Console.verbose(DEBUG_PREFIX+" Creating overlay canvas...");
        this.overlay = document.createElement("canvas");
        this.overlay.setAttribute("width", Math.ceil(this.sliderWidth + GAME_STATE.currentPlay.csPixel));
        this.overlay.setAttribute("height", Math.ceil(this.sliderHeight + GAME_STATE.currentPlay.csPixel));
        this.overlay.style.transform = "translateZ(0)";
        this.overlay.style.backfaceVisibility = "hidden";
        this.overlayCtx = this.overlay.getContext("2d");

        Console.verbose(DEBUG_PREFIX+" Creating followcirlcle canvas...");
        this.followCircleCanvas = document.createElement("canvas");
        this.followCircleCanvas.setAttribute("width", this.maxFollowCircleRadius * 2);
        this.followCircleCanvas.setAttribute("height", this.maxFollowCircleRadius * 2);
        this.sliderBallCtx = this.followCircleCanvas.getContext("2d");

        Console.verbose(DEBUG_PREFIX+" Creating sliderhead container...");
        this.sliderHeadContainer = document.createElement("div");
        this.sliderHeadContainer.className = "hitCircleContainer";
        this.sliderHeadContainer.style.width = GAME_STATE.currentPlay.csPixel + "px";
        this.sliderHeadContainer.style.height = GAME_STATE.currentPlay.csPixel + "px";
        this.sliderHeadContainer.style.left = this.startPoint.x * pixelRatio - this.minX + "px";
        this.sliderHeadContainer.style.top = this.startPoint.y * pixelRatio - this.minY + "px";

        Console.verbose(DEBUG_PREFIX+" Creating sliderhead base canvas...");
        let sliderHeadBaseCanvas = document.createElement("canvas"); // Create local object canvas
        sliderHeadBaseCanvas.setAttribute("width", GAME_STATE.currentPlay.csPixel);
        sliderHeadBaseCanvas.setAttribute("height", GAME_STATE.currentPlay.csPixel);

        let sliderHeadBaseCtx = sliderHeadBaseCanvas.getContext("2d");
        Console.verbose(DEBUG_PREFIX+" Pre-rendering circle to sliderhead canvas...");
        GraphicUtil.drawCircle(sliderHeadBaseCtx, 0, 0, this.comboInfo);

        Console.verbose(DEBUG_PREFIX+" Creating approachcircle canvas...");
        this.approachCircleCanvas = document.createElement("canvas");
        this.approachCircleCanvas.setAttribute("width", GAME_STATE.currentPlay.csPixel);
        this.approachCircleCanvas.setAttribute("height", GAME_STATE.currentPlay.csPixel);
        this.approachCircleCanvas.style.transform = "scale(4)";

        let approachCtx = this.approachCircleCanvas.getContext("2d");
        Console.verbose(DEBUG_PREFIX+" Pre-rendering approachcircle to approachcircle canvas...");
        GraphicUtil.drawApproachCircle(approachCtx, 0, 0, this.comboInfo.comboNum);

        Console.verbose(DEBUG_PREFIX+" Appending elements to DOM");
        this.sliderHeadContainer.appendChild(sliderHeadBaseCanvas);
        this.sliderHeadContainer.appendChild(this.approachCircleCanvas);

        this.containerDiv.appendChild(this.baseCanvas);
        this.containerDiv.appendChild(this.overlay);
        this.containerDiv.appendChild(this.sliderHeadContainer);
        this.containerDiv.appendChild(this.followCircleCanvas);

        Console.verbose(DEBUG_PREFIX+" Creating DOM objects complete! ("+(window.performance.now()-time).toFixed(3)+"ms)");
    }

    getLowestTickCompletionFromCurrentRepeat(completion) {
        let currentRepeat = Math.floor(completion);
        for (let i = 0; i < this.sliderTickCompletions.length; i++) {
            if (this.sliderTickCompletions[i] > currentRepeat) {
                return this.sliderTickCompletions[i];
            }
        }
    }

    render() {
        if(SLIDER_SETTINGS.snaking) this.renderBase(false);
        this.renderOverlay();
    }

    toCtxCoord(pos) {
        return {
            x: pos.x * GAME_STATE.currentPlay.pixelRatio - this.minX + GAME_STATE.currentPlay.halfCsPixel,
            y: pos.y * GAME_STATE.currentPlay.pixelRatio - this.minY + GAME_STATE.currentPlay.halfCsPixel
        };
    }

    renderBase(initialRender) {
        if(this.complete) return;

        // How much % of the slider should be drawn
        let thisCompletion = 0;

        if (initialRender) {
            // No slider snaking - pre-render
            thisCompletion = 1;
        } else {
            thisCompletion = Math.min(1, (AUDIO_MANAGER.getCurrentSongTime() - (this.startTime - GAME_STATE.currentPlay.ARMs)) / GAME_STATE.currentPlay.beatmap.difficulty.getApproachTime() * 3);
        }

        this.curve.render(thisCompletion);

        this.complete = thisCompletion === 1;
    }

    renderOverlay() {
        let completion = 0;
        let currentSliderTime = AUDIO_MANAGER.getCurrentSongTime() - this.startTime;
        let isMoving = currentSliderTime >= 0;

        if(currentSliderTime >= this.endTime - this.startTime + 175) return;

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
                    let sliderTickPos = this.toCtxCoord(this.getPosFromPercentage(MathUtil.reflect(this.sliderTickCompletions[i])));
                    let tickMs =
                        /* ms of current repeat */ Math.floor(completion) * this.hitObject.length / this.timingInfo.sliderVelocity
                        + /* ms of tick showing up */ ((this.sliderTickCompletions[i] - lowestTickCompletionFromCurrentRepeat) * this.hitObject.length / this.timingInfo.sliderVelocity) / 2;
                    let animationCompletion = Math.min(1, (currentSliderTime - tickMs + ((completion < 1) ? animationDuration : 0)) / animationDuration);

                    if (DRAWING_MODE === 0) {
                        this.overlayCtx.beginPath();
                        this.overlayCtx.arc(sliderTickPos.x, sliderTickPos.y, GAME_STATE.currentPlay.csPixel * 0.038 * (-2.381 * animationCompletion * animationCompletion + 3.381 * animationCompletion), 0, PI2);
                        this.overlayCtx.fillStyle = "white";
                        this.overlayCtx.fill();
                    } else if (DRAWING_MODE === 1) {
                        let diameter = GAME_STATE.currentPlay.csPixel / SLIDER_BALL_CS_RATIO / 4 * (-2.381 * animationCompletion * animationCompletion + 3.381 * animationCompletion);

                        this.overlayCtx.drawImage(GAME_STATE.currentPlay.drawElements.sliderTick, sliderTickPos.x - diameter / 2, sliderTickPos.y - diameter / 2, diameter, diameter);
                    }
                }
            }
        }

        // Draws reverse arrow
        if (this.hitObject.repeat - completion > 1 && this.complete) {
            let reverseArrowPos = null;
            let p2 = null;
            const INFINITESIMAL = 0.00001; // Okay, not really infinitely small. But mathematically it should be.

            if (Math.floor(completion) % 2 === 0) {
                reverseArrowPos = this.getPosFromPercentage(1);
                p2 = this.getPosFromPercentage(1 - INFINITESIMAL);
            } else {
                reverseArrowPos = this.getPosFromPercentage(0);
                p2 = this.getPosFromPercentage(0 + INFINITESIMAL);
            }
            let angle = Math.atan2(p2.y - reverseArrowPos.y, p2.x - reverseArrowPos.x);
            let x = reverseArrowPos.x * GAME_STATE.currentPlay.pixelRatio - this.minX;
            let y = reverseArrowPos.y * GAME_STATE.currentPlay.pixelRatio - this.minY;

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
            let sliderBallPos = this.toCtxCoord(this.getPosFromPercentage(MathUtil.reflect(completion)));
            let fadeOutCompletion = Math.min(1, Math.max(0, (AUDIO_MANAGER.getCurrentSongTime() - this.letGoTime) / 120));

            this.followCircleCanvas.style.transform = "translate(" + (sliderBallPos.x - this.maxFollowCircleRadius) + "px," + (sliderBallPos.y - this.maxFollowCircleRadius) + "px) scale(" + ((this.letGoTime === null) ? 1 : 1 + fadeOutCompletion * 0.5) + ")"; // transform is gazillions of times faster than absolute positioning
            this.followCircleCanvas.style.opacity = (this.letGoTime === null) ? 1 : (1 - fadeOutCompletion);
            this.followCircleCanvas.style.webkitTransform = "transformZ(0)";
            this.followCircleCanvas.style.backfaceVisibility = "hidden";

            let colour = GAME_STATE.currentBeatmap.colours[this.comboInfo.comboNum % GAME_STATE.currentBeatmap.colours.length];

            // Draw slider ball
            if (DRAWING_MODE === 0) {
                let colourString = "rgb(" + colour.r + "," + colour.g + "," + colour.b + ")";

                this.overlayCtx.beginPath();
                this.overlayCtx.arc(sliderBallPos.x, sliderBallPos.y, this.sliderBodyRadius, 0, Math.PI * 2);
                this.overlayCtx.fillStyle = colourString;
                this.overlayCtx.fill();
            } else if (DRAWING_MODE === 1) {
                this.overlayCtx.drawImage(GAME_STATE.currentPlay.drawElements.sliderBall, sliderBallPos.x - GAME_STATE.currentPlay.halfCsPixel * SLIDER_BALL_CS_RATIO, sliderBallPos.y - GAME_STATE.currentPlay.halfCsPixel * SLIDER_BALL_CS_RATIO, GAME_STATE.currentPlay.csPixel * SLIDER_BALL_CS_RATIO, GAME_STATE.currentPlay.csPixel * SLIDER_BALL_CS_RATIO);
            }

            let followCircleRadius = GAME_STATE.currentPlay.halfCsPixel * (
                    /* base */ 1
                    + /* enlarge on start */ Math.max(0, Math.min(1, (AUDIO_MANAGER.getCurrentSongTime() - this.startTime) / 100))
                    + ((this.letGoTime === null) ?
                            /* pulse */ Math.max(0, Math.min(0.15, 0.15 - (currentSliderTime - this.lastPulseTime) / 150 * 0.20))
                            + /* shrink on end */ -0.5 + Math.pow(Math.max(0, Math.min(1, (1 - (AUDIO_MANAGER.getCurrentSongTime() - this.endTime) / 175))), 2) * 0.5 : 0
                    )
                );

            // Draw the follow circle I guess (why not .scale() here?)
            this.sliderBallCtx.clearRect(0, 0, this.maxFollowCircleRadius * 2, this.maxFollowCircleRadius * 2);
            if (DRAWING_MODE === 0) {
                let lineWidth = followCircleRadius * 0.09;

                this.sliderBallCtx.beginPath();
                this.sliderBallCtx.arc(this.maxFollowCircleRadius, this.maxFollowCircleRadius, followCircleRadius - lineWidth / 2, 0, PI2);
                this.sliderBallCtx.strokeStyle = "white";
                this.sliderBallCtx.lineWidth = lineWidth;
                this.sliderBallCtx.stroke();
            } else if (DRAWING_MODE === 1) {
                this.sliderBallCtx.drawImage(GAME_STATE.currentPlay.drawElements.followCircle, this.maxFollowCircleRadius - followCircleRadius, this.maxFollowCircleRadius - followCircleRadius, followCircleRadius * 2, followCircleRadius * 2);
            }
        }
    }
}