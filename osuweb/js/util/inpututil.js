"use strict";

import {GAME_STATE, SETTINGS} from "../main";
import {GraphicUtil as GRAPHIC_UTIL} from "./graphicutil";

export let cursorElement = document.getElementById("cursor");
export let playareaElement = document.getElementById("playarea");

let playfieldBounds = null;

export class InputUtil {
    static mouseXElement(mouseX, element) {
        return mouseX - element.getBoundingClientRect().left;
    }

    static mouseYElement(mouseY, element) {
        return mouseY - element.getBoundingClientRect().top;
    }

    static updatePlayfieldBounds() {
        playfieldBounds = {
            x: playareaElement.getBoundingClientRect().left,
            y: playareaElement.getBoundingClientRect().top,
            width: playareaElement.clientWidth,
            height: playareaElement.clientHeight
        };
    }

    static getPlayfieldBounds() {
        return playfieldBounds;
    }

    static getCursorPlayfieldCoords() {
        let playfieldBounds = InputUtil.getPlayfieldBounds();

        if(playfieldBounds === null) return {x: 0, y: 0};

        return {
            x: (INPUT_STATE.mouseX - playfieldBounds.x) / GRAPHIC_UTIL.getPixelRatio() - GAME_STATE.currentPlay.marginWidth,
            y: (INPUT_STATE.mouseY - playfieldBounds.y) / GRAPHIC_UTIL.getPixelRatio() - GAME_STATE.currentPlay.marginHeight
        };
    }

    static updateCursor() {
        cursorElement.style.transform = "translate(calc(" + INPUT_STATE.mouseX + "px - 50%), calc(" + INPUT_STATE.mouseY + "px - 50%))";
    }

    static press() {
        if (GAME_STATE.currentPlay) {
            GAME_STATE.currentPlay.registerClick();
        }
    }

    static updateHoldingState() {
        INPUT_STATE.isHolding = INPUT_STATE.inputButtonStates["m1"] || INPUT_STATE.inputButtonStates["m2"] || INPUT_STATE.inputButtonStates["k1"] || INPUT_STATE.inputButtonStates["k2"];
    }

    static changeMouseButtonState(isLeft, bool) {
        let newPress = false;
        if (isLeft && INPUT_STATE.inputButtonStates["k1"] === false && INPUT_STATE.inputButtonStates["m1"] !== bool) {
            INPUT_STATE.inputButtonStates["m1"] = bool;
            newPress = true;
        } else if (!isLeft && INPUT_STATE.inputButtonStates["k2"] === false && INPUT_STATE.inputButtonStates["m2"] !== bool) {
            INPUT_STATE.inputButtonStates["m2"] = bool;
            newPress = true;
        }

        InputUtil.updateHoldingState();
        if (newPress && bool) {
            InputUtil.press();
        }
    }

    static changeKeyButtonState(keycode, bool) {
        let newPress = false;
        if (SETTINGS.data.keyCodeBindings["k1"] === keycode && INPUT_STATE.inputButtonStates["m1"] === false && INPUT_STATE.inputButtonStates["k1"] !== bool) {
            INPUT_STATE.inputButtonStates["k1"] = bool;
            newPress = true;
        } else if (SETTINGS.data.keyCodeBindings["k2"] === keycode && INPUT_STATE.inputButtonStates["m2"] === false && INPUT_STATE.inputButtonStates["k2"] !== bool) {
            INPUT_STATE.inputButtonStates["k2"] = bool;
            newPress = true;
        }

        InputUtil.updateHoldingState();
        if (newPress && bool) {
            InputUtil.press();
        }
    }
}

class InputState {
    constructor() {
        this.mouseX = Math.round(document.width / 2);
        this.mouseY = Math.round(document.height / 2);
        this.inputButtonStates = {
            m1: false,
            m2: false,
            k1: false,
            k2: false
        };
        this.isHolding = false;
        this.lastMousePosUpdateTime = window.performance.now();
    }
}

export let INPUT_STATE = new InputState();