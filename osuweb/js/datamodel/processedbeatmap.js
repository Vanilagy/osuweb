"use strict";

import {FollowPoint, POINT_DISTANCE} from "../game/followpoint";
import {DrawableCircle} from "../game/drawablecircle";
import {DrawableSlider} from "../game/drawableslider";
import {Skin} from "./skin";
import {DrawableSpinner} from "../game/drawablespinner";
import {MathUtil} from "../util/mathutil";
import {GAME_STATE} from "../main";
import {Console} from "../console";

export class ProcessedBeatmap {
    constructor(beatmap) {
        this.sourceBeatmap = beatmap;

        this.hitObjects = [];
        this.followPoints = [];

        // Copy parsed info
        this.difficulty = beatmap.difficulty;
        this.timingPoints = beatmap.timingPoints;
        this.colours = beatmap.colours;
        this.events = beatmap.events;

        //Progression variables
        this.currentTimingPoint = 1;
        this.currentMsPerBeat = beatmap.timingPoints[0].msPerBeat;
        this.currentMsPerBeatMultiplier = 100;
        this.currentSampleSet = beatmap.timingPoints[0].sampleSet;
        this.currentVolume = beatmap.timingPoints[0].volume;
    }

    process(fullCalc = true) {
        let processStartTime = window.performance.now();

        this.generateDrawableHitObjects(fullCalc);
        this.applyStackShift(fullCalc);
        Console.info("Beatmap process time: " + ((window.performance.now() - processStartTime) / 1000).toFixed(3) + "s");
        if(fullCalc) this.calculateZOrder();
        if(fullCalc) this.calculateFollowPoints();


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
            let prevObj = this.hitObjects[i - 1];
            let currObj = this.hitObjects[i];

            if (prevObj.comboInfo.comboNum === currObj.comboInfo.comboNum && prevObj.comboInfo.n !== currObj.comboInfo.n && prevObj.constructor.name !== "DrawableSpinner" && currObj.constructor.name !== "DrawableSpinner") {
                let dist = Math.hypot(prevObj.endPoint.x - currObj.startPoint.x, prevObj.endPoint.y - currObj.startPoint.y);

                if (dist > POINT_DISTANCE * 3) {
                    this.followPoints.push(new FollowPoint(prevObj, currObj));
                }
            }
        }
    }

    generateDrawableHitObjects(fullCalc) {
        let hitObjectId = 0;
        let comboCount = 1;
        let nextCombo = 0;

        let mapGenerationStartTime = window.performance.now();

        for (let o = 0; o < this.sourceBeatmap.hitObjects.length; o++) {
            let obj = this.sourceBeatmap.hitObjects[o];

            if (fullCalc) {
                if (obj.newCombo !== null) {
                    if (obj.newCombo === -1) {
                        nextCombo++;
                    }
                    else {
                        nextCombo += obj.newCombo + 1;
                    }
                    comboCount = 1;
                }
                var comboInfo = {
                    comboNum: nextCombo,
                    n: comboCount++,
                    isLast: (this.sourceBeatmap.hitObjects[o + 1]) ? this.sourceBeatmap.hitObjects[o + 1].newCombo !== null : true
                };
            }

            if (this.currentTimingPoint < this.sourceBeatmap.timingPoints.length) {
                while (this.sourceBeatmap.timingPoints[this.currentTimingPoint].offset <= obj.time) {
                    let timingPoint = this.sourceBeatmap.timingPoints[this.currentTimingPoint];

                    if (timingPoint.inherited) {
                        // TODO: is there a a lower limit?
                        this.currentMsPerBeatMultiplier = Math.min(1000, -timingPoint.msPerBeat);
                    } else {
                        this.currentMsPerBeatMultiplier = 100;
                        this.currentMsPerBeat = timingPoint.msPerBeat;
                    }

                    this.currentSampleSet = timingPoint.sampleSet;
                    this.currentVolume = timingPoint.volume;

                    this.currentTimingPoint++;

                    if (this.currentTimingPoint === this.sourceBeatmap.timingPoints.length) {
                        break;
                    }
                }
            }

            let newObject = null;

            if (obj.constructor.name === "Circle") {
                newObject = new DrawableCircle(obj, this);
            } else if (obj.constructor.name === "Slider") {
                newObject = new DrawableSlider(obj, this, fullCalc);

                let timingInfo = {
                    msPerBeat: this.currentMsPerBeat,
                    msPerBeatMultiplier: this.currentMsPerBeatMultiplier,
                    sliderVelocity: 100 * this.difficulty.SV * (100 / this.currentMsPerBeatMultiplier) / (this.currentMsPerBeat)
                };

                newObject.endTime = obj.time + obj.repeat * obj.length / timingInfo.sliderVelocity;
                newObject.timingInfo = timingInfo;

                if (fullCalc) {
                    let sliderTickCompletions = [];
                    for (let tickCompletion = 0; tickCompletion < obj.repeat; tickCompletion += (timingInfo.sliderVelocity * (timingInfo.msPerBeat / this.difficulty.TR)) / obj.length) {
                        let t = Math.round(MathUtil.reflect(tickCompletion) * 10000) / 10000; // Rounding to get fucking actual values that make sense

                        if (t > 0 && t < 1) {
                            sliderTickCompletions.push(tickCompletion);
                        }
                    }
                    newObject.sliderTickCompletions = sliderTickCompletions;
                }
            } else if (obj.constructor.name === "Spinner") {
                newObject = new DrawableSpinner(obj, this, fullCalc);
            }

            let hitSoundInfo = null;

            if(fullCalc) {
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
            }

            if (newObject !== null) {
                newObject.id = hitObjectId;
                if (fullCalc) {
                    newObject.comboInfo = comboInfo;
                    newObject.hitSoundInfo = hitSoundInfo;
                }
                this.hitObjects.push(newObject);
            }

            hitObjectId++;
        }
        return mapGenerationStartTime;
    }

    applyStackShift(fullCalc) {
        let lastStackEnd = 0;
        let stackThreshold = this.difficulty.getApproachTime() * this.difficulty.SL;
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
                if (extendedEndIndex === this.hitObjects.length - 1)
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
            this.hitObjects[z].applyStackPosition(fullCalc);
        }
    }
}