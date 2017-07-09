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
        this._targetPanel = null;

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
        // Handling the list with mouse
        if(INPUT_STATE.inputButtonStates.m1 && !this._disableDragging) {
            this.stopTargeting();

            this._lastDragSpeed = INPUT_STATE.mouseDelta.y;
            this._panelScroll += INPUT_STATE.mouseDelta.y / GAME_STATE.screen.height * 100;
            this._lastDragDistance += Math.abs(INPUT_STATE.mouseDelta.y / GAME_STATE.screen.height * 100);
            this._forceUpdate = true;
        }
        else if(this._lastDragSpeed !== 0) {
            this._panelScrollSpeed = Math.max(-16, Math.min(16, this._lastDragSpeed / 1.5));
            this._lastDragSpeed = 0;
        }

        // If a panel should be scrolled to right now do that
        if(this._targetPanel) {
            // Difference of the current scroll position of the panel and the target.
            let scrollDiff = this._panelScroll + BeatmapSetPanel.getPercentFullPanelHeight() * this._targetPanel.index - 50 + 2 * BeatmapSetPanel.getPercentFullPanelHeight();

            this._panelScroll -= Math.max(-10, Math.min(10, 0.1 * scrollDiff)) * frameModifier;

            if(Math.abs(scrollDiff * 0.9) < 0.5) this.stopTargeting();
        }
        else {
            this._panelScroll += this._panelScrollSpeed * frameModifier;
        }

        if(!INPUT_STATE.inputButtonStates.m1) {
            if (this._panelScroll > 50 - BeatmapSetPanel.getPercentFullPanelHeight() / 2) {
                this._panelScroll -= (this._panelScroll - (50 - BeatmapSetPanel.getPercentFullPanelHeight() / 2)) * 0.25 * frameModifier;
                this._forceUpdate = true;
            }
            if (this._panelScroll < -((this._panels.length - 1) * BeatmapSetPanel.getPercentFullPanelHeight() - 50 + BeatmapSetPanel.getPercentFullPanelHeight() / 2)) {
                this._panelScroll -= (this._panelScroll + ((this._panels.length - 1) * BeatmapSetPanel.getPercentFullPanelHeight() + (this._activePanel ? this._activePanel.getSubPanels().length * BeatmapPanel.getPercentFullPanelHeight() : 0) - 50 + BeatmapSetPanel.getPercentFullPanelHeight() / 2)) * 0.25 * frameModifier;
                this._forceUpdate = true;
            }
        }

        // Find the most centered panel
        let centerPanelIndex = this.getCenterPanelIndex();

        // The scroll value that will be added ontop of the scroll if song panels are expanded
        let extraHeightPercent = 0;

        // Update the panels near the centered one
        for (let i = Math.max(centerPanelIndex - 15, 0); i < Math.min(centerPanelIndex + 15, this._panels.length); i++) {
            if(Math.abs(centerPanelIndex - i) > 10) {
                if(this._activePanel === this._panels[i] && this._panels[i]._visible === true) {
                    this._panelScroll += this._panels[i].getPercentExtraHeight();
                }
                this._panels[i].hidePanel();
            }
            else {
                if(this._activePanel === this._panels[i] && this._panels[i]._visible === false) {
                    this._panelScroll -= this._panels[i].getPercentExtraHeight();
                }
                this._panels[i].showPanel();

                this._panels[i].setScroll(this._panelScroll + extraHeightPercent);

                extraHeightPercent += this._panels[i].getPercentExtraHeight();
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

    onKeyDown(event) {
        if(event.keyCode === 37 && this._activePanel) {
            if(this._panels[this._activePanel.index - 1]) this.setActivePanel(this._panels[this._activePanel.index - 1]);
        }
        else if(event.keyCode === 39 && this._activePanel) {
            if(this._panels[this._activePanel.index + 1]) this.setActivePanel(this._panels[this._activePanel.index + 1]);
        }
    }

    scroll(value) {
        this.stopTargeting();

        this._panelScrollSpeed -= value * this._acceleration;
    }

    initializePanels() {
        for(let key in GAME_STATE.database.beatmapSetEntrys) {
            this._panels[this.nextIndex] = new BeatmapSetPanel(this.nextIndex++, GAME_STATE.database.beatmapSetEntrys[key]);
        }
    }

    setTargetPanel(panel) {
        this._targetPanel = panel;
    }

    stopTargeting() {
        this._targetPanel = null;
    }

    setActivePanel(panel) {
        this.setTargetPanel(panel);

        if(this._activePanel) {
            this._activePanel.collapse();
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