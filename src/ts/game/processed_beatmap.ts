import { Beatmap } from "../datamodel/beatmap";
import { DrawableCircle } from "./drawable_circle";
import { DrawableSlider } from "./drawable_slider";
import { Circle } from "../datamodel/circle";
import { Slider } from "../datamodel/slider";

export class ProcessedBeatmap {
    public beatmap: Beatmap;
    public hitObjects: any[];

    constructor(beatmap: Beatmap) {
        this.beatmap = beatmap;

        this.hitObjects = [];
    }

    init() {
        this.generateHitObjects();
    }

    generateHitObjects() {
        let hitObjectId = 0;
        let comboCount = 1;
        let nextCombo = 0;

        let currentTimingPoint = 1;
        let currentMsPerBeat = this.beatmap.timingPoints[0].msPerBeat;
        let currentMsPerBeatMultiplier = 100;
        let currentSampleSet = this.beatmap.timingPoints[0].sampleSet;
        let currentVolume = this.beatmap.timingPoints[0].volume;

        for (let i = 0; i < this.beatmap.hitObjects.length; i++) {
            let rawHitObject = this.beatmap.hitObjects[i];

            let comboInfo = null;

            if (rawHitObject.newCombo !== null) {
                if (rawHitObject.newCombo === -1) {
                    nextCombo++;
                }
                else {
                    nextCombo += rawHitObject.newCombo + 1;
                }
                comboCount = 1;
            }
            comboInfo = {
                comboNum: nextCombo,
                n: comboCount++,
                isLast: (this.beatmap.hitObjects[i + 1]) ? this.beatmap.hitObjects[i + 1].newCombo !== null : true
            };

            if (currentTimingPoint < this.beatmap.timingPoints.length) {
                while (this.beatmap.timingPoints[currentTimingPoint].offset <= rawHitObject.time) {
                    let timingPoint = this.beatmap.timingPoints[currentTimingPoint];

                    if (timingPoint.inherited) {
                        // TODO: is there a a lower limit?
                        currentMsPerBeatMultiplier = Math.min(1000, -timingPoint.msPerBeat);
                    } else {
                        currentMsPerBeatMultiplier = 100;
                        currentMsPerBeat = timingPoint.msPerBeat;
                    }

                    currentSampleSet = timingPoint.sampleSet;
                    currentVolume = timingPoint.volume;

                    currentTimingPoint++;

                    if (currentTimingPoint === this.beatmap.timingPoints.length) {
                        break;
                    }
                }
            }

            let newObject = null;

            if (rawHitObject instanceof Circle) {
                newObject = new DrawableCircle(rawHitObject);
            } else if (rawHitObject instanceof Slider) {
                newObject = new DrawableSlider(rawHitObject);

                let timingInfo = {
                    msPerBeat: currentMsPerBeat,
                    msPerBeatMultiplier: currentMsPerBeatMultiplier,
                    sliderVelocity: 100 * this.beatmap.difficulty.SV * (100 / currentMsPerBeatMultiplier) / (currentMsPerBeat)
                };

                newObject.endTime = rawHitObject.time + rawHitObject.repeat * rawHitObject.length / timingInfo.sliderVelocity;
                newObject.timingInfo = timingInfo;
            }

            if (newObject !== null) {
                newObject.id = hitObjectId;
                newObject.comboInfo = comboInfo;
                //if (fullCalc) {
                //    newObject.comboInfo = comboInfo;
                //    newObject.hitSoundInfo = hitSoundInfo;
                //}
                this.hitObjects.push(newObject);
            }
    
            hitObjectId++;
        }
    }

    draw() {
        for (let i = 0; i < this.hitObjects.length; i++) {
            this.hitObjects[i].draw();
        }
    }
}