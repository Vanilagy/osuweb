"use strict";

import {SceneBase} from "./scenebase";
import {AUDIO_MANAGER} from "../../main";

export class SceneMenu extends SceneBase {
    constructor() {
        super();

        this.addElement("osuInput", "osu");
        this.addElement("beatmapInput", "beatmap");
        this.addElement("snakingInput", "snaking");
        this.addElement("snakingDiv", "snakingOption");
    }

    preOpen(oldScene, callback) {
        callback(true);
    }

    postOpen(oldScene, callback) {
        this.elements["osuInput"].style.display = "block";

        AUDIO_MANAGER.playSongByName("circles", 0, 0, true);

        callback(true);
    }
    
    preClose(newScene, callback) {
        this.hideElements(["beatmapInput", "osuInput", "snakingDiv"]);

        callback(true);
    }

    postClose(newScene, callback) {
        callback(true);
    }
}