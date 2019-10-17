import { Beatmap, BeatmapEventBreak, TimingPoint, BeatmapEventType } from "../datamodel/beatmap";
import { DrawableCircle } from "./drawables/drawable_circle";
import { DrawableSlider } from "./drawables/drawable_slider";
import { Circle } from "../datamodel/circle";
import { Slider } from "../datamodel/slider";
import { DrawableHitObject } from "./drawables/drawable_hit_object";
import { DrawableSpinner } from "./drawables/drawable_spinner";
import { MathUtil } from "../util/math_util";
import { Color } from "../util/graphics_util";
import { PlayEvent } from "./play_events";
import { last } from "../util/misc_util";
import { Spinner } from "../datamodel/spinner";
import { HeadedDrawableHitObject } from "./drawables/headed_drawable_hit_object";
import { IGNORE_BEATMAP_SKIN, DEFAULT_COLORS } from "./skin/skin";
import { gameState } from "./game_state";
import { BeatmapDifficulty } from "../datamodel/beatmap_difficulty";
import { pointDistance } from "../util/point";

const MINIMUM_REQUIRED_PRELUDE_TIME = 2000; // In milliseconds
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

export interface CurrentTimingPointInfo {
    timingPoint: TimingPoint,
    index: number,
    msPerBeat: number,
    msPerBeatMultiplier: number
}

export class ProcessedBeatmap {
    public beatmap: Beatmap;
    public hitObjects: DrawableHitObject[];
    public breaks: Break[];
    public difficulty: BeatmapDifficulty;

    constructor(beatmap: Beatmap) {
        this.beatmap = beatmap;
        this.hitObjects = [];
        this.breaks = [];
        this.difficulty = this.beatmap.difficulty.clone();
    }

    init() {
        this.generateHitObjects();
        this.generateBreaks();
    }

    generateHitObjects() {
        let currentDrawableIndex = 0;
        let comboCount = 1;
        let currentCombo = 0;

        let colorArray: Color[];
        if (IGNORE_BEATMAP_SKIN) {
            colorArray = gameState.currentGameplaySkin.colors;
            if (colorArray.length === 0) colorArray = DEFAULT_COLORS;
        } else {
            colorArray = this.beatmap.colors.comboColors;
            if (colorArray.length === 0) colorArray = gameState.currentGameplaySkin.colors;
            if (colorArray.length === 0) colorArray = DEFAULT_COLORS;
        }

        let firstTimingPoint = this.beatmap.timingPoints[0];

        let currentTimingPointInfo: CurrentTimingPointInfo = {
            timingPoint: firstTimingPoint,
            index: 0,
            msPerBeat: firstTimingPoint.msPerBeat,
            msPerBeatMultiplier: 1.0
        };

        for (let i = 0; i < this.beatmap.hitObjects.length; i++) {
            let rawHitObject = this.beatmap.hitObjects[i];

            let comboInfo: ComboInfo = null;
            if (rawHitObject.comboSkips !== 0) {
                if (IGNORE_BEATMAP_SKIN) currentCombo++; // No color skipping with this option enabled!
                else currentCombo += rawHitObject.comboSkips;

                comboCount = 1;
            }
            comboInfo = {
                comboNum: currentCombo,
                n: comboCount++,
                isLast: (this.beatmap.hitObjects[i + 1])? this.beatmap.hitObjects[i + 1].comboSkips !== 0 : true,
                color: colorArray[currentCombo % colorArray.length],
                colorIndex: currentCombo % colorArray.length
            };

            // Apply all the timing points until the current hit object
            while (currentTimingPointInfo.index < this.beatmap.timingPoints.length) {
                let nextTimingPoint = this.beatmap.timingPoints[currentTimingPointInfo.index + 1];
                if (!nextTimingPoint) break;
                if (nextTimingPoint.offset > rawHitObject.time) break;

                if (nextTimingPoint.inheritable) {
                    currentTimingPointInfo.msPerBeatMultiplier = 1.0;
                    currentTimingPointInfo.msPerBeat = nextTimingPoint.msPerBeat;
                }

                // LMFAO! PPY'S CODE IS SUCH A MESS! Turns out that if a timing point that can be inherited from has negative msPerBeat (it's positive for normal maps), it is counted as BOTH an inherited AND non-inherited timing point. BOTH! What the heck! That's why the following if is based on solely msPerBeat and not on the inherited-ness of the timing point specified in the .osu file. Whew.
                if (nextTimingPoint.msPerBeat < 0) {
                    // timingPoint.msPerBeat is negative. An exaplanation pulled from the osu website:
                    // The milliseconds per beat field (Decimal) defines the duration of one beat. It affect the scrolling speed in osu!taiko or osu!mania, and the slider speed in osu!standard, among other things. When positive, it is faithful to its name. When negative, it is a percentage of previous non-negative milliseconds per beat. For instance, 3 consecutive timing points with 500, -50, -100 will have a resulting beat duration of half a second, a quarter of a second, and half a second, respectively.
                    
                    let factor = nextTimingPoint.msPerBeat * -1 / 100;
                    factor = MathUtil.clamp(factor, 0.1, 10);
                    
                    currentTimingPointInfo.msPerBeatMultiplier = factor;   
                }

                currentTimingPointInfo.timingPoint = nextTimingPoint;
                currentTimingPointInfo.index++;
            }

            let newDrawable = null;

            if (rawHitObject instanceof Circle) {
                newDrawable = new DrawableCircle(rawHitObject, comboInfo, currentTimingPointInfo);
            } else if (rawHitObject instanceof Slider) {
                newDrawable = new DrawableSlider(rawHitObject, comboInfo, currentTimingPointInfo);
            } else if (rawHitObject instanceof Spinner) {
                newDrawable = new DrawableSpinner(rawHitObject, comboInfo, currentTimingPointInfo);
            }

            if (newDrawable !== null) {
                newDrawable.index = currentDrawableIndex;
                this.hitObjects.push(newDrawable);
            }
    
            currentDrawableIndex++;
        }
    }

    applyStackShift() {
        let stackThreshold = this.difficulty.getApproachTime() * this.difficulty.SL;
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

                if (pointDistance(stackBaseObject.startPoint, objectB.startPoint) < stackSnapDistance ||
                    (stackBaseObject instanceof DrawableSlider) && pointDistance(stackBaseObject.endPoint, objectB.startPoint) < stackSnapDistance) {
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

                    if (objectN instanceof DrawableSlider && pointDistance(objectN.endPoint, objectI.startPoint) < stackSnapDistance) {
                        let offset = objectI.stackHeight - objectN.stackHeight + 1;

                        for (let j = n + 1; j <= i; j++) {
                            let objectJ = this.hitObjects[j];
                            if (!(objectJ instanceof HeadedDrawableHitObject)) continue;

                            if (pointDistance(objectN.endPoint, objectJ.startPoint) < stackSnapDistance)
                                objectJ.stackHeight -= offset;
                        }
                        break;
                    }

                    if (pointDistance(objectN.startPoint, objectI.startPoint) < stackSnapDistance) {
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

                    if (pointDistance(objectN.endPoint, objectI.startPoint) < stackSnapDistance) {
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
            let hitObject = this.hitObjects[i];
            hitObject.draw();
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

        for (let i = 0; i < this.hitObjects.length; i++) {
            this.hitObjects[i].addPlayEvents(events);
        }

        events.sort((a, b) => a.time - b.time); // Sort by time, ascending

        return events;
    }

    generateBreaks() {
        for (let i = 0; i < this.beatmap.events.length; i++) {
            let event = this.beatmap.events[i];
            if (event.type !== BeatmapEventType.Break) continue;

            let breakEvent = event as BeatmapEventBreak;

            this.breaks.push({
                startTime: breakEvent.time,
                endTime: breakEvent.endTime
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

                outer: if (ho2.startTime - ho1.endTime >= IMPLICIT_BREAK_THRESHOLD) {
                    // Check if there's already a break starting between the two hit object

                    for (let j = 0; j < this.breaks.length; j++) {
                        let breakEvent = this.breaks[j];

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

        for (let i = 0; i < this.breaks.length; i++) {
            let breakEvent = this.breaks[i];
            total += breakEvent.endTime - breakEvent.startTime;
        }

        return total;
    }

    isInBreak(time: number) {
        // Do a naive linear search for now. Given that songs almost always have less than 10 breaks, this shouldn't be a performance issue. But look into this!
        for (let i = 0; i < this.breaks.length; i++) {
            let osuBreak = this.breaks[i];
            if (time >= osuBreak.startTime && time < osuBreak.endTime) return true;
        }
        return false;
    }
}