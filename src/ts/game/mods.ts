import { Play } from "./play";
import { DrawableHitObject } from "./drawable_hit_object";
import { DrawableCircle } from "./drawable_circle";
import { Point } from "../util/point";
import { DrawableSlider } from "./drawable_slider";
import { MathUtil, EaseType } from "../util/math_util";
import { DrawableSpinner } from "./drawable_spinner";
import { PLAYFIELD_DIMENSIONS } from "../util/constants";

const DEFAULT_SPIN_RADIUS = 45;
const RADIUS_LERP_DURATION = 480;
const SPINNER_END_REDUCTION = 1; // For edge cases where objects might start immediately after spinner. Done so movement will be correct.

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
                    let time = Math.max(getLastInstructionEndTime(), waypoint.time - play.ARMs);

                    instructions.push({
                        type: AutoInstructionType.Move,
                        time: time,
                        endTime: waypoint.time,
                        startPos: getLastInstructionPosition(time),
                        endPos: waypoint.pos
                    });
                } else if (waypoint.type === WaypointType.SliderHead) {
                    let time = Math.max(getLastInstructionEndTime(), waypoint.time - play.ARMs);

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