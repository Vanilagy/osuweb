"use strict";

import {GAME_STATE} from "../../main";
import {INPUT_STATE} from "../../util/inpututil";
import {SceneBase} from "./scenebase";
import {BeatmapSetPanel} from "../../interface/beatmapsetpanel";
import {BeatmapPanel} from "../../interface/beatmappanel";

export class SceneSongSelect extends SceneBase {
    constructor() {
        super();

        this._acceleration = 3;

        this._activePanel = null;

        this._panels = [];
        this._panelScroll = 0;
        this._panelScrollSpeed = 0;
        this._lastDragSpeed = 0;
        this._forceUpdate = true;

        this._disableDragging = false;
        this._lastDragDistance = 0;

        this.elements["songpanelsDiv"] = document.getElementById("songpanels");

        this.nextIndex = 0;
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
        if(INPUT_STATE.inputButtonStates.m1 && !this._disableDragging) {
            this._lastDragSpeed = INPUT_STATE.mouseDelta.y;
            this._panelScroll += INPUT_STATE.mouseDelta.y / GAME_STATE.screen.height * 100;
            this._lastDragDistance += Math.abs(INPUT_STATE.mouseDelta.y / GAME_STATE.screen.height * 100);
            this._forceUpdate = true;
        }
        else if(this._lastDragSpeed !== 0) {
            this._panelScrollSpeed = Math.max(-7, Math.min(7, this._lastDragSpeed / 3));
            this._lastDragSpeed = 0;
        }

        this._panelScroll += this._panelScrollSpeed;

        if(!INPUT_STATE.inputButtonStates.m1) {
            if (this._panelScroll > 50 - BeatmapSetPanel.getPercentPanelHeight() / 2) {
                this._panelScroll -= (this._panelScroll - (50 - BeatmapSetPanel.getPercentPanelHeight() / 2)) * 0.25 * frameModifier;
                this._forceUpdate = true;
            }
            if (this._panelScroll < -((this._panels.length - 1) * BeatmapSetPanel.getPercentPanelHeight() + (this._activePanel ? this._activePanel.getSubPanels().length * BeatmapPanel.getPercentPanelHeight() : 0) - 50 + BeatmapSetPanel.getPercentPanelHeight() / 2)) {
                this._panelScroll -= (this._panelScroll + ((this._panels.length - 1) * BeatmapSetPanel.getPercentPanelHeight() + (this._activePanel ? this._activePanel.getSubPanels().length * BeatmapPanel.getPercentPanelHeight() : 0) - 50 + BeatmapSetPanel.getPercentPanelHeight() / 2)) * 0.25 * frameModifier;
                this._forceUpdate = true;
            }
        }

        let centerPanelIndex = this.getCenterPanelIndex();

        for (let i = Math.max(centerPanelIndex - 15, 0); i < Math.min(centerPanelIndex + 15, this._panels.length); i++) {
            if(Math.abs(centerPanelIndex - i) > 10) this._panels[i].hidePanel();
            else this._panels[i].showPanel();

            if(this._activePanel && i > this._activePanel.getIndex()) {
                this._panels[i].setScroll(this._panelScroll + this._activePanel.getSubPanels().length * BeatmapPanel.getPercentPanelHeight());
            }
            else {
                this._panels[i].setScroll(this._panelScroll);
            }
            if(this._panelScrollSpeed !== 0 || this._forceUpdate || this._panels[i].needsUpdate) this._panels[i].updateElement();
        }

        this._forceUpdate = false;

        this._panelScrollSpeed -= this._panelScrollSpeed * 0.15 * frameModifier;

        if((this._panelScrollSpeed < 0 && this._panelScrollSpeed > -0.01) ||(this._panelScrollSpeed > 0 && this._panelScrollSpeed < 0.01) || isNaN(this._panelScrollSpeed)) this._panelScrollSpeed = 0;
    }

    onPanelMouseDown(panel) {
        this._lastDragDistance = 0;
    }

    onPanelClick(panel) {
        if(this._lastDragDistance < 5 && this._activePanel !== panel) {
            this.setActivePanel(panel);
        }
    }

    scroll(value) {
        this._panelScrollSpeed -= value * this._acceleration;
    }

    initializePanels() {
        for(let key in GAME_STATE.database.beatmapSetEntrys) {
            this._panels[this.nextIndex] = new BeatmapSetPanel(this.nextIndex++, GAME_STATE.database.beatmapSetEntrys[key]);
        }
    }

    setActivePanel(panel) {
        if(this._activePanel) {
            this._activePanel.collapse();

            if(this._activePanel.getIndex() < panel.getIndex()) {
                this._panelScroll += this._activePanel._subPanels.length * (BeatmapPanel.getPercentPanelHeight());
            }
        }

        this._activePanel = panel;

        this._activePanel.expand();

        this._forceUpdate = true;
    }

    getActivePanel() {
        return this._activePanel;
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
        let centerPanelIndex = this.getCenterPanelIndex();

        this.elements["songpanelsDiv"].style.display = "none";

        this.elements["backgroundDiv"].style.filter = "blur(0px)";
        this.elements["backgroundDiv"].style.webkitFilter = "blur(0px)";

        for(let key in this._panels) this._panels[key].destroyElement();

        callback(true);
    }

    postClose(newScene, callback) {
        callback(true);
    }


}