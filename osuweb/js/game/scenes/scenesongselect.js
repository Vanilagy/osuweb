"use strict";

import {GAME_STATE, SCENE_MANAGER} from "../../main";
import {SceneBase} from "./scenebase";
import {BeatmapSetPanel} from "../../interface/beatmapsetpanel";

export class SceneSongSelect extends SceneBase {
    constructor() {
        super();

        this._acceleration = 3;

        this._panels = [];
        this._panelScroll = 0;
        this._panelScrollSpeed = 0;

        this.elements["songpanelsDiv"] = document.getElementById("songpanels");
    }

    getCenterPanelIndex() {
        let panelsScrolled = Math.floor(-this._panelScroll * GAME_STATE.screen.height / 100 / BeatmapSetPanel.getPanelHeight());

        if(panelsScrolled < 0) return 0;
        if(panelsScrolled >= this._panels.length) return this._panels.length - 1;

        let lastY = 0;

        for(let i = panelsScrolled; i < this._panels.length; i++) {
            let centerY = this._panels[i].getCenterY();

            if(centerY >= GAME_STATE.screen.height / 2) {
                let thisDifference = centerY - GAME_STATE.screen.height / 2;
                let prevDifference = Math.abs(lastY - GAME_STATE.screen.height / 2);

                return thisDifference < prevDifference ? i : i - 1;
            }

            lastY = centerY;
        }

        return panelsScrolled;
    }

    render(frameModifier) {
        this._panelScroll += this._panelScrollSpeed;

        if(this._panelScroll > 50 - 8) this._panelScroll -= (this._panelScroll - (50 - 8)) * 0.25 * frameModifier;
        if(this._panelScroll < -((this._panels.length - 1) * 16 - 50 + 8)) this._panelScroll -= (this._panelScroll + ((this._panels.length - 1) * 16 - 50 + 8)) * 0.25 * frameModifier;

        let centerPanelIndex = this.getCenterPanelIndex();

        if(this._panelScrollSpeed !== 0) {
            for (let i = Math.max(centerPanelIndex - 10, 0); i < Math.min(centerPanelIndex + 10, this._panels.length); i++) {
                this._panels[i].setScroll(this._panelScroll);
                this._panels[i].updateElement();
            }
        }

        this._panelScrollSpeed -= this._panelScrollSpeed * 0.15 * frameModifier;

        if((this._panelScrollSpeed < 0 && this._panelScrollSpeed > -0.01) ||(this._panelScrollSpeed > 0 && this._panelScrollSpeed < 0.01) || isNaN(this._panelScrollSpeed)) this._panelScrollSpeed = 0;
    }

    scroll(value) {
        this._panelScrollSpeed -= value * this._acceleration;
    }

    initializePanels() {
        for(let i = 0; i < 1000; i++) {
            this._panels[i] = new BeatmapSetPanel(i, null);
        }
    }

    preOpen(oldScene, callback) {
        callback(true);
    }

    postOpen(oldScene, callback) {
        callback(true);

        this.elements["songpanelsDiv"].style.display = "block";

        this.elements["backgroundDiv"].style.filter = "blur(5px)";
        this.elements["backgroundDiv"].style.webkitFilter = "blur(5px)";

        this.initializePanels();
    }

    preClose(newScene, callback) {
        callback(true);
    }

    postClose(newScene, callback) {
        callback(true);
    }


}