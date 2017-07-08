"use strict";

import {GAME_STATE, SCENE_MANAGER} from "../main";
import {BeatmapSetPanel} from "./beatmapsetpanel";
import {SceneGameOsu} from "../game/scenes/scenegameosu";

const SCROLL_EXPANSION_FACTOR = 10;
const STATIC_EXPANSION_FACTOR = 8;

export class BeatmapPanel {
    constructor(index, parent, beatmap) {
        this._parent = parent;
        this._beatmap = beatmap;
        this._index = index;
        this._expansion = 0;

        this._element = null;
        this._overlayElement = null;

        this._beatmap.getBackgroundImageName();

        this.createElement();
    }

    createElement() {
        this._element = document.createElement("div");
        this._element.className = "diffpanel";
        this._element.style.height = (BeatmapPanel.getPercentPanelHeight() - BeatmapPanel.getPercentPanelMargin() * 2)+"%";

        this._overlayElement = document.createElement("div");
        this._overlayElement.className = "diffpaneloverlay";
        this._overlayElement.onclick = this.onClick.bind(this);

        this._overlayElement.innerHTML = "<div style='position: relative; left: 7%; top: 20%; pointer-events: none;'><span style='font-family: Exo2SemiBoldItalic; font-size: 20px;'>"+this._beatmap.version+"</span></div>";

        this.updateElement();

        this._element.appendChild(this._overlayElement);
        document.getElementById("songpanelswrapper").appendChild(this._element);
    }

    updateElement() {
        this._expansion = Math.pow(Math.abs((this._parent.getScroll() + (BeatmapSetPanel.getPercentPanelHeight() * (this._parent.getIndex() + 1) + BeatmapPanel.getPercentPanelHeight()) - 40 + (BeatmapPanel.getPercentPanelHeight() * this._index)) / 100), 1.05) * SCROLL_EXPANSION_FACTOR + STATIC_EXPANSION_FACTOR;

        this._element.style.top = this._parent.getScroll() + (BeatmapSetPanel.getPercentPanelHeight() * (this._parent.getIndex() + 1)) + (BeatmapPanel.getPercentPanelHeight() * this._index)+"%";
        this._element.style.right = "-"+(this._expansion)+"%";
    }

    destroyElement() {
        this._element.removeChild(this._overlayElement)
        document.getElementById("songpanelswrapper").removeChild(this._element);

        delete this._element;
        delete this._overlayElement;
    }

    onClick(evt) {
        SCENE_MANAGER.switchScene(new SceneGameOsu(this._beatmap, this._parent._entry));
    }

    getElement() {
        return this._element;
    }

    static getPanelHeight() {
        return BeatmapPanel.getPercentPanelHeight() * GAME_STATE.screen.height / 100;
    }

    static getPercentPanelHeight() {
        return 10;
    }

    static getPercentPanelMargin() {
        return 0.5;
    }
}