import { Beatmap, BeatmapEventBreak } from "../datamodel/beatmap";
import { DrawableCircle } from "./drawable_circle";
import { DrawableSlider, SliderTimingInfo } from "./drawable_slider";
import { Circle } from "../datamodel/circle";
import { Slider } from "../datamodel/slider";
import { DrawableHitObject } from "./drawable_hit_object";
import { DrawableSpinner } from "./drawable_spinner";
import { MathUtil } from "../util/math_util";
import { Color } from "../util/graphics_util";
import { PlayEvent } from "./play_events";
import { last } from "../util/misc_util";
import { Spinner } from "../datamodel/spinner";
import { HeadedDrawableHitObject } from "./headed_drawable_hit_object";
import { IGNORE_BEATMAP_SKIN, currentSkin, DEFAULT_COLORS, getHitSoundTypesFromSampleSetAndBitmap, HitSoundInfo } from "./skin";

const MINIMUM_REQUIRED_PRELUDE_TIME = 1500; // In milliseconds
const IMPLICIT_BREAK_THRESHOLD = 10000; // In milliseconds. When two hitobjects are more than {this value} millisecond apart and there's no break inbetween them already, put a break there automatically.

export interface ComboInfo {
    comboNum: number,
    n: number,
    isLast: boolean,
    color: Color,
    colorIndex: number
}

export interface Break {
    startTime: number,
    endTime: number
}

export class ProcessedBeatmap {
    public beatmap: Beatmap;
    public hitObjects: DrawableHitObject[];
    public breaks: Break[];

    constructor(beatmap: Beatmap) {
        this.beatmap = beatmap;
        this.hitObjects = [];
        this.breaks = [];
    }

    init() {
        this.generateHitObjects();

        console.time('Stack shift');
        this.applyStackShift(false);
        console.timeEnd('Stack shift');

        this.generateBreaks();
    }

    generateHitObjects() {
        let hitObjectId = 0;
        let comboCount = 1;
        let currentCombo = 0;

        let colorArray: Color[];
        if (IGNORE_BEATMAP_SKIN) {
            colorArray = currentSkin.colors;
            if (colorArray.length === 0) colorArray = DEFAULT_COLORS;
        } else {
            colorArray = this.beatmap.colors;
            if (colorArray.length === 0) colorArray = currentSkin.colors;
            if (colorArray.length === 0) colorArray = DEFAULT_COLORS;
        }

        let currentTimingPoint = 1;
        let currentMsPerBeat = this.beatmap.timingPoints[0].msPerBeat;
        let currentMsPerBeatMultiplier = 1;
        let currentSampleSet = this.beatmap.timingPoints[0].sampleSet;
        let currentSampleIndex = this.beatmap.timingPoints[0].sampleIndex;
        let currentVolume = this.beatmap.timingPoints[0].volume;

        for (let i = 0; i < this.beatmap.hitObjects.length; i++) {
            let rawHitObject = this.beatmap.hitObjects[i];

            let comboInfo: ComboInfo = null;

            if (rawHitObject.newCombo !== null) {
                if (rawHitObject.newCombo === -1) {
                    currentCombo++;
                } else {
                    if (IGNORE_BEATMAP_SKIN) currentCombo++; // No color skipping with this option enabled!
                    else currentCombo += rawHitObject.newCombo + 1;
                }

                comboCount = 1;
            }
            comboInfo = {
                comboNum: currentCombo,
                n: comboCount++,
                isLast: (this.beatmap.hitObjects[i + 1])? this.beatmap.hitObjects[i + 1].newCombo !== null : true,
                color: colorArray[currentCombo % colorArray.length],
                colorIndex: currentCombo % colorArray.length
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
                    currentSampleIndex = timingPoint.sampleIndex;
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

                let baseSet = rawHitObject.extras.sampleSet || currentSampleSet || 1;
                let additionSet = baseSet; // "Today, additionSet inherits from sampleSet. Otherwise, it inherits from the timing point."
                let index = rawHitObject.extras.customIndex || currentSampleIndex || 1;
                let volume = rawHitObject.extras.sampleVolume || currentVolume;

                let baseType = getHitSoundTypesFromSampleSetAndBitmap(baseSet, 1)[0]; // "The normal sound is always played, so bit 0 is irrelevant today."
                let additionTypes = getHitSoundTypesFromSampleSetAndBitmap(additionSet, rawHitObject.hitSound);

                let info: HitSoundInfo = {
                    base: baseType,
                    additions: additionTypes,
                    volume: volume,
                    index: index
                };

                newObject.hitSound = info;
            } else if (rawHitObject instanceof Slider) {
                newObject = new DrawableSlider(rawHitObject);

                let hitSounds: HitSoundInfo[] = [];
                for (let i = 0; i < rawHitObject.edgeHitsounds.length; i++) {
                    let hitSound = rawHitObject.edgeHitsounds[i];
                    let sampling = rawHitObject.edgeAdditions[i];

                    let baseSet = sampling.sampleSet || currentSampleSet || 1;
                    let additionSet = baseSet; // "Today, additionSet inherits from sampleSet. Otherwise, it inherits from the timing point."
                    let index = /*rawHitObject.extras.customIndex || */currentSampleIndex || 1; // Custom index support? eh... how? TODO
                    let volume = /*rawHitObject.extras.sampleVolume || */currentVolume; // Custom volume support? eh... how?

                    let baseType = getHitSoundTypesFromSampleSetAndBitmap(baseSet, 1)[0]; // "The normal sound is always played, so bit 0 is irrelevant today."
                    let additionTypes = getHitSoundTypesFromSampleSetAndBitmap(additionSet, hitSound);

                    let info: HitSoundInfo = {
                        base: baseType,
                        additions: additionTypes,
                        volume: volume,
                        index: index
                    };

                    hitSounds.push(info);
                }
                newObject.hitSounds = hitSounds;

                let sliderVelocityInOsuPixelsPerBeat = 100 * this.beatmap.difficulty.SV; // 1 SV is 100 osu!pixels per beat.
                let sliderVelocityInOsuPixelsPerMillisecond = sliderVelocityInOsuPixelsPerBeat / (currentMsPerBeat * currentMsPerBeatMultiplier);

                let timingInfo: SliderTimingInfo = {
                    msPerBeat: currentMsPerBeat,
                    msPerBeatMultiplier: currentMsPerBeatMultiplier,
                    sliderVelocity: sliderVelocityInOsuPixelsPerMillisecond
                };

                newObject.timingInfo = timingInfo;

                let sliderTickCompletions = [];
                // Only go to completion 1, because the slider tick locations are determined solely by the first repeat cycle. In all cycles after that, they stay in the exact same place. Example: If my slider is:
                // O----T----T-O
                // where O represents the ends, and T is a slider tick, then repeating that slider does NOT change the position of the Ts. It follows that slider ticks don't always "tick" in constant time intervals.
                for (let tickCompletion = 0; tickCompletion < 1; tickCompletion += (timingInfo.sliderVelocity * (timingInfo.msPerBeat / this.beatmap.difficulty.TR)) / rawHitObject.length) {
                    let timeToStart = tickCompletion * rawHitObject.length / timingInfo.sliderVelocity;
                    let timeToEnd = (1 - tickCompletion) * rawHitObject.length / timingInfo.sliderVelocity;

                    if (timeToStart < 6 || timeToEnd < 6) continue; // Ignore slider ticks temporally close to either slider end

                    sliderTickCompletions.push(tickCompletion);
                }
                
                // Weird implementation. Can probably be done much easier-ly. This handles the "going back and forth but keep the ticks in the same location" thing. TODO.
                let len = sliderTickCompletions.length;
                if (len > 0) {
                    for (let i = 1; i < newObject.hitObject.repeat; i++) {
                        if (i % 2 === 0) {
                            for (let j = 0; j < len; j++) {
                                sliderTickCompletions.push(i + sliderTickCompletions[j]);
                            }
                        } else {
                            for (let j = len-1; j >= 0; j--) {
                                sliderTickCompletions.push(i + 1 - sliderTickCompletions[j]);
                            }
                        }
                    }
                }

                newObject.sliderTickCompletions = sliderTickCompletions;
            } else if (rawHitObject instanceof Spinner) {
                newObject = new DrawableSpinner(rawHitObject);

                let baseSet = rawHitObject.extras.sampleSet || currentSampleSet || 1;
                let additionSet = baseSet; // "Today, additionSet inherits from sampleSet. Otherwise, it inherits from the timing point."
                let index = rawHitObject.extras.customIndex || currentSampleIndex || 1;
                let volume = rawHitObject.extras.sampleVolume || currentVolume;

                let baseType = getHitSoundTypesFromSampleSetAndBitmap(baseSet, 1)[0]; // "The normal sound is always played, so bit 0 is irrelevant today."
                let additionTypes = getHitSoundTypesFromSampleSetAndBitmap(additionSet, rawHitObject.hitSound);

                let info: HitSoundInfo = {
                    base: baseType,
                    additions: additionTypes,
                    volume: volume,
                    index: index
                };

                newObject.hitSound = info;
            }

            if (newObject !== null) {
                newObject.id = hitObjectId;
                newObject.comboInfo = comboInfo;
                newObject.init();

                this.hitObjects.push(newObject);
            }
    
            hitObjectId++;
        }
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

                if (!(stackBaseObject instanceof HeadedDrawableHitObject)) break;
                if (!(objectB instanceof HeadedDrawableHitObject)) continue;

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

            let hitObject = this.hitObjects[i];
            if (!(hitObject instanceof HeadedDrawableHitObject)) continue;

            let objectI = hitObject;
            
            if (objectI.stackHeight !== 0) continue;

            if (objectI instanceof DrawableCircle) {
                while (--n >= 0) {
                    let objectN = this.hitObjects[n];
                    if (!(objectN instanceof HeadedDrawableHitObject)) continue;

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
                            if (!(objectJ instanceof HeadedDrawableHitObject)) continue;

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

                    if (!(objectN instanceof HeadedDrawableHitObject)) continue;

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
            if (!(hitObject instanceof HeadedDrawableHitObject)) continue;

            if (hitObject.stackHeight !== 0) hitObject.applyStackPosition();
        }
    }

    draw() {
        for (let i = 0; i < this.hitObjects.length; i++) {
            this.hitObjects[i].draw();
        }
    }

    // The time to delay the song at the start to allow for player preparation, in milliseconds
    getPreludeTime() {
        let preludeTime = 0;
        let firstHitObject = this.hitObjects[0];
        if (!firstHitObject) return 0;

        if (firstHitObject.startTime < MINIMUM_REQUIRED_PRELUDE_TIME) {
            preludeTime = MINIMUM_REQUIRED_PRELUDE_TIME - firstHitObject.startTime;
        }

        return preludeTime;
    }
    
    getAllPlayEvents(): PlayEvent[] {
        let events: PlayEvent[] = [];

        for (let hitObject of this.hitObjects) {
            hitObject.addPlayEvents(events);
        }

        events.sort((a, b) => a.time - b.time); // Sort by time, ascending

        return events;
    }

    generateBreaks() {
        for (let event of this.beatmap.events) {
            if (event.type !== "break") continue;

            let breakEvent = event as BeatmapEventBreak;

            this.breaks.push({
                startTime: breakEvent.start,
                endTime: breakEvent.end
            });
        }

        if (this.hitObjects.length > 0) {
            let firstObject = this.hitObjects[0];
            let lastObject = last(this.hitObjects);

            // Add break before the first hit object
            this.breaks.push({
                startTime: -Infinity,
                endTime: firstObject.startTime
            });

            // Add break after the last hit object
            this.breaks.push({
                startTime: lastObject.endTime,
                endTime: Infinity
            });

            // Generate implicit breaks
            for (let i = 0; i < this.hitObjects.length-1; i++) {
                let ho1 = this.hitObjects[i]; // hohoho! CHRISUMASU!
                let ho2 = this.hitObjects[i+1];

                if (!ho1 || !ho2) break;

                outer:
                if (ho2.startTime - ho1.endTime >= IMPLICIT_BREAK_THRESHOLD) {
                    // Check if there's already a break starting between the two hit object

                    for (let breakEvent of this.breaks) {
                        if (breakEvent.startTime >= ho1.endTime && breakEvent.startTime <= ho2.startTime) {
                            break outer;
                        }
                    }

                    // No break there yet! Let's add one!

                    this.breaks.push({
                        startTime: ho1.endTime,
                        endTime: ho2.startTime
                    });
                }
            }
        } else {
            // Just a "break" that spans the whole song
            this.breaks.push({
                startTime: -Infinity,
                endTime: Infinity
            });
        }

        this.breaks.sort((a, b) => a.startTime - b.startTime); // ascending
    }

    /** Returns the total length of the playable portion of the map. */
    getPlayableLength() {
        if (this.hitObjects.length === 0) return 0;
        else return last(this.hitObjects).endTime - this.hitObjects[0].startTime;
    }

    getTotalBreakTime() {
        let total = 0;

        for (let breakEvent of this.breaks) {
            total += breakEvent.endTime - breakEvent.startTime;
        }

        return total;
    }
}