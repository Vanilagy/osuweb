"use strict";

import {GraphicUtil} from "../util/graphicutil";
import {Skin} from "../datamodel/skin";
import {AccMeter} from "../interface/accmeter";
import {ProgressBar} from "../interface/progressbar";
import {DrawableCircle} from "../game/drawablecircle";
import {DrawableSlider} from "../game/drawableslider";
import {DrawableSpinner} from "../game/drawablespinner";
import {GAME_STATE, AUDIO_MANAGER} from "../main";
import {TimingUtil} from "../util/timingutil";
import {InputUtil, INPUT_STATE} from "../util/inpututil";
import {FollowPoint} from "./followpoint";
import {Score} from "./score";
import {MathUtil} from "../util/mathutil";
import {Console} from "../console";
import {DrawableHitObject} from "./drawablehitobject";

export let AUTOPLAY = true;

export class Play {
    constructor(beatmap, audio) {
        GAME_STATE.currentPlay = this;

        this.audio = audio;
        this.beatmap = beatmap;

        // doesn't do shit yet LUL
        //ingameContainer.style.width = window.innerWidth + "px";
        //ingameContainer.style.height = window.innerHeight + "px";

        this.marginWidth = (GraphicUtil.getBaseScreenDimensions().width - GraphicUtil.getBasePlayfieldDimensions().width) / 2;
        this.marginHeight = this.marginWidth * GraphicUtil.getAspectRatio();

        // The diameter of a circle on the screen (relative to playfield area)
        this.csOsuPixel = GraphicUtil.getCSOsuPixelSize(this.beatmap.CS);
        this.csPixel = Math.round(this.csOsuPixel * GraphicUtil.getPixelRatio());
        this.halfCsPixel = this.csPixel / 2;

        this.ARMs = TimingUtil.getApproachTimeMSForAR(this.beatmap.AR);

        this.hitObjects = [];
        this.followPoints = [];

        //Progression variables
        this.currentTimingPoint = 1;
        this.currentMsPerBeat = this.beatmap.timingPoints[0].msPerBeat;
        this.currentMsPerBeatMultiplier = 100;
        this.currentSampleSet = this.beatmap.timingPoints[0].sampleSet;
        this.currentVolume = this.beatmap.timingPoints[0].volume;

        this.generateDrawableHitObjects();
        this.calculateFollowPoints();
        this.calculateZOrder();
        this.applyStackShift();

        /*
        for (let z = 0; z < this.hitObjects.length; z++) {
            this.hitObjects[z].draw();
        }
        */

        this.accmeter = new AccMeter();
        this.progressbar = new ProgressBar();

        this.audioStartTime = null;
        this.audioOffset = 2;
        this.metronome = null;
        this.nextMetronome = null;
        this.metronomeRunning = false;
        this.audioStarted = false;

        this.currentHitObject = 0;
        this.lastAppendedHitObject = 0;
        this.currentFollowPoint = 0;
        this.onScreenHitObjects = {};

        this.inBreak = true;
        this.startBreak = true;
        this.nextBreak = null;

        this.score = new Score(this.beatmap);

        // Debug variables
        this.lastTickClockTime = window.performance.now();
        this.recordedTickSpeeds = [];
        this.stupidClock = window.performance.now();
    }

    calculateZOrder() {
        let zIndexBase = 1000000;
        let zIndexSortedArray = this.hitObjects.slice(0).sort(function (a, b) {
            if (Math.round(a.endTime) !== Math.round(b.endTime)) {
                return Math.round(a.endTime) - Math.round(b.endTime);
            } else {
                return b.time - a.time;
            }
        });
        for (let i = 0; i < zIndexSortedArray.length; i++) {
            zIndexSortedArray[i].zIndex = zIndexBase - i;
        }
    }

    calculateFollowPoints() {
        for (let i = 1; i < this.hitObjects.length; i++) {
            let prevObj = this.hitObjects[i - 1], currObj = this.hitObjects[i];
            if (prevObj.comboInfo.comboNum === currObj.comboInfo.comboNum && prevObj.comboInfo.n !== currObj.comboInfo.n) {
                let dist = Math.hypot(prevObj.endPoint.x - currObj.startPoint.x, prevObj.endPoint.y - currObj.startPoint.y);

                if (dist > 100) {
                    this.followPoints.push(new FollowPoint(prevObj, currObj));
                }
            }
        }
    }

    generateDrawableHitObjects() {
        let hitObjectId = 0;
        let comboCount = 1;
        let nextCombo = 0;

        let mapGenerationStartTime = window.performance.now();

        for (let o = 0; o < this.beatmap.hitObjects.length; o++) {
            let obj = this.beatmap.hitObjects[o];

            if (obj.newCombo !== null) {
                if (obj.newCombo === -1) {
                    nextCombo++;
                }
                else {
                    nextCombo += obj.newCombo + 1;
                }
                comboCount = 1;
            }
            let comboInfo = {
                comboNum: nextCombo,
                n: comboCount++,
                isLast: (this.beatmap.hitObjects[o + 1]) ? this.beatmap.hitObjects[o + 1].newCombo !== null : true
            };

            if (this.currentTimingPoint < this.beatmap.timingPoints.length) {
                while (this.beatmap.timingPoints[this.currentTimingPoint].offset <= obj.time) {
                    let timingPoint = this.beatmap.timingPoints[this.currentTimingPoint];

                    if (timingPoint.inherited) {
                        this.currentMsPerBeatMultiplier = -timingPoint.msPerBeat;
                    } else {
                        this.currentMsPerBeatMultiplier = 100;
                        this.currentMsPerBeat = timingPoint.msPerBeat;
                    }

                    this.currentSampleSet = timingPoint.sampleSet;
                    this.currentVolume = timingPoint.volume;

                    this.currentTimingPoint++;

                    if (this.currentTimingPoint === this.beatmap.timingPoints.length) {
                        break;
                    }
                }
            }

            let newObject = null;

            if (obj.constructor.name === "Circle") {
                newObject = new DrawableCircle(obj);
            } else if (obj.constructor.name === "Slider") {
                newObject = new DrawableSlider(obj);

                let timingInfo = {
                    msPerBeat: this.currentMsPerBeat,
                    msPerBeatMultiplier: this.currentMsPerBeatMultiplier,
                    sliderVelocity: 100 * this.beatmap.SV / (this.currentMsPerBeat * (this.currentMsPerBeatMultiplier / 100))
                };
                let sliderTickCompletions = [];

                for (let tickCompletion = 0; tickCompletion < obj.repeat; tickCompletion += (timingInfo.sliderVelocity * (timingInfo.msPerBeat / GAME_STATE.currentPlay.beatmap.sliderTickRate)) / obj.length) {
                    let t = Math.round(MathUtil.reflect(tickCompletion) * 10000) / 10000; // Rounding to get fucking actual values that make sense

                    if (t > 0 && t < 1) {
                        sliderTickCompletions.push(tickCompletion);
                    }
                }

                newObject.endTime = obj.time + obj.repeat * obj.length / timingInfo.sliderVelocity;
                newObject.timingInfo = timingInfo;
                newObject.sliderTickCompletions = sliderTickCompletions;
            } else if (obj.constructor.name === "Spinner") {
                newObject = new DrawableSpinner(obj);
            }

            let hitSoundInfo = null;
            let sliderEndHitSoundInfos = null;

            if (obj.constructor.name === "Circle" || obj.constructor.name === "Spinner") {
                hitSoundInfo = {
                    sampleSet: Skin.getSampleSetName((obj.samplings.sampleSet) ? obj.samplings.sampleSet : this.currentSampleSet),
                    sampleSetAddition: Skin.getSampleSetName((obj.samplings.sampleSetAddition) ? obj.samplings.sampleSetAddition : this.currentSampleSet),
                    additions: obj.hitSound,
                    volume: this.currentVolume / 100
                };
            } else if (obj.constructor.name === "Slider") {
                sliderEndHitSoundInfos = [];

                for (let i = 0; i < obj.additions.length; i++) {
                    sliderEndHitSoundInfos.push({
                        sampleSet: Skin.getSampleSetName((obj.edgeSamplings[i].sampleSet) ? obj.edgeSamplings[i].sampleSet : this.currentSampleSet),
                        sampleSetAddition: Skin.getSampleSetName((obj.edgeSamplings[i].sampleSetAddition) ? obj.edgeSamplings[i].sampleSetAddition : this.currentSampleSet),
                        additions: obj.additions[i],
                        volume: this.currentVolume / 100
                    });
                }

                hitSoundInfo = {
                    sliderEndHitSoundInfos: sliderEndHitSoundInfos,
                    bodySampleSet: Skin.getSampleSetName((obj.bodySamplings.sampleSet) ? obj.bodySamplings.sampleSet : this.currentSampleSet)
                };
            }

            if (newObject !== null) {
                newObject.id = hitObjectId;
                newObject.comboInfo = comboInfo;
                newObject.hitSoundInfo = hitSoundInfo;
                this.hitObjects.push(newObject);
            }

            hitObjectId++;
        }
        return mapGenerationStartTime;
    }

    updatePlayareaSize(callback) {
        let playAreaDimensions = GraphicUtil.getPlayAreaDimensions();

        GAME_STATE.currentScene.elements["playareaDiv"].style.height = playAreaDimensions.height;
        GAME_STATE.currentScene.elements["playareaDiv"].style.width = playAreaDimensions.width;

        setTimeout(() => {
            InputUtil.updatePlayfieldBounds();
            callback();
        });
    }

    gameLoop() {
        ///// DEBUG /////
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
        ///// DEBUG END /////

        // Starts the song
        if (!this.audioStarted) {
            AUDIO_MANAGER.playSongByName(this.audio, this.audioOffset, 0, false);
            console.log("Audio start offset: " + AUDIO_MANAGER.getCurrentSongTime().toFixed(2) + "ms");

            this.audioStarted = true;
        }

        // hitObject updates
        let userPlayfieldCoords = InputUtil.getCursorPlayfieldCoords();
        for (let id in this.onScreenHitObjects) {
            let hitObject = this.onScreenHitObjects[id];

            if (hitObject.constructor.name === "DrawableCircle") {
                // Remove approach circle
                if (AUDIO_MANAGER.getCurrentSongTime() >= hitObject.startTime && hitObject.hittable) {
                    if (AUTOPLAY) hitObject.hit(AUDIO_MANAGER.getCurrentSongTime() - hitObject.startTime); // AUTO hitting
                    hitObject.approachCircleCanvas.style.visibility = "hidden";
                }
                // Fade out object when it has not been hit
                if (AUDIO_MANAGER.getCurrentSongTime() >= hitObject.startTime + (199.5 - 10 * GAME_STATE.currentPlay.beatmap.OD) && hitObject.hittable) {
                    this.score.addScore(0, false, true, hitObject);
                    hitObject.containerDiv.style.animation = "0.15s fadeOut linear forwards";
                    hitObject.hittable = false;
                }
                // Remove object completely
                if (AUDIO_MANAGER.getCurrentSongTime() >= hitObject.startTime + 400) {
                    hitObject.remove();
                    delete this.onScreenHitObjects[id];
                    continue;
                }
            } else if (hitObject.constructor.name === "DrawableSlider") {
                // Handle scoring of slider ticks and reverses
                if ((hitObject.sliderTickCompletions[hitObject.currentSliderTick] !== undefined || hitObject.currentRepeat < hitObject.hitObject.repeat) && AUDIO_MANAGER.getCurrentSongTime() >= hitObject.startTime) {
                    let completion = Math.min(hitObject.hitObject.repeat, hitObject.timingInfo.sliderVelocity * (AUDIO_MANAGER.getCurrentSongTime() - hitObject.startTime) / hitObject.hitObject.length);
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
                        let tickPosition = GraphicUtil.getCoordFromCoordArray(hitObject.curve.equalDistancePoints, MathUtil.reflect(completionsToEval[i]));

                        let dist = Math.hypot(tickPosition.x / GraphicUtil.getPixelRatio() - userPlayfieldCoords.x, tickPosition.y / GraphicUtil.getPixelRatio() - userPlayfieldCoords.y);

                        if (dist <= this.csOsuPixel && INPUT_STATE.isHolding || AUTOPLAY) {
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
                if (AUDIO_MANAGER.getCurrentSongTime() >= hitObject.startTime && hitObject.hittable) {
                    if (AUTOPLAY) hitObject.hit(AUDIO_MANAGER.getCurrentSongTime() - hitObject.startTime);
                    hitObject.approachCircleCanvas.style.display = "none";
                }
                // Fade out slider head when it has not been hit
                if (AUDIO_MANAGER.getCurrentSongTime() >= hitObject.startTime + (199.5 - 10 * GAME_STATE.currentPlay.beatmap.OD) && hitObject.hittable) {
                    this.score.addScore(0, true, true);
                    hitObject.sliderHeadContainer.style.animation = "0.15s fadeOut linear forwards";
                    hitObject.hittable = false;
                }
                // On slider end
                if (AUDIO_MANAGER.getCurrentSongTime() >= hitObject.endTime && !hitObject.fadingOut) {
                    hitObject.score();

                    hitObject.containerDiv.style.animation = "0.175s fadeOut linear forwards";
                    hitObject.fadingOut = true;
                }
                // Remove object completely
                if (AUDIO_MANAGER.getCurrentSongTime() >= hitObject.endTime + 150) {
                    hitObject.remove();
                    delete this.onScreenHitObjects[id];
                    continue;
                }
            } else if (hitObject.constructor.name === "DrawableSpinner") {
                if (AUDIO_MANAGER.getCurrentSongTime() >= hitObject.startTime) {
                    // Activate spinner
                    if (!hitObject.active) {
                        hitObject.active = true;
                        hitObject.lastTimeSampled = window.performance.now();
                    }
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
                }

                // Spinner end
                if (AUDIO_MANAGER.getCurrentSongTime() >= hitObject.endTime && !hitObject.completed) {
                    hitObject.score();
                    hitObject.containerDiv.style.animation = "0.15s fadeOut linear forwards";
                    GAME_STATE.currentScene.elements["accmeterDiv"].style.opacity = 1;
                    hitObject.active = false;
                    hitObject.completed = true;
                }
                // Remove object completely
                if (AUDIO_MANAGER.getCurrentSongTime() >= hitObject.endTime + 150) {
                    hitObject.remove();
                    delete this.onScreenHitObjects[id];
                    continue;
                }
            }
        }

        // Handles breaks
        if (AUDIO_MANAGER.getCurrentSongTime() > this.hitObjects[0].startTime - 1500 && this.startBreak) {
            document.getElementById("background-dim").style.opacity = "0.90";
            this.inBreak = false;
            this.startBreak = false;
        }
        else if (this.hitObjects[this.hitObjects.length - 1].endTime - AUDIO_MANAGER.getCurrentSongTime() < -300) {
            document.getElementById("background-dim").style.opacity = "0";
            this.inBreak = true;
        }
        else {
            if (this.nextBreak === null) {
                for (let ii = 0; ii < this.beatmap.events.length; ii++) {
                    if (this.beatmap.events[ii].type !== "break") continue;

                    if (this.beatmap.events[ii].start > AUDIO_MANAGER.getCurrentSongTime()) {
                        if (this.nextBreak !== null && this.nextBreak.start > this.beatmap.events[ii].start) {
                            this.nextBreak = this.beatmap.events[ii];
                        }
                        else {
                            this.nextBreak = this.beatmap.events[ii];
                        }
                    }
                }
            }

            if (this.inBreak && this.nextBreak !== null && AUDIO_MANAGER.getCurrentSongTime() > this.nextBreak.end) {
                document.getElementById("background-dim").style.opacity = "0.90";
                this.inBreak = false;
                this.nextBreak = null;
            }
            else if (!this.inBreak && this.nextBreak !== null && AUDIO_MANAGER.getCurrentSongTime() > this.nextBreak.start) {
                document.getElementById("background-dim").style.opacity = "0";
                this.inBreak = true;
            }
        }

        // Makes follow points show up on-screen
        if (this.currentFollowPoint < this.followPoints.length) {
            while (this.followPoints[this.currentFollowPoint].startTime - 450 <= AUDIO_MANAGER.getCurrentSongTime()) {
                this.followPoints[this.currentFollowPoint].spawn();

                this.currentFollowPoint++;

                if (this.currentFollowPoint === this.followPoints.length) {
                    break;
                }
            }
        }

        // Appends upcoming hitObjects to the playarea
        while (this.hitObjects.length > this.lastAppendedHitObject && this.lastAppendedHitObject - this.currentHitObject < 1) {
            let nextTime = this.hitObjects[this.lastAppendedHitObject].startTime;

            while (this.hitObjects.length > this.lastAppendedHitObject && this.hitObjects[this.lastAppendedHitObject].startTime <= nextTime) {
                this.hitObjects[this.lastAppendedHitObject].draw();
                this.hitObjects[this.lastAppendedHitObject].append();
                this.lastAppendedHitObject++;
            }
        }

        // Makes hitObjects show up on-screen
        if (this.currentHitObject < this.hitObjects.length) {
            while (this.hitObjects[this.currentHitObject].startTime - ((this.hitObjects[this.currentHitObject].constructor !== "DrawableSpinner") ? this.ARMs : 400) <= AUDIO_MANAGER.getCurrentSongTime()) {
                let hitObject = this.hitObjects[this.currentHitObject];

                hitObject.show(AUDIO_MANAGER.getCurrentSongTime() - (this.hitObjects[this.currentHitObject].startTime - this.ARMs));
                this.onScreenHitObjects[hitObject.id] = hitObject;

                if (hitObject.constructor.name === "DrawableSpinner") {
                    GAME_STATE.currentScene.elements["accmeterDiv"].style.opacity = 0;
                }

                this.currentHitObject++;

                if (this.currentHitObject === this.hitObjects.length) {
                    break;
                }
            }
        }

        setTimeout(this.gameLoop.bind(this));
    }

    registerClick() {
        let userPlayfieldCoords = InputUtil.getCursorPlayfieldCoords();

        for (let id in this.onScreenHitObjects) {
            let hitObject = this.onScreenHitObjects[id];

            if (hitObject.hittable) {
                let dist = Math.hypot(userPlayfieldCoords.x - hitObject.x, userPlayfieldCoords.y - hitObject.y);

                if (dist <= this.csOsuPixel / 2) {
                    hitObject.hit(AUDIO_MANAGER.getCurrentSongTime() - hitObject.startTime);
                    break;
                }
            }
        }
    }

    applyStackShift() {
        let lastStackEnd = 0;
        let stackThreshold = this.ARMs * this.beatmap.stackLeniency;
        let stackSnapDistance = 3;

        let extendedEndIndex = this.hitObjects.length - 1;
        for (let i = this.hitObjects.length - 1; i >= 0; i--) {
            let hitObject = this.hitObjects[i];

            let stackBaseIndex = i;
            for (let b = i + 1; b < this.hitObjects.length; b++) {
                let objectB = this.hitObjects[b];
                let stackBaseObject = hitObject;

                if (stackBaseObject.constructor.name === "DrawableSpinner") break;
                if (objectB.constructor.name === "DrawableSpinner") continue;

                let endTime = stackBaseObject.endTime;

                if (objectB.startTime - endTime > stackThreshold) break;

                if (Math.hypot(stackBaseObject.startPoint.x - objectB.startPoint.x, stackBaseObject.startPoint.y - objectB.startPoint.y) < stackSnapDistance ||
                    stackBaseObject.constructor.name === "DrawableSlider" && MathUtil.distance(stackBaseObject.endPoint, objectB.startPoint) < stackSnapDistance) {
                    stackBaseIndex = b;

                    objectB.stackHeight = 0;
                }
            }

            if (stackBaseIndex > extendedEndIndex) {
                extendedEndIndex = stackBaseIndex;
                if (extendedEndIndex === this.beatmap.hitObjects.length - 1)
                    break;
            }
        }

        let extendedStartIndex = 0;
        for (let i = extendedEndIndex; i > 0; i--) {
            let n = i;

            let objectI = this.hitObjects[i];
            if (objectI.stackHeight !== 0 || objectI.constructor.name === "DrawableSpinner") continue;
            if (objectI.constructor.name === "DrawableCircle") {
                while (--n >= 0) {
                    let objectN = this.hitObjects[n];
                    if (objectN.constructor.name === "DrawableSpinner") continue;

                    let endTime = objectN.endTime;

                    if (objectI.startTime - endTime > stackThreshold)
                        break;

                    if (n < extendedStartIndex) {
                        objectN.stackHeight = 0;
                        extendedStartIndex = n;
                    }

                    if (objectN.constructor.name === "DrawableSlider" && MathUtil.distance(objectN.endPoint, objectI.startPoint) < stackSnapDistance) {
                        let offset = objectI.stackHeight - objectN.stackHeight + 1;

                        for (let j = n + 1; j <= i; j++) {
                            let objectJ = this.hitObjects[j];
                            if (MathUtil.distance(objectN.endPoint, objectJ.startPoint) < stackSnapDistance)
                                objectJ.stackHeight -= offset;
                        }
                        break;
                    }

                    if (MathUtil.distance(objectN.startPoint, objectI.startPoint) < stackSnapDistance) {
                        objectN.stackHeight = objectI.stackHeight + 1;
                        objectI = objectN;
                    }
                }
            }
            else if (objectI.constructor.name === "DrawableSlider") {
                while (--n >= 0) {
                    let objectN = this.hitObjects[n];

                    if (objectN.constructor.name === "Spinner") continue;

                    if (objectI.startTime - objectN.startTime > stackThreshold)
                        break;

                    if (MathUtil.distance(objectN.endPoint, objectI.startPoint) < stackSnapDistance) {
                        objectN.stackHeight = objectI.stackHeight + 1;
                        objectI = objectN;
                    }
                }
            }
        }

        for (let z = 0; z < this.hitObjects.length; z++) {
            this.hitObjects[z].applyStackPosition();
        }
    }

    start() {
        // stop running song
        AUDIO_MANAGER.stopSong();

        this.audioStartTime = window.performance.now() + this.audioOffset * 1000;
        this.gameLoop();
    }
}