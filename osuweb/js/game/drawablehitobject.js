"use strict";

import {GAME_STATE, AUDIO_MANAGER, SCENE_MANAGER} from "../main";

export class DrawableHitObject {
    constructor(hitObject) {
        this.hitObject = hitObject;

        this.x = hitObject.x;
        this.y = hitObject.y;
        this.startPoint = {x: hitObject.x, y: hitObject.y};
        this.endPoint = {x: hitObject.x, y: hitObject.y};
        this.startTime = hitObject.time;
        this.endTime = hitObject.time;

        this.stackHeight = 0;

        this.containerDiv = null;
        this.approachCircleCanvas = null;
    }

    show(offset) {
        this.containerDiv.style.visibility = "visible";
        this.containerDiv.style.transition = "opacity " + (((GAME_STATE.currentPlay.ARMs / 2) - offset) / 1000) + "s linear";
        this.containerDiv.style.opacity = 1;
        this.approachCircleCanvas.style.transform = "scale(1.0)";
        this.approachCircleCanvas.style.transition = "transform " + ((GAME_STATE.currentPlay.ARMs - offset) / 1000) + "s linear";
    }

    remove() {
        if(SCENE_MANAGER.getScene().elements["objectContainerDiv"].contains(this.containerDiv)) SCENE_MANAGER.getScene().elements["objectContainerDiv"].removeChild(this.containerDiv);
    }

    append() {
        SCENE_MANAGER.getScene().elements["objectContainerDiv"].appendChild(this.containerDiv);
    }

    render() {

    }

    applyStackPosition() {
        this.x += this.stackHeight * -4;
        this.y += this.stackHeight * -4;
    }

    static playHitSound(data) {
        let skin = GAME_STATE.currentSkin || GAME_STATE.defaultSkin;

        let audioObj = skin.skinElements[data.sampleSet + "-hitnormal"];

        AUDIO_MANAGER.playSound(audioObj, data.volume);

        // Gets information stored in additions bitfield
        if ((data.additions & 2) === 2) {
            let audioObj = skin.skinElements[data.sampleSetAddition + "-hitwhistle"];
            AUDIO_MANAGER.playSound(audioObj, data.volume);
        }
        if ((data.additions & 4) === 4) {
            let audioObj = skin.skinElements[data.sampleSetAddition + "-hitfinish"];
            AUDIO_MANAGER.playSound(audioObj, data.volume);
        }
        if ((data.additions & 8) === 8) {
            let audioObj = skin.skinElements[data.sampleSetAddition + "-hitclap"];
            AUDIO_MANAGER.playSound(audioObj, data.volume);
        }
    }
}