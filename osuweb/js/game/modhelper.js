"use strict";

import {MathUtil} from "../util/mathutil";
import {Console} from "../console";

const DEBUG_PREFIX = "[AUTO] ";
const IMPLEMENTED_MODS = ["AT", "HR", "EZ", "SO", "HD", "RX"];
const DEFAULT_SPIN_RADIUS = 45;
const RADIUS_LERP_DURATION = 480;
const SPINNER_END_REDUCTION = 1; // For edge cases where objects might start immediately after spinner. Done so movement will be correct.

class Waypoint {
    constructor(type, time, pos, elem) {
        this.type = type;
        this.time = time;
        this.pos = pos;
        this.elem = elem;
    }
}

export class ModHelper {
    static parseModCodeToObject(modCode) {
        Console.verbose("Parsing modcode...");
        let obj = {
            EZ: false /* Ekoro approves */,
            NF: false,
            HT: false,
            HR: false,
            SD: false,
            PF: false,
            DT: false,
            NC: false,
            HD: false,
            FL: false /* who the fuck uses this */,
            RX: false,
            AP: false,
            SO: false,
            AT: false
        };

        if (modCode === null || modCode === undefined) modCode = "";
        modCode = modCode.toUpperCase();

        // Looks at pairs of two characters each
        while (modCode.length) {
            if (obj.hasOwnProperty(modCode.slice(0, 2))) {
                obj[modCode.slice(0, 2)] = true;
            } else {
                Console.warn("Unrecognized mod '" + modCode.slice(0, 2) + "' parsed");
            }

            if (IMPLEMENTED_MODS.indexOf(modCode.slice(0, 2)) === -1) {
                Console.info("[NOTICE] Mod '" + modCode.slice(0, 2) + "' not yet inplemented!");
            }

            modCode = modCode.slice(2);
        }

        Console.verbose("Modcode parsed.");
        return obj;
    }
    static applyHR(beatmap) {
        beatmap.difficulty.CS = Math.min(7, beatmap.difficulty.CS * 1.3); // cap at 7
        beatmap.difficulty.AR = Math.min(10, beatmap.difficulty.AR * 1.4); // cap at 10
        beatmap.difficulty.OD = Math.min(10, beatmap.difficulty.OD * 1.4); // cap at 10
        beatmap.difficulty.HP = Math.min(10, beatmap.difficulty.HP * 1.4); // cap at 10

        // Flips along the x axis
        for (let i = 0; i < beatmap.sourceBeatmap.hitObjects.length; i++) {
            let hitObject = beatmap.sourceBeatmap.hitObjects[i];

            if (hitObject.constructor.name === "Circle") {
                hitObject.y = 384 - hitObject.y;
            } else if (hitObject.constructor.name === "Slider") {
                hitObject.y = 384 - hitObject.y;

                for (let j = 0; j < hitObject.sections.length; j++) {
                    for (let k = 0; k < hitObject.sections[j].values.length; k++) {
                        hitObject.sections[j].values[k].y = 384 - hitObject.sections[j].values[k].y;
                    }
                }
            }
        }
    }
    static applyEZ(beatmap) {
        // TODO: Is this correct?
        beatmap.difficulty.CS /= 2; // half
        beatmap.difficulty.AR /= 2; // half
        beatmap.difficulty.OD /= 2; // half
        beatmap.difficulty.HP /= 2; // half
    }
    static generateAutoPlaythroughInstructions(play) {
        Console.debug(DEBUG_PREFIX+"Generating auto playthrough instructions...");
        let startTime = window.performance.now();

        /* Generates waypoints from start and end positions aswell as slider ticks and spinners.
           Will be used to construct movement instructions.
         */
        let waypoints = [];
        for (let i = 0; i < play.beatmap.hitObjects.length; i++) {
            let hitObject = play.beatmap.hitObjects[i];

            if (hitObject.getType() === "DrawableCircle") {
                waypoints.push(new Waypoint("hitCircle", hitObject.startTime, {x: hitObject.x, y: hitObject.y}, hitObject));
            } else if (hitObject.getType() === "DrawableSlider") {
                waypoints.push(new Waypoint("hitSliderHead", hitObject.startTime, {x: hitObject.startPoint.x - 4 * hitObject.stackHeight, y: hitObject.startPoint.y - 4 * hitObject.stackHeight}, hitObject));

                for (let j = 0; j < hitObject.sliderTickCompletions.length; j++) {
                    let tickMs = hitObject.startTime + hitObject.sliderTickCompletions[j] * hitObject.hitObject.length / hitObject.timingInfo.sliderVelocity;
                    let tickPosition = hitObject.getPosFromPercentage(MathUtil.reflect(hitObject.sliderTickCompletions[j]));

                    waypoints.push(new Waypoint("sliderTick", tickMs, tickPosition, hitObject));
                }

                for (let j = 1; j <= hitObject.hitObject.repeat; j++) {
                    let repeatMs = hitObject.startTime + j * hitObject.hitObject.length / hitObject.timingInfo.sliderVelocity;
                    let repeatPosition = (j % 2) ? hitObject.endPoint : hitObject.startPoint;

                    waypoints.push(new Waypoint("sliderTick", repeatMs, repeatPosition, hitObject));
                }
            } else if (hitObject.getType() === "DrawableSpinner") {
                waypoints.push(new Waypoint("spinnerStart", hitObject.startTime, null, hitObject));
                waypoints.push(new Waypoint("spinnerEnd", hitObject.endTime - SPINNER_END_REDUCTION, null, hitObject)); // Used to decrement active spinner count
            }

            Console.verbose(DEBUG_PREFIX+"Added waypoint: " + waypoints[waypoints.length - 1]);
        }
        waypoints.sort(function(a, b) {return a.time - b.time});
        Console.debug(DEBUG_PREFIX+"Generated waypoints in " + (window.performance.now() - startTime).toFixed(3) + "ms");

        let instructionsStartTime = window.performance.now();
        let instructions = [];
        let activeSpinnerCount = 0; // All objects are ignored when spinning

        // Moves cursor to the center of the screen
        instructions.push({
            type: "blink",
            time: -10e6,
            to: {
                x: 256,
                y: 192
            }
        });

        // Generate instructions from waypoints
        for (let i = 0; i < waypoints.length; i++) {
            let waypoint = waypoints[i];

            if (activeSpinnerCount <= 0) {
                if (waypoint.type === "hitCircle") {
                    let time = Math.max(getLastInstructionEndTime(), waypoint.time - play.ARMs);

                    instructions.push({
                        type: "move",
                        time: time,
                        endTime: waypoint.time,
                        startPos: getLastInstructionPosition(time),
                        endPos: waypoint.pos
                    });
                } else if (waypoint.type === "hitSliderHead") {
                    let time = Math.max(getLastInstructionEndTime(), waypoint.time - play.ARMs);

                    instructions.push({
                        type: "move",
                        time: time,
                        endTime: waypoint.time,
                        startPos: getLastInstructionPosition(time),
                        endPos: waypoint.pos
                    });

                    instructions.push({
                        type: "follow",
                        time: waypoint.time,
                        endTime: waypoint.time,
                        elem: waypoint.elem
                    });
                } else if (waypoint.type === "sliderTick") {
                    instructions.push({
                        type: "follow",
                        time: getLastInstructionEndTime(),
                        endTime: waypoint.time,
                        elem: waypoint.elem
                    });
                }
            }

            if (waypoint.type === "spinnerStart") {
                activeSpinnerCount++;

                instructions.push({
                    type: "spin",
                    time: waypoint.time,
                    startPos: getLastInstructionPosition(waypoint.time),
                    endTime: waypoint.elem.endTime - SPINNER_END_REDUCTION
                });
            } else if (waypoint.type === "spinnerEnd") {
                activeSpinnerCount--;
            }

            if (waypoints.type !== "spinnerEnd") {
                Console.verbose(DEBUG_PREFIX+"Added instruction: " + instructions[instructions.length - 1]);
            }
        }

        // Remove repeated followSlider instructions all linking to the same slider
        for (let i = 0; i < instructions.length; i++) {
            if (instructions[i].type === "follow") {
                if (instructions[i + 1]) {
                    while (instructions[i + 1].type === "follow" && instructions[i + 1].elem === instructions[i].elem) {
                        instructions.splice(i + 1, 1);

                        if (!instructions[i + 1]) {
                            break;
                        }
                    }
                }
            }
        }
        Console.debug(DEBUG_PREFIX+"Removed repeated followSlider instructions");

        // Merge simulatenous spinners into one instruction
        for (let i = 0; i < instructions.length; i++) {
            if (instructions[i].type === "spin") {
                if (instructions[i + 1]) {
                    while (instructions[i + 1].type === "spin") {
                        instructions[i].endTime = Math.max(instructions[i].endTime, instructions[i + 1].endTime);
                        instructions.splice(i + 1, 1);

                        if (!instructions[i + 1]) {
                            break;
                        }
                    }
                }
            }
        }
        Console.debug(DEBUG_PREFIX+"Merged simultaneous spinners");

        // Remove unnecessary instructions with same starting time
        for (let i = 0; i < instructions.length; i++) {
            if (instructions[i + 1]) {
                while (instructions[i + 1].time === instructions[i].time) {
                    instructions.splice(i, 1);

                    if (!instructions[i + 1]) {
                        break;
                    }
                }
            }
        }
        Console.debug(DEBUG_PREFIX+"Removed unnecessary instructions");

        function getLastInstructionPosition(time) {
            let lastInstruction = instructions[instructions.length - 1];

            if (lastInstruction.type === "blink") {
                return lastInstruction.to;
            } else if (lastInstruction.type === "move") {
                return lastInstruction.endPos;
            } else if (lastInstruction.type === "follow") {
                let completion = MathUtil.clamp((lastInstruction.elem.timingInfo.sliderVelocity * (time - lastInstruction.elem.startTime)) / lastInstruction.elem.hitObject.length, 0, lastInstruction.elem.hitObject.repeat);
                let pos = lastInstruction.elem.getPosFromPercentage(MathUtil.reflect(completion));

                return pos;
            } else if (lastInstruction.type === "spin") {
                // we won't spin more than we have to, duh
                var time = Math.min(lastInstruction.endTime, time); // apparently let doesn't work here. It won't let me!

                return ModHelper.getSpinPositionFromInstruction(lastInstruction, time);
            }
        }

        function getLastInstructionEndTime() {
            let lastInstruction = instructions[instructions.length - 1];

            if (lastInstruction.type === "blink") {
                return lastInstruction.time;
            } else if (lastInstruction.type === "move") {
                return lastInstruction.endTime;
            } else if (lastInstruction.type === "follow") {
                return lastInstruction.endTime;
            } else if (lastInstruction.type === "spin") {
                return lastInstruction.endTime;
            }
        }

        Console.debug(DEBUG_PREFIX+"Generated instructions in " + (window.performance.now() - instructionsStartTime).toFixed(3) + "ms");
        Console.debug(DEBUG_PREFIX+"Algorithm completed in " + (window.performance.now() - startTime).toFixed(3) + "ms");
        return instructions;
    }
    static getSpinPositionFromInstruction(instruction, time) {
        let radiusLerpCompletion = MathUtil.ease("easeInOutQuad", MathUtil.clamp((time - instruction.time) / RADIUS_LERP_DURATION, 0, 1));
        let spinRadius = Math.hypot(instruction.startPos.x - 256, instruction.startPos.y - 192) * (1 - radiusLerpCompletion) + DEFAULT_SPIN_RADIUS * radiusLerpCompletion;
        let angle = Math.atan2(instruction.startPos.y - 192, instruction.startPos.x - 256) + 0.05 * (time - instruction.time);

        return {
            x: 256 + Math.cos(angle) * spinRadius,
            y: 192 + Math.sin(angle) * spinRadius
        }
    }
}