import { Play } from "./play";
import { DrawableHitObject } from "./drawable_hit_object";
import { DrawableCircle } from "./drawable_circle";
import { Point } from "../util/point";
import { DrawableSlider } from "./drawable_slider";
import { MathUtil, EaseType } from "../util/math_util";
import { DrawableSpinner } from "./drawable_spinner";
import { PLAYFIELD_DIMENSIONS } from "../util/constants";
import { ProcessedBeatmap } from "./processed_beatmap";
import { Mod } from "./mods";

const DEFAULT_SPIN_RADIUS = 45;
const RADIUS_LERP_DURATION = 480;
const SPINNER_END_REDUCTION = 1; // For edge cases where objects might start immediately after spinner. Done so movement will be correct.
export const HALF_TIME_PLAYBACK_RATE = 2/3;
export const DOUBLE_TIME_PLAYBACK_RATE = 3/2;

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
    // Mirror the point on the horizontal line that goes through the playfield center.
    point.y = PLAYFIELD_DIMENSIONS.height - point.y;
}

export class ModHelper {
    static getModsFromModCode(modCode: string) {
        let chunks: string[] = [];
        let set = new Set<Mod>();
    
        for (let i = 0; i < modCode.length; i += 2) {
            chunks.push(modCode.slice(i, i+2));
        }

        for (let chunk of chunks) {
            if (!Object.values(Mod).includes(chunk as Mod)) continue;
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

                let path = hitObject.path;
                for (let i = 0; i < path.points.length; i++) {
                    hardRockFlipPoint(path.points[i]);
                }

                hardRockFlipPoint(hitObject.bounds.min);
                hardRockFlipPoint(hitObject.bounds.max);

                // Because we flipped them, we need to swap 'em now too:
                let temp = hitObject.bounds.min.y;
                hitObject.bounds.min.y = hitObject.bounds.max.y;
                hitObject.bounds.max.y = temp;
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

                for (let j = 0; j < hitObject.tickCompletions.length; j++) {
                    let tickMs = hitObject.startTime + hitObject.tickCompletions[j] * hitObject.length / hitObject.velocity;
                    let tickPosition = hitObject.path.getPosFromPercentage(MathUtil.mirror(hitObject.tickCompletions[j]));

                    waypoints.push({
                        type: WaypointType.SliderTick,
                        time: tickMs,
                        pos: tickPosition,
                        hitObject: hitObject
                    });
                }

                for (let j = 1; j <= hitObject.repeat; j++) {
                    let repeatMs = hitObject.startTime + j * hitObject.length / hitObject.velocity;
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
        }
        waypoints.sort((a, b) => a.time - b.time); // TODO: Isn't it already sorted? :thinking:

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
                        endTime: waypoint.time, // Kinda stupid, but this is necessary in order for 2B maps to look decent.
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
        }

        // Remove repeated followSlider instructions all linking to the same slider
        for (let i = 0; i < instructions.length-1; i++) {
            let thisInstruction = instructions[i];
            if (thisInstruction.type !== AutoInstructionType.Follow) continue;

            while (instructions[i+1] && instructions[i+1].type === AutoInstructionType.Follow && instructions[i+1].hitObject === thisInstruction.hitObject) {
                instructions.splice(i+1, 1);
            }
        }

        // Merge simulatenous spinners into one instruction
        for (let i = 0; i < instructions.length-1; i++) {
            let thisInstruction = instructions[i];
            if (thisInstruction.type !== AutoInstructionType.Spin) continue;

            let nextInstruction = instructions[i+1];
            if (!nextInstruction || nextInstruction.type !== AutoInstructionType.Spin) continue;
            if (nextInstruction.time > thisInstruction.endTime) continue;

            thisInstruction.endTime = Math.max(thisInstruction.endTime, nextInstruction.endTime);
            instructions.splice(i+1, 1);
            i--; // Check the same spinner again as there might be another spinner that we need to merge with
        }

        // Remove unnecessary instructions with same starting time
        for (let i = 0; i < instructions.length-1; i++) {
            let thisInstruction = instructions[i];
            
            while (instructions[i+1] && instructions[i+1].time === thisInstruction.time) {
                instructions.splice(i+1, 1);
            }
        }

        function getLastInstructionPosition(time: number) {
            let lastInstruction = instructions[instructions.length - 1];

            if (lastInstruction.type === AutoInstructionType.Blink) {
                return lastInstruction.to;
            } else if (lastInstruction.type === AutoInstructionType.Move) {
                return lastInstruction.endPos;
            } else if (lastInstruction.type === AutoInstructionType.Follow) {
                let slider = lastInstruction.hitObject as DrawableSlider;

                let completion = ((slider.velocity * (time - slider.startTime)) / slider.length) || 0; // || 0 to catch NaN
                completion = MathUtil.clamp(completion, 0, slider.repeat);
                let pos = slider.path.getPosFromPercentage(MathUtil.mirror(completion));

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

        return instructions;
    }

    static getSpinPositionFromSpinInstruction(instruction: AutoInstruction, time: number): Point {
        let middleX = PLAYFIELD_DIMENSIONS.width/2,
            middleY = PLAYFIELD_DIMENSIONS.height/2;

        let radiusLerpCompletion = (time - instruction.time) / RADIUS_LERP_DURATION;
        radiusLerpCompletion = MathUtil.clamp(radiusLerpCompletion, 0, 1);
        radiusLerpCompletion = MathUtil.ease(EaseType.EaseInOutQuad, radiusLerpCompletion);
        let spinRadius = MathUtil.fastHypot(instruction.startPos.x - middleX, instruction.startPos.y - middleY) * (1 - radiusLerpCompletion) + DEFAULT_SPIN_RADIUS * radiusLerpCompletion;
        let angle = Math.atan2(instruction.startPos.y - middleY, instruction.startPos.x - middleX) + 0.05 * (time - instruction.time);

        return {
            x: middleX + Math.cos(-angle) * spinRadius, // Minus, because spinning counter-clockwise looks so much better.
            y: middleY + Math.sin(-angle) * spinRadius
        };
    }
}