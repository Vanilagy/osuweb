"use strict";

import {SceneBase} from "./scenebase";
import {BeatmapSetPanel} from "../../interface/beatmapsetpanel";

export class SceneSongSelect extends SceneBase {
    constructor() {
        super();

        this.panels = [];
        this.panelScroll = 0;
        this.panelScrollSpeed = 0;

        this.elements["songpanelsDiv"] = document.getElementById("songpanels");
    }

    initializePanels() {
        for(let i = 0; i < 10; i++) {
            this.panels[i] = new BeatmapSetPanel(i, null);
        }
    }

    preOpen(oldScene, callback) {
        callback(true);
    }

    postOpen(oldScene, callback) {
        callback(true);

        this.elements["songpanelsDiv"].style.display = "block";

        this.initializePanels();
    }

    preClose(newScene, callback) {
        callback(true);
    }

    postClose(newScene, callback) {
        callback(true);
    }


}