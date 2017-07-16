"use strict";

import {GraphicUtil} from "../util/graphicutil";
import {AccMeter} from "../ui/interface/accmeter";
import {ProgressBar} from "../ui/interface/progressbar";
import {DrawableCircle} from "../game/drawablecircle";
import {DrawableSlider} from "../game/drawableslider";
import {DrawableSpinner} from "../game/drawablespinner";
import {GAME_STATE, AUDIO_MANAGER, SCENE_MANAGER} from "../main";
import {InputUtil, INPUT_STATE} from "../util/inpututil";
import {PRE_EMPT} from "./followpoint";
import {Score} from "./score";
import {MathUtil} from "../util/mathutil";
import {Console} from "../console";
import {DrawableHitObject, DRAWING_MODE} from "./drawablehitobject";
import {ProcessedBeatmap} from "../datamodel/processedbeatmap";
import {ModHelper} from "./modhelper";

const EXPECTED_AVERAGE_CLOCK_SPEED = 5; // Used to offset timeDelta for AT

export class Play {
    constructor(beatmap, audio) {
        GAME_STATE.currentPlay = this;

        this.mods = ModHelper.parseModCodeToObject(prompt("Enter modcode:"));

        let generationStartTime = window.performance.now();

        this.audio = audio;
        this.beatmap = new ProcessedBeatmap(beatmap);
        this.pixelRatio = GraphicUtil.getPixelRatio();

        if(this.mods.HR) ModHelper.applyHR(this.beatmap);
        if(this.mods.EZ) ModHelper.applyEZ(this.beatmap);

        this.beatmap.process();

        GAME_STATE.currentBeatmap = this.beatmap;

        // doesn't do shit yet LUL
        //ingameContainer.style.width = window.innerWidth + "px";
        //ingameContainer.style.height = window.innerHeight + "px";

        this.marginWidth = (GraphicUtil.getBaseScreenDimensions().width - GraphicUtil.getBasePlayfieldDimensions().width) / 2;
        this.marginHeight = this.marginWidth * GraphicUtil.getAspectRatio();

        // The diameter of a circle on the screen (relative to playfield area)
        this.csOsuPixel = this.beatmap.difficulty.getCirclePixelSize();
        this.csPixel = Math.round(this.csOsuPixel * this.pixelRatio);
        this.halfCsPixel = this.csPixel / 2;

        this.ARMs = this.beatmap.difficulty.getApproachTime();

        if (this.mods.AT) {
            INPUT_STATE.suppressManualCursorControl = true;
            this.playthroughInstructions = ModHelper.generateAutoPlaythroughInstructions(this);
            this.currentPlaythroughInstruction = 0;
        }

        this.draw();

        Console.info("Beatmap generation time: " + ((window.performance.now() - generationStartTime) / 1000).toFixed(3) + "s");

        this.accmeter = new AccMeter();
        this.progressbar = new ProgressBar();

        this.audioInterlude = 2;
        this.metronome = null;
        this.nextMetronome = null;
        this.metronomeRunning = false;
        this.audioStarted = false;

        this.currentHitObject = 0;
        this.lastAppendedHitObject = 0;
        this.currentFollowPoint = 0;
        this.onScreenHitObjects = {};
        this.onScreenFollowPoints = {};

        this.inBreak = true;
        this.startBreak = true;
        this.nextBreak = null;

        this.score = new Score(this.beatmap);

        // Debug variables
        this.lastTickClockTime = window.performance.now();
        this.recordedTickSpeeds = [];
        this.stupidClock = window.performance.now();
    }

    draw() {
        if (DRAWING_MODE === 1) {
            let skin = GAME_STATE.currentSkin || GAME_STATE.defaultSkin;

            this.drawElements = {
                hitCircle: skin.skinElements["hitcircle@2x"] || skin.skinElements["hitcircle"],
                hitCircleOverlay: skin.skinElements["hitcircleoverlay@2x"] || skin.skinElements["hitcircleoverlay"],
                sliderBall: skin.skinElements["sliderb0@2x"] || skin.skinElements["sliderb0"],
                followCircle: skin.skinElements["sliderfollowcircle@2x"] || skin.skinElements["sliderfollowcircle"],
                sliderTick: skin.skinElements["sliderscorepoint"],
                coloredHitcircles: [],
                numbers: []
            };

            for (let i = 0; i < this.beatmap.colours.length; i++) {
                let colour = this.beatmap.colours[i];
                let canvas = document.createElement("canvas");
                canvas.setAttribute("width", this.csPixel);
                canvas.setAttribute("height", this.csPixel);
                let ctx = canvas.getContext("2d");

                ctx.drawImage(this.drawElements.hitCircle, 0, 0, GAME_STATE.currentPlay.csPixel, GAME_STATE.currentPlay.csPixel);

                let imageData = ctx.getImageData(0, 0, this.csPixel, this.csPixel);
                for (let i = 0; i < imageData.data.length; i += 4) { // Multiplies color values while maintaining alpha channel
                    imageData.data[i] = Math.floor((imageData.data[i] / 255) * (colour.r / 255) * 255);
                    imageData.data[i + 1] = Math.floor((imageData.data[i + 1] / 255) * (colour.g / 255) * 255);
                    imageData.data[i + 2] = Math.floor((imageData.data[i + 2] / 255) * (colour.b / 255) * 255);
                }
                ctx.putImageData(imageData, 0, 0);

                ctx.drawImage(this.drawElements.hitCircleOverlay, 0, 0, GAME_STATE.currentPlay.csPixel, GAME_STATE.currentPlay.csPixel);

                this.drawElements.coloredHitcircles[i] = canvas;
            }

            for (let i = 0; i <= 9; i++) {
                this.drawElements.numbers[i] = skin.skinElements["default-" + i + "@2x"] || skin.skinElements["default-" + i];
            }
        }

        for (let z = 0; z < this.beatmap.hitObjects.length; z++) {
            this.beatmap.hitObjects[z].draw();
        }
    }

    render() {
        let currentTime = (AUDIO_MANAGER._paused) ? AUDIO_MANAGER._pauseTime * 1000 : AUDIO_MANAGER.getCurrentSongTime();

        if(this.progressbar) this.progressbar.render.bind(this.progressbar)(currentTime);
        if(this.accmeter) this.accmeter.render.bind(this.accmeter)();

        for(let key in this.onScreenHitObjects) {
            this.onScreenHitObjects[key].render.bind(this.onScreenHitObjects[key])(currentTime);
        }

        for(let key in this.onScreenFollowPoints) {
            this.onScreenFollowPoints[key].render.bind(this.onScreenFollowPoints[key])(currentTime);
        }

        if(this.playthroughInstructions && this.audioStarted) this.handlePlaythroughInstructions(currentTime);

        this.score.updateDisplay();
    }

    updatePlayareaSize(callback) {
        let playAreaDimensions = GraphicUtil.getPlayAreaDimensions();

        SCENE_MANAGER.getScene().elements["playareaDiv"].style.height = playAreaDimensions.height;
        SCENE_MANAGER.getScene().elements["playareaDiv"].style.width = playAreaDimensions.width;

        setTimeout(() => {
            InputUtil.updatePlayfieldBounds();
            callback();
        });
    }

    gameLoop() {
        //this.doDebugOutput();

        let currentTime = AUDIO_MANAGER.getCurrentSongTime();

        // hitObject updates
        this.updateHitObjects(currentTime);

        // Handles breaks
        this.handleBreaks(currentTime);

        // Makes follow points show up on-screen
        this.handleFollowPoints(currentTime);

        this.gameLoopTimeout = setTimeout(this.gameLoop.bind(this), 0);
    }

    handleFollowPoints(currentTime) {
        if (this.currentFollowPoint < this.beatmap.followPoints.length) {
            while (this.beatmap.followPoints[this.currentFollowPoint].startTime - PRE_EMPT <= currentTime) {
                this.beatmap.followPoints[this.currentFollowPoint].spawn();

                this.currentFollowPoint++;

                if (this.currentFollowPoint === this.beatmap.followPoints.length) {
                    break;
                }
            }
        }
    }

    handlePlaythroughInstructions(currentTime) {
        if (!this.playthroughInstructions[this.currentPlaythroughInstruction]) {
            return;
        }

        let pixelRatio = this.pixelRatio;

        if (this.playthroughInstructions[this.currentPlaythroughInstruction + 1]) {
            while (this.playthroughInstructions[this.currentPlaythroughInstruction + 1].time <= currentTime) {
                this.currentPlaythroughInstruction++;

                if (!this.playthroughInstructions[this.currentPlaythroughInstruction + 1]) {
                    break;
                }
            }
        }

        let currentInstruction = this.playthroughInstructions[this.currentPlaythroughInstruction];
        if (currentInstruction.time <= currentTime) {
            if (currentInstruction.type === "blink") {
                InputUtil.moveCursorToPlayfieldPos(currentInstruction.to.x, currentInstruction.to.y);
                this.currentPlaythroughInstruction++;
            } else if (currentInstruction.type === "move") {
                // Desides on the easing type
                let timeDifference = (currentInstruction.endTime - currentInstruction.time);
                let easingType = undefined;
                const STREAM_BEAT_THRESHHOLD = 155;

                if (timeDifference <= 60000 / STREAM_BEAT_THRESHHOLD / 4) { // Length of 1/4 beats at set BPM
                    easingType = "linear";
                } else {
                    easingType = "easeOutQuad";
                }

                let completion = Math.min(1, Math.max(0, (currentTime - currentInstruction.time) / (currentInstruction.endTime - currentInstruction.time)));
                completion = MathUtil.ease(easingType, completion);
                let pos = {
                    x: currentInstruction.startPos.x * (1 - completion) + currentInstruction.endPos.x * completion,
                    y: currentInstruction.startPos.y * (1 - completion) + currentInstruction.endPos.y * completion,
                };

                InputUtil.moveCursorToPlayfieldPos(pos.x, pos.y);
            } else if (currentInstruction.type === "follow") {
                let completion = (currentInstruction.elem.timingInfo.sliderVelocity * (currentTime - currentInstruction.elem.startTime)) / currentInstruction.elem.hitObject.length;
                let pos = currentInstruction.elem.getPosFromPercentage(MathUtil.reflect(Math.min(currentInstruction.elem.hitObject.repeat, completion)));

                InputUtil.moveCursorToPlayfieldPos(pos.x, pos.y);

                if (currentTime > currentInstruction.elem.endTime) {
                    this.currentPlaythroughInstruction++;
                }
            } else if (currentInstruction.type === "spin") {
                let spinPos = ModHelper.getSpinPositionFromInstruction(currentInstruction, Math.min(currentInstruction.endTime, currentTime));

                InputUtil.moveCursorToPlayfieldPos(spinPos.x, spinPos.y);

                if (currentTime > currentInstruction.endTime) {
                    this.currentPlaythroughInstruction++;
                }
            }
        }
    }

    doDebugOutput() {
        let timeDif = window.performance.now() - this.lastTickClockTime;

        this.recordedTickSpeeds.push(timeDif);
        if (timeDif > 1000 / 60) {
            Console.warn("Slow clock: " + timeDif.toFixed(2) + "ms since last execution!");
        }
        this.lastTickClockTime = window.performance.now();
        if (window.performance.now() - this.stupidClock > 2000) {
            let sum = 0;
            for (let i = 0; i < this.recordedTickSpeeds.length; i++) {
                sum += this.recordedTickSpeeds[i];
            }
            Console.verbose("Current average clock tick speed: " + (sum / this.recordedTickSpeeds.length).toFixed(2) + "ms / " + (1000 / (sum / this.recordedTickSpeeds.length)).toFixed(2) + "Hz");
            this.stupidClock = window.performance.now();
        }
    }

    updateHitObjects(currentTime) {
        // Handle HitObject interaction
        let userPlayfieldCoords = InputUtil.getCursorPlayfieldCoords();
        for (let id in this.onScreenHitObjects) {
            let hitObject = this.onScreenHitObjects[id];

            if (hitObject.constructor.name === "DrawableCircle") {
                // Remove approach circle
                if (currentTime >= hitObject.startTime && hitObject.hittable) {
                    if (this.mods.AT) hitObject.hit(currentTime - hitObject.startTime - EXPECTED_AVERAGE_CLOCK_SPEED / 2); // AUTO hitting
                    if (hitObject.approachCircleCanvas) hitObject.approachCircleCanvas.style.visibility = "hidden";
                }
                // Fade out object when it has not been hit
                if (currentTime >= hitObject.startTime + this.beatmap.difficulty.getHitDeltaForRating(50) && hitObject.hittable) {
                    this.score.addScore(0, false, true, hitObject);
                    hitObject.containerDiv.style.animation = "0.15s fadeOut linear forwards";
                    hitObject.hittable = false;
                }
                // HD-fade-out
                if (this.mods.HD && currentTime >= hitObject.startTime - this.ARMs / 2 && !hitObject.HDFadeOutActive) {
                    hitObject.containerDiv.style.transition = "opacity " + (((GAME_STATE.currentPlay.ARMs / 4) - (currentTime - (hitObject.startTime - this.ARMs / 2))) / 1000) + "s linear";
                    hitObject.containerDiv.style.opacity = 0;
                    hitObject.HDFadeOutActive = true;
                }
                // RX hitting
                if (this.mods.RX && Math.hypot(hitObject.x - userPlayfieldCoords.x, hitObject.y - userPlayfieldCoords.y) <= this.csOsuPixel / 2 && currentTime >= hitObject.startTime && hitObject.hittable) {
                    hitObject.hit(currentTime - hitObject.startTime);
                }
                // Remove object completely
                if (currentTime >= hitObject.startTime + 400) {
                    hitObject.destroy();
                    delete this.onScreenHitObjects[id];
                    continue;
                }
            } else if (hitObject.constructor.name === "DrawableSlider") {
                // Handle scoring of slider ticks and reverses
                if ((hitObject.sliderTickCompletions[hitObject.currentSliderTick] !== undefined || hitObject.currentRepeat < hitObject.hitObject.repeat) && currentTime >= hitObject.startTime) {
                    let completion = Math.min(hitObject.hitObject.repeat, hitObject.timingInfo.sliderVelocity * (currentTime - hitObject.startTime) / hitObject.hitObject.length);
                    let completionsToEval = [];

                    while (completion >= hitObject.sliderTickCompletions[hitObject.currentSliderTick]) {
                        completionsToEval.push(hitObject.sliderTickCompletions[hitObject.currentSliderTick]);
                        hitObject.currentSliderTick++;
                    }
                    while (Math.floor(completion) > hitObject.currentRepeat) {
                        hitObject.currentRepeat++;
                        completionsToEval.push(hitObject.currentRepeat);
                    }
                    completionsToEval.sort();

                    for (let i = 0; i < completionsToEval.length; i++) {
                        let tickPosition = hitObject.getPosFromPercentage(MathUtil.reflect(completionsToEval[i]));

                        let dist = Math.hypot(tickPosition.x - userPlayfieldCoords.x, tickPosition.y - userPlayfieldCoords.y);

                        if ((dist <= this.csOsuPixel && (INPUT_STATE.isHolding || this.mods.RX)) || this.mods.AT) {
                            if (completionsToEval[i] === hitObject.hitObject.repeat) {
                                hitObject.scoring.end = true;
                            } else {
                                hitObject.scoring.ticks++;
                            }

                            if (completionsToEval[i] % 1 === 0) { // if reverse
                                GAME_STATE.currentPlay.score.addScore(30, true);
                                DrawableHitObject.playHitSound(hitObject.hitSoundInfo.sliderEndHitSoundInfos[completionsToEval[i]]);
                            } else { // if tick
                                GAME_STATE.currentPlay.score.addScore(10, true);
                                hitObject.playTickSound();
                            }
                        } else if (completionsToEval[i] !== hitObject.hitObject.repeat) {
                            GAME_STATE.currentPlay.score.addScore(0, true, true);
                        }

                        if (completionsToEval[i] < hitObject.hitObject.repeat) {
                            hitObject.lastPulseTime = completionsToEval[i] * hitObject.hitObject.length / hitObject.timingInfo.sliderVelocity;
                        }
                    }
                }
                // Remove approach circle
                if (currentTime >= hitObject.startTime && hitObject.hittable) {
                    if (this.mods.AT) hitObject.hit(currentTime - hitObject.startTime - EXPECTED_AVERAGE_CLOCK_SPEED / 2);
                    if (hitObject.approachCircleCanvas) hitObject.approachCircleCanvas.style.visibility = "hidden";
                    hitObject.baseCanvas.style.webkitMaskImage = "none";
                }
                // Fade out slider head when it has not been hit
                if (currentTime >= hitObject.startTime + this.beatmap.difficulty.getHitDeltaForRating(50) && hitObject.hittable) {
                    this.score.addScore(0, true, true);
                    hitObject.sliderHeadContainer.style.animation = "0.15s fadeOut linear forwards";
                    hitObject.hittable = false;
                }
                // HD-fade-out
                if (this.mods.HD && currentTime >= hitObject.startTime - this.ARMs / 2 && !hitObject.HDFadeOutActive) {
                    hitObject.sliderHeadContainer.style.transition = "opacity " + (((GAME_STATE.currentPlay.ARMs / 4) - (currentTime - (hitObject.startTime - this.ARMs / 2))) / 1000) + "s linear";
                    hitObject.sliderHeadContainer.style.opacity = 0;
                    hitObject.HDFadeOutActive = true;
                }
                // RX hitting
                if (this.mods.RX && Math.hypot(hitObject.x - userPlayfieldCoords.x, hitObject.y - userPlayfieldCoords.y) <= this.csOsuPixel / 2 && currentTime >= hitObject.startTime && hitObject.hittable) {
                    hitObject.hit(currentTime - hitObject.startTime);
                }
                // On slider end
                if (currentTime >= hitObject.endTime && !hitObject.fadingOut) {
                    hitObject.score();
                    hitObject.containerDiv.style.animation = "0.175s fadeOut linear forwards";
                    hitObject.fadingOut = true;
                }
                // Remove object completely
                if (currentTime >= hitObject.endTime + 150) {
                    hitObject.destroy();
                    delete this.onScreenHitObjects[id];
                    continue;
                }
            } else if (hitObject.constructor.name === "DrawableSpinner") {
                if (currentTime >= hitObject.startTime) {
                    // Spinner clear
                    if (hitObject.absoluteDegreesRotated / (Math.PI * 2) >= hitObject.requiredSpins) {
                        hitObject.clear();
                    }
                    // Spinner bonuses
                    if (hitObject.cleared) {
                        if ((hitObject.absoluteDegreesRotated - hitObject.requiredSpins * Math.PI * 2) / (Math.PI * 2) >= hitObject.completedBonusSpins + 1) {
                            hitObject.scoreBonusSpin();
                        }
                    }
                    // Count full spins
                    if (hitObject.absoluteDegreesRotated / (Math.PI * 2) >= hitObject.completedSpins + 1) {
                        hitObject.completedSpins = Math.floor(hitObject.absoluteDegreesRotated / (Math.PI * 2));
                        hitObject.readyForSound = true;
                        if (!hitObject.cleared) {
                            GAME_STATE.currentPlay.score.addScore(100, true, true);
                        }
                    }
                    // Activate spinner
                    if (!hitObject.active) {
                        hitObject.active = true;
                        hitObject.lastTimeSampled = window.performance.now();
                    }
                }

                // Spinner end
                if (currentTime >= hitObject.endTime && !hitObject.completed) {
                    hitObject.score();
                    hitObject.containerDiv.style.animation = "0.15s fadeOut linear forwards"
                    SCENE_MANAGER.getScene().elements["accmeterCanvas"].style.opacity = 1;
                    hitObject.active = false;
                    hitObject.completed = true;
                }
                // Remove object completely
                if (currentTime >= hitObject.endTime + 150) {
                    hitObject.destroy();
                    delete this.onScreenHitObjects[id];
                    continue;
                }
            }
        }

        // Append new HitObjects
        while (this.beatmap.hitObjects.length > this.lastAppendedHitObject && this.lastAppendedHitObject - this.currentHitObject < 1) {
            let nextTime = this.beatmap.hitObjects[this.lastAppendedHitObject].startTime;

            while (this.beatmap.hitObjects.length > this.lastAppendedHitObject && this.beatmap.hitObjects[this.lastAppendedHitObject].startTime <= nextTime) {
                this.beatmap.hitObjects[this.lastAppendedHitObject].append();
                this.lastAppendedHitObject++;
            }
        }

        // Makes HitObjects show up on-screen
        if (this.currentHitObject < this.beatmap.hitObjects.length) {
            while (this.beatmap.hitObjects[this.currentHitObject].startTime - ((this.beatmap.hitObjects[this.currentHitObject].constructor.name !== "DrawableSpinner") ? this.ARMs : 250) <= currentTime) {
                let hitObject = this.beatmap.hitObjects[this.currentHitObject];

                hitObject.show(currentTime - (hitObject.startTime - this.ARMs));
                this.onScreenHitObjects[hitObject.id] = hitObject;

                if (hitObject.constructor.name === "DrawableSpinner") {
                    SCENE_MANAGER.getScene().elements["accmeterCanvas"].style.opacity = 0;
                }

                this.currentHitObject++;

                if (this.currentHitObject === this.beatmap.hitObjects.length) {
                    break;
                }
            }
        }
    }

    handleBreaks(currentTime) {
        if (currentTime > this.beatmap.hitObjects[0].startTime - 1500 && this.startBreak) {
            document.getElementById("background-dim").style.opacity = "0.88"; // :smirk: :flag_de:
            this.inBreak = false;
            this.startBreak = false;
        }
        else if (this.beatmap.hitObjects[this.beatmap.hitObjects.length - 1].endTime - currentTime < -300) {
            document.getElementById("background-dim").style.opacity = "0";
            this.inBreak = true;
        }
        else {
            if (this.nextBreak === null) {
                for (let ii = 0; ii < this.beatmap.events.length; ii++) {
                    if (this.beatmap.events[ii].type !== "break") continue;

                    if (this.beatmap.events[ii].start > currentTime) {
                        if (this.nextBreak !== null && this.nextBreak.start > this.beatmap.events[ii].start) {
                            this.nextBreak = this.beatmap.events[ii];
                        }
                        else {
                            this.nextBreak = this.beatmap.events[ii];
                        }
                    }
                }
            }

            if (this.inBreak && this.nextBreak !== null && currentTime > this.nextBreak.end) {
                document.getElementById("background-dim").style.opacity = "0.90";
                this.inBreak = false;
                this.nextBreak = null;
            }
            else if (!this.inBreak && this.nextBreak !== null && currentTime > this.nextBreak.start) {
                document.getElementById("background-dim").style.opacity = "0";
                this.inBreak = true;
            }
        }
    }

    registerClick() {
        if (!this.mods.AT) {
            let userPlayfieldCoords = InputUtil.getCursorPlayfieldCoords();

            for (let id in this.onScreenHitObjects) {
                let hitObject = this.onScreenHitObjects[id];

                if (hitObject.hittable) {
                    let dist = Math.hypot(userPlayfieldCoords.x - hitObject.x, userPlayfieldCoords.y - hitObject.y);

                    if (dist <= this.csOsuPixel / 2) {
                        hitObject.hit(AUDIO_MANAGER.getCurrentSongTime() - hitObject.startTime);
                    }
                    break;
                }
            }
        }
    }

    start() {
        // stop running song
        AUDIO_MANAGER.stopSong();

        // Starts the song
        if (!this.audioStarted) {
            AUDIO_MANAGER.playSongByName(this.audio, this.audioInterlude, 0, false);
            console.log("Audio start offset: " + AUDIO_MANAGER.getCurrentSongTime().toFixed(2) + "ms");

            this.audioStarted = true;
        }

        this.gameLoop();
    }

    togglePause() {
        if (!AUDIO_MANAGER._paused) {
            AUDIO_MANAGER.pauseSong();

            let pauseCurrentTime = AUDIO_MANAGER.getCurrentSongTime();
            clearTimeout(this.gameLoopTimeout);

            for (let id in this.onScreenHitObjects) {
                let hitObject = this.onScreenHitObjects[id];

                if (hitObject.constructor.name === "DrawableCircle" || hitObject.constructor.name === "DrawableSlider") {
                    let headContainer = (hitObject.constructor.name === "DrawableCircle") ? hitObject.containerDiv : hitObject.sliderHeadContainer;

                    if (hitObject.approachCircleCanvas) {
                        hitObject.approachCircleCanvas.style.transition = "none";
                        hitObject.approachCircleCanvas.style.transform = "scale(" + (1 + 3 - MathUtil.clamp((pauseCurrentTime - (hitObject.startTime - this.ARMs)) / this.ARMs, 0, 1) * 3) + ")";
                    }
                    hitObject.containerDiv.style.transition = "none";
                    hitObject.containerDiv.style.opacity = MathUtil.clamp((pauseCurrentTime - (hitObject.startTime - this.ARMs)) / (this.ARMs / 2), 0, 1);
                    if (this.mods.HD && pauseCurrentTime >= hitObject.startTime - this.ARMs / 2) {
                        console.log(headContainer);
                        headContainer.style.transition = "none";
                        headContainer.style.opacity = MathUtil.clamp(1 - ((pauseCurrentTime - (hitObject.startTime - this.ARMs / 2)) / (this.ARMs / 4)), 0, 1);
                    }
                }
            }

            SCENE_MANAGER.getScene().elements["pauseStateP"].style.display = "block";
        } else {
            let unpauseCurrentTime = AUDIO_MANAGER._pauseTime * 1000;

            for (let id in this.onScreenHitObjects) {
                let hitObject = this.onScreenHitObjects[id];

                if (hitObject.constructor.name === "DrawableCircle" || hitObject.constructor.name === "DrawableSlider") {
                    let headContainer = hitObject.constructor.name === "DrawableCircle" ? hitObject.containerDiv : hitObject.sliderHeadContainer;

                    if (hitObject.approachCircleCanvas) {
                        hitObject.approachCircleCanvas.style.transition = "transform " + MathUtil.clamp(-(unpauseCurrentTime - hitObject.startTime), 0, this.ARMs) / 1000 + "s linear";
                        hitObject.approachCircleCanvas.style.transform = "scale(1)";
                    }
                    if (unpauseCurrentTime - hitObject.startTime < -this.ARMs / 2) {
                        hitObject.containerDiv.style.transition = "opacity " + MathUtil.clamp(-(unpauseCurrentTime - (hitObject.startTime - this.ARMs / 2)), 0, this.ARMs / 2) / 1000 + "s linear";
                        hitObject.containerDiv.style.opacity = 1;
                    } else if (this.mods.HD) {
                        headContainer.style.transition = "opacity " + MathUtil.clamp(-(unpauseCurrentTime - (hitObject.startTime - this.ARMs / 4)), 0, this.ARMs / 4) / 1000 + "s linear";
                        headContainer.style.opacity = 0;
                    }
                } else if (hitObject.constructor.name === "DrawableSpinner") {
                    hitObject.lastTimeSampled += AUDIO_MANAGER.getCurrentSongTime() - unpauseCurrentTime; // Prevents bonus spins from exploding
                }
            }

            AUDIO_MANAGER.unpauseSong();
            this.gameLoop();
            SCENE_MANAGER.getScene().elements["pauseStateP"].style.display = "none";
        }
    }
}