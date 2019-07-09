import { Beatmap } from "../datamodel/beatmap";
import { DrawableCircle } from "./drawable_circle";
import { DrawableSlider, SliderTimingInfo } from "./drawable_slider";
import { Circle } from "../datamodel/circle";
import { Slider } from "../datamodel/slider";
import { DrawableHitObject } from "./drawable_hit_object";
import { DrawableSpinner } from "./drawable_spinner";
import { MathUtil } from "../util/math_util";
import { Color } from "../util/graphics_util";

export interface ComboInfo {
    comboNum: number,
    n: number,
    isLast: boolean,
    color: Color
}

export class ProcessedBeatmap {
    public beatmap: Beatmap;
    public hitObjects: DrawableHitObject[];

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
        let colorArray = this.beatmap.colors;

        let currentTimingPoint = 1;
        let currentMsPerBeat = this.beatmap.timingPoints[0].msPerBeat;
        let currentMsPerBeatMultiplier = 1;
        let currentSampleSet = this.beatmap.timingPoints[0].sampleSet;
        let currentVolume = this.beatmap.timingPoints[0].volume;

        for (let i = 0; i < this.beatmap.hitObjects.length; i++) {
            let rawHitObject = this.beatmap.hitObjects[i];

            let comboInfo: ComboInfo = null;

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
                isLast: (this.beatmap.hitObjects[i + 1]) ? this.beatmap.hitObjects[i + 1].newCombo !== null : true,
                color: colorArray[nextCombo % colorArray.length]
            };

            if (currentTimingPoint < this.beatmap.timingPoints.length) {
                while (this.beatmap.timingPoints[currentTimingPoint].offset <= rawHitObject.time) {
                    let timingPoint = this.beatmap.timingPoints[currentTimingPoint];

                    if (timingPoint.inherited) {
                        // Implies timingPoint.msPerBeat is negative. An exaplanation pulled from the osu website:
                        // The milliseconds per beat field (Decimal) defines the duration of one beat. It affect the scrolling speed in osu!taiko or osu!mania, and the slider speed in osu!standard, among other things. When positive, it is faithful to its name. When negative, it is a percentage of previous non-negative milliseconds per beat. For instance, 3 consecutive timing points with 500, -50, -100 will have a resulting beat duration of half a second, a quarter of a second, and half a second, respectively.
                        
                        let factor = timingPoint.msPerBeat * -1 / 100;
                        factor = MathUtil.clamp(factor, 0, 10); // TODO: is there a a lower limit?
                        
                        currentMsPerBeatMultiplier = factor;
                    } else {
                        currentMsPerBeatMultiplier = 1;
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

                let sliderVelocityInOsuPixelsPerBeat = 100 * this.beatmap.difficulty.SV; // 1 SV is 100 osu!pixels per beat.
                let sliderVelocityInOsuPixelsPerMillisecond = sliderVelocityInOsuPixelsPerBeat / (currentMsPerBeat * currentMsPerBeatMultiplier);

                let timingInfo: SliderTimingInfo = {
                    msPerBeat: currentMsPerBeat,
                    msPerBeatMultiplier: currentMsPerBeatMultiplier,
                    sliderVelocity: sliderVelocityInOsuPixelsPerMillisecond
                };

                newObject.endTime = rawHitObject.time + rawHitObject.repeat * rawHitObject.length / timingInfo.sliderVelocity;
                newObject.timingInfo = timingInfo;

                let sliderTickCompletions = [];
                for (let tickCompletion = 0; tickCompletion < rawHitObject.repeat; tickCompletion += (timingInfo.sliderVelocity * (timingInfo.msPerBeat / this.beatmap.difficulty.TR)) / rawHitObject.length) {
                    let t = Math.round(MathUtil.reflect(tickCompletion) * 10000) / 10000; // Rounding to get fucking actual values that make sense

                    if (t > 0 && t < 1) {
                        sliderTickCompletions.push(tickCompletion);
                    }
                }
                newObject.sliderTickCompletions = sliderTickCompletions;
            }

            if (newObject !== null) {
                newObject.id = hitObjectId;
                newObject.comboInfo = comboInfo;

                this.hitObjects.push(newObject);
            }
    
            hitObjectId++;
        }

        console.time('Stack shift');
        this.applyStackShift(false);
        console.timeEnd('Stack shift');
    }

    applyStackShift(fullCalc: boolean) {
        let lastStackEnd = 0;
        let stackThreshold = this.beatmap.difficulty.getApproachTime() * this.beatmap.difficulty.SL;
        let stackSnapDistance = 3;

        let extendedEndIndex = this.hitObjects.length - 1;
        for (let i = this.hitObjects.length - 1; i >= 0; i--) {
            let hitObject = this.hitObjects[i];

            let stackBaseIndex = i;
            for (let b = i + 1; b < this.hitObjects.length; b++) {
                let objectB = this.hitObjects[b];
                let stackBaseObject = hitObject;

                if (stackBaseObject instanceof DrawableSpinner) break;
                if (objectB instanceof DrawableSpinner) continue;

                let endTime = stackBaseObject.endTime;

                if (objectB.startTime - endTime > stackThreshold) break;

                if (Math.hypot(stackBaseObject.startPoint.x - objectB.startPoint.x, stackBaseObject.startPoint.y - objectB.startPoint.y) < stackSnapDistance ||
                    (stackBaseObject instanceof DrawableSlider) && MathUtil.distance(stackBaseObject.endPoint, objectB.startPoint) < stackSnapDistance) {
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
            if (objectI.stackHeight !== 0 || objectI instanceof DrawableSpinner) continue;
            if (objectI instanceof DrawableCircle) {
                while (--n >= 0) {
                    let objectN = this.hitObjects[n];
                    if (objectN instanceof DrawableSpinner) continue;

                    let endTime = objectN.endTime;

                    if (objectI.startTime - endTime > stackThreshold)
                        break;

                    if (n < extendedStartIndex) {
                        objectN.stackHeight = 0;
                        extendedStartIndex = n;
                    }

                    if (objectN instanceof DrawableSlider && MathUtil.distance(objectN.endPoint, objectI.startPoint) < stackSnapDistance) {
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
            else if (objectI instanceof DrawableSlider) {
                while (--n >= 0) {
                    let objectN = this.hitObjects[n];

                    if (objectN instanceof DrawableSpinner) continue;

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
            let hitObject = this.hitObjects[z];
            if (hitObject.stackHeight !== 0)
                this.hitObjects[z].applyStackPosition();
        }
    }

    draw() {
        for (let i = 0; i < this.hitObjects.length; i++) {
            this.hitObjects[i].draw();
        }
    }
}