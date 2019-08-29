import { Play } from "./play";
import { DrawableHitObject } from "./drawable_hit_object";
import { DrawableCircle } from "./drawable_circle";
import { Point } from "../util/point";
import { DrawableSlider } from "./drawable_slider";
import { MathUtil, EaseType } from "../util/math_util";
import { DrawableSpinner } from "./drawable_spinner";
import { PLAYFIELD_DIMENSIONS, HIT_OBJECT_FADE_IN_TIME } from "../util/constants";
import { BeatmapDifficulty } from "../datamodel/beatmap_difficulty";
import { ProcessedBeatmap } from "./processed_beatmap";
import { SliderCurvePerfect } from "./slider_curve_perfect";
import { SliderCurveBézier } from "./slider_curve_bézier";

const DEFAULT_SPIN_RADIUS = 45;
const RADIUS_LERP_DURATION = 480;
const SPINNER_END_REDUCTION = 1; // For edge cases where objects might start immediately after spinner. Done so movement will be correct.
export const HALF_TIME_PLAYBACK_RATE = 2/3;
export const DOUBLE_TIME_PLAYBACK_RATE = 3/2;

export enum Mod {
    // Difficulty reduction:
    Easy = "EZ",
    NoFail = "NF",
    HalfTime = "HT",
    Daycore = "DC",

    // Difficulty increase:
    HardRock = "HR",
    SuddenDeath = "SD",
    Perfect = "PF",
    DoubleTime = "DT",
    Nightcore = "NC",
    Hidden = "HD",
    Flashlight = "FL",

    // Special:
    Relax = "RX",
    Autopilot = "AP",
    SpunOut = "SO",
    Auto = "AT",
    Cinema = "CN"
}

let modMultipliers = new Map<Mod, number>();
modMultipliers.set(Mod.Easy, 0.5);
modMultipliers.set(Mod.NoFail, 0.5);
modMultipliers.set(Mod.HalfTime, 0.3);
modMultipliers.set(Mod.Daycore, 0.3);
modMultipliers.set(Mod.HardRock, 1.06);
modMultipliers.set(Mod.SuddenDeath, 1.0);
modMultipliers.set(Mod.Perfect, 1.0);
modMultipliers.set(Mod.DoubleTime, 1.12);
modMultipliers.set(Mod.Hidden, 1.06);
modMultipliers.set(Mod.Flashlight, 1.12);
modMultipliers.set(Mod.Relax, 0.0);
modMultipliers.set(Mod.Autopilot, 0.0);
modMultipliers.set(Mod.SpunOut, 0.9);
modMultipliers.set(Mod.Auto, 1.0);
modMultipliers.set(Mod.Cinema, 1.0);

enum WaypointType {
    HitCircle,
    SliderHead,
    SliderTick,
    SpinnerStart,
    SpinnerEnd
}

interface Waypoint {
    type: WaypointType, 
    time: number,
    pos?: Point,
    hitObject: DrawableHitObject
}

export enum AutoInstructionType {
    Blink,
    Move,
    Follow,
    Spin
}

export interface AutoInstruction {
    type: AutoInstructionType,
    time: number,
    endTime?: number,
    to?: Point,
    startPos?: Point,
    endPos?: Point,
    hitObject?: DrawableHitObject
}

function hardRockFlipPoint(point: Point) {
    point.y = hardRockFlipY(point.y);
}

function hardRockFlipY(y: number) {
    // Mirror the point on the horizontal line that goes through the playfield center.
    return PLAYFIELD_DIMENSIONS.height - y;
}

export class ModHelper {
    static getModsFromModCode(modCode: string) {
        let chunks: string[] = [];
        let set = new Set<Mod>();
    
        for (let i = 0; i < modCode.length; i += 2) {
            chunks.push(modCode.slice(i, i+2));
        }

        for (let chunk of chunks) {
            if (!Object.values(Mod).includes(chunk)) continue;
            set.add(chunk as Mod);
        }

        return set;
    }

    // TODO: Apply health respawn thing.
    static applyEz(processedBeatmap: ProcessedBeatmap) {
        let difficulty = processedBeatmap.difficulty;

        difficulty.CS /= 2; // half, no lower limit, this can actually go to CS 1
        difficulty.AR /= 2; // half
        difficulty.OD /= 2; // half
        difficulty.HP /= 2; // half
    }

    /** Change the difficulty values. */
    static applyHrFirstPass(processedBeatmap: ProcessedBeatmap) {
        let difficulty = processedBeatmap.difficulty;

        difficulty.CS = Math.min(7, difficulty.CS * 1.3); // cap at 7, and yes, the 1.3 is correct
        difficulty.AR = Math.min(10, difficulty.AR * 1.4); // cap at 10
        difficulty.OD = Math.min(10, difficulty.OD * 1.4); // cap at 10
        difficulty.HP = Math.min(10, difficulty.HP * 1.4); // cap at 10
    }

    /** Perform the point flipping. */
    static applyHrSecondPass(processedBeatmap: ProcessedBeatmap) {
        for (let i = 0; i < processedBeatmap.hitObjects.length; i++) {
            let hitObject = processedBeatmap.hitObjects[i];

            if (hitObject instanceof DrawableCircle) {
                hardRockFlipPoint(hitObject.startPoint);
                hardRockFlipPoint(hitObject.endPoint);
            } else if (hitObject instanceof DrawableSlider) {
                hardRockFlipPoint(hitObject.startPoint);
                hardRockFlipPoint(hitObject.tailPoint);
                // Since endPoint is either startPoint or tailPoint, we'll have flipped endPoint.

                let curve = hitObject.curve;
                if (curve instanceof SliderCurvePerfect) {
                    hardRockFlipPoint(curve.centerPos);
                    curve.startingAngle *= -1; // Here, we flip the angle on the horizontal axis. Since an angle with degree 0 lies exactly on that axis, it suffices to simply negate the angle in order to perform the flip.
                    curve.angleDifference *= -1; // Since we flipped, we now go the other way.
                } else if (curve instanceof SliderCurveBézier) {
                    for (let i = 0; i < curve.equalDistancePoints.length; i++) {
                        hardRockFlipPoint(curve.equalDistancePoints[i]);
                    }
                }

                hitObject.minY = hardRockFlipY(hitObject.minY);
                hitObject.maxY = hardRockFlipY(hitObject.maxY);

                // Because we flipped them, we need to swap 'em now too:
                let temp = hitObject.minY;
                hitObject.minY = hitObject.maxY;
                hitObject.maxY = temp;
            }
        }
    }

    static calculateModMultiplier(mods: Set<Mod>) {
        let multiplier = 1.0;

        mods.forEach((mod) => multiplier *= modMultipliers.get(mod));

        return multiplier;
    }

    static generateAutoPlaythroughInstructions(play: Play) {
        console.time("Auto playthrough instruction generation");

        //Console.debug(DEBUG_PREFIX+"Generating auto playthrough instructions...");
        //let startTime = window.performance.now();

        /* Generates waypoints from start and end positions aswell as slider ticks and spinners.
           Will be used to construct movement instructions.
         */
        let waypoints: Waypoint[] = [];
        for (let i = 0; i < play.processedBeatmap.hitObjects.length; i++) {
            let hitObject = play.processedBeatmap.hitObjects[i];

            if (hitObject instanceof DrawableCircle) {
                waypoints.push({
                    type: WaypointType.HitCircle,
                    time: hitObject.startTime,
                    pos: hitObject.startPoint,
                    hitObject: hitObject
                });
            } else if (hitObject instanceof DrawableSlider) {
                waypoints.push({
                    type: WaypointType.SliderHead,
                    time: hitObject.startTime,
                    pos: hitObject.startPoint,
                    hitObject: hitObject
                });

                for (let j = 0; j < hitObject.sliderTickCompletions.length; j++) {
                    let tickMs = hitObject.startTime + hitObject.sliderTickCompletions[j] * hitObject.hitObject.length / hitObject.timingInfo.sliderVelocity;
                    let tickPosition = hitObject.getPosFromPercentage(MathUtil.reflect(hitObject.sliderTickCompletions[j]));

                    waypoints.push({
                        type: WaypointType.SliderTick,
                        time: tickMs,
                        pos: tickPosition,
                        hitObject: hitObject
                    });
                }

                for (let j = 1; j <= hitObject.hitObject.repeat; j++) {
                    let repeatMs = hitObject.startTime + j * hitObject.hitObject.length / hitObject.timingInfo.sliderVelocity;
                    let repeatPosition = (j % 2) ? hitObject.tailPoint : hitObject.startPoint;

                    waypoints.push({
                        type: WaypointType.SliderTick,
                        time: repeatMs,
                        pos: repeatPosition,
                        hitObject: hitObject
                    });
                }
            } else if (hitObject instanceof DrawableSpinner) {
                waypoints.push({
                    type: WaypointType.SpinnerStart,
                    time: hitObject.startTime,
                    hitObject: hitObject
                });
                waypoints.push({
                    type: WaypointType.SpinnerEnd,
                    time: hitObject.endTime - SPINNER_END_REDUCTION,
                    hitObject: hitObject
                }); // Used to decrement active spinner count
            }

            //Console.verbose(DEBUG_PREFIX+"Added waypoint: " + waypoints[waypoints.length - 1]);
        }
        waypoints.sort((a, b) => a.time - b.time); // TODO: Isn't it already sorted? :thinking:
        //Console.debug(DEBUG_PREFIX+"Generated waypoints in " + (window.performance.now() - startTime).toFixed(3) + "ms");

        //let instructionsStartTime = window.performance.now();
        let instructions: AutoInstruction[] = [];
        let activeSpinnerCount = 0; // All objects are ignored when spinning

        // Moves cursor to the center of the screen at the start
        instructions.push({
            type: AutoInstructionType.Blink,
            time: -Infinity,
            to: {
                x: PLAYFIELD_DIMENSIONS.width/2,
                y: PLAYFIELD_DIMENSIONS.height/2
            }
        });

        // Generate instructions from waypoints
        for (let i = 0; i < waypoints.length; i++) {
            let waypoint = waypoints[i];

            if (activeSpinnerCount <= 0) {
                if (waypoint.type === WaypointType.HitCircle) {
                    let time = Math.max(getLastInstructionEndTime(), waypoint.time - play.approachTime);

                    instructions.push({
                        type: AutoInstructionType.Move,
                        time: time,
                        endTime: waypoint.time,
                        startPos: getLastInstructionPosition(time),
                        endPos: waypoint.pos
                    });
                } else if (waypoint.type === WaypointType.SliderHead) {
                    let time = Math.max(getLastInstructionEndTime(), waypoint.time - play.approachTime);

                    instructions.push({
                        type: AutoInstructionType.Move,
                        time: time,
                        endTime: waypoint.time,
                        startPos: getLastInstructionPosition(time),
                        endPos: waypoint.pos
                    });

                    instructions.push({
                        type: AutoInstructionType.Follow,
                        time: waypoint.time,
                        endTime: waypoint.time,
                        hitObject: waypoint.hitObject
                    });
                } else if (waypoint.type === WaypointType.SliderTick) {
                    instructions.push({
                        type: AutoInstructionType.Follow,
                        time: getLastInstructionEndTime(),
                        endTime: waypoint.time,
                        hitObject: waypoint.hitObject
                    });
                }
            }

            if (waypoint.type === WaypointType.SpinnerStart) {
                activeSpinnerCount++;

                instructions.push({
                    type: AutoInstructionType.Spin,
                    time: waypoint.time,
                    startPos: getLastInstructionPosition(waypoint.time),
                    endTime: waypoint.hitObject.endTime - SPINNER_END_REDUCTION
                });
            } else if (waypoint.type === WaypointType.SpinnerEnd) {
                activeSpinnerCount--;
            }

            if (waypoint.type !== WaypointType.SpinnerEnd) {
                //Console.verbose(DEBUG_PREFIX+"Added instruction: " + instructions[instructions.length - 1]);
            }
        }

        // Remove repeated followSlider instructions all linking to the same slider
        for (let i = 0; i < instructions.length-1; i++) {
            if (instructions[i].type === AutoInstructionType.Follow) {
                while (instructions[i + 1] && instructions[i + 1].type === AutoInstructionType.Follow && instructions[i + 1].hitObject === instructions[i].hitObject) {
                    instructions.splice(i + 1, 1);
                }
            }
        }
        //Console.debug(DEBUG_PREFIX+"Removed repeated followSlider instructions");

        // Merge simulatenous spinners into one instruction
        for (let i = 0; i < instructions.length-1; i++) {
            if (instructions[i].type === AutoInstructionType.Spin) {
                while (instructions[i + 1] && instructions[i + 1].type === AutoInstructionType.Spin) {
                    instructions[i].endTime = Math.max(instructions[i].endTime, instructions[i + 1].endTime);
                    instructions.splice(i + 1, 1);
                }
            }
        }
        //Console.debug(DEBUG_PREFIX+"Merged simultaneous spinners");

        // Remove unnecessary instructions with same starting time
        for (let i = 0; i < instructions.length-1; i++) {
            while (instructions[i + 1] && instructions[i + 1].time === instructions[i].time) {
                instructions.splice(i, 1);
            }
        }
        //Console.debug(DEBUG_PREFIX+"Removed unnecessary instructions");

        function getLastInstructionPosition(time: number) {
            let lastInstruction = instructions[instructions.length - 1];

            if (lastInstruction.type === AutoInstructionType.Blink) {
                return lastInstruction.to;
            } else if (lastInstruction.type === AutoInstructionType.Move) {
                return lastInstruction.endPos;
            } else if (lastInstruction.type === AutoInstructionType.Follow) {
                let slider = lastInstruction.hitObject as DrawableSlider;

                let completion = (slider.timingInfo.sliderVelocity * (time - slider.startTime)) / slider.hitObject.length;
                completion = MathUtil.clamp(completion, 0, slider.hitObject.repeat);
                let pos = slider.getPosFromPercentage(MathUtil.reflect(completion));

                return pos;
            } else if (lastInstruction.type === AutoInstructionType.Spin) {
                // we won't spin more than we have to, duh
                var time = Math.min(lastInstruction.endTime, time); // apparently let doesn't work here. It won't let me!

                return ModHelper.getSpinPositionFromSpinInstruction(lastInstruction, time);
            }
        }

        function getLastInstructionEndTime() {
            let lastInstruction = instructions[instructions.length - 1];

            if (lastInstruction.type === AutoInstructionType.Blink) {
                return lastInstruction.time;
            } else {
                return lastInstruction.endTime;
            }
        }

        console.timeEnd("Auto playthrough instruction generation");

        //Console.debug(DEBUG_PREFIX+"Generated instructions in " + (window.performance.now() - instructionsStartTime).toFixed(3) + "ms");
        //Console.debug(DEBUG_PREFIX+"Algorithm completed in " + (window.performance.now() - startTime).toFixed(3) + "ms");
        return instructions;
    }

    static getSpinPositionFromSpinInstruction(instruction: AutoInstruction, time: number): Point {
        let middleX = PLAYFIELD_DIMENSIONS.width/2,
            middleY = PLAYFIELD_DIMENSIONS.height/2;

        let radiusLerpCompletion = (time - instruction.time) / RADIUS_LERP_DURATION;
        radiusLerpCompletion = MathUtil.clamp(radiusLerpCompletion, 0, 1);
        radiusLerpCompletion = MathUtil.ease(EaseType.EaseInOutQuad, radiusLerpCompletion);
        let spinRadius = Math.hypot(instruction.startPos.x - middleX, instruction.startPos.y - middleY) * (1 - radiusLerpCompletion) + DEFAULT_SPIN_RADIUS * radiusLerpCompletion;
        let angle = Math.atan2(instruction.startPos.y - middleY, instruction.startPos.x - middleX) + 0.05 * (time - instruction.time);

        return {
            x: middleX + Math.cos(-angle) * spinRadius, // Minus, because spinning counter-clockwise looks so much better.
            y: middleY + Math.sin(-angle) * spinRadius
        };
    }
}