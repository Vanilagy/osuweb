"use strict";

import {SceneBase} from "./scenebase";
import {GAME_STATE, AUDIO_MANAGER, SCENE_MANAGER} from "../../main";
import {Console} from "../../console";

export class SceneLoading extends SceneBase {
    constructor() {
        super();

        this.addElement("loadingDiv", "loading");
    }

    transition(newScene, callback) {
        if(newScene.constructor.name === "SceneMenu") {
            this.preClose(newScene, (result) => {
                if(!result) Console.warn("Unexpected result when closing SceneLoading!");

                SCENE_MANAGER.setScene(newScene);

                newScene.postOpen(this, (result) => {
                    if(!result) Console.warn("Unexpected result when opening SceneMenu!");

                    callback(true);
                });
            });
        }
        else {
            callback(false);
        }
    }

    preOpen(oldScene, callback) {
        callback(false);
    }
    
    postOpen(oldScene, callback) {
        callback(false);
    }

    preClose(newScene, callback) {
        this.elements.cursor.src = "data:image/png;base64,"+GAME_STATE.defaultSkin.skinElements["cursor"];

        this.elements["loadingDiv"].style.opacity = 0;

        setTimeout(() => {
            this.elements["loadingDiv"].style.transition = "opacity 1s linear";
            this.elements["loadingDiv"].innerHTML = "WELCOME";
            this.elements["loadingDiv"].style.opacity = 1;
            AUDIO_MANAGER.playSound(GAME_STATE.defaultSkin.skinElements["welcome"]);

            setTimeout(() => {
                this.elements["loadingDiv"].style.opacity = 0;
                this.elements["foregroundDiv"].style.opacity = 0;

                setTimeout(() => {
                    this.hideElements(["loadingDiv", "foregroundDiv"]);

                    callback(true);
                }, 1000)
            }, 2000)
        }, 1100);
    }
    
    postClose(newScene, callback) {
        callback(true);
    }
}