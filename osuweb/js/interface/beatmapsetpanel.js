"use strict";

import {GAME_STATE} from "../main";

/**
 * This class represents a beatmapset panel in the song select and controls
 * it's positions and animations as well as input.
 */
export class BeatmapSetPanel {
    constructor(index, beatmapsetentry) {
        this._entry = beatmapsetentry;

        this.previousPanel = null;

        this.active = false;

        this._index = index;
        this._element = null;
        this._scroll = 0;
        this._height = BeatmapSetPanel.getPanelHeight();
        this._expansion = 100;

        this.createElement();
    }

    setScroll(scroll) {
        this._scroll = scroll;
    }

    createElement() {
        this._element = document.createElement("div");
        this._element.className = "songpanel";
        this._element.onclick = this.onClick.bind(this);

        this.updateElement();

        document.getElementById("songpanelswrapper").appendChild(this._element);
    }

    updateElement() {
        let expansion = Math.pow(Math.abs((this._scroll + (16 * this._index + 8) - 50) / 100), 1.2);

        this._element.style.top = this._scroll + (16 * this._index)+"%";
        this._element.style.right = "calc(-"+(expansion * 20)+"%)";
    }

    getCenterY() {
        return this._scroll * GAME_STATE.screen.height / 100 + BeatmapSetPanel.getPanelHeight() * this._index + BeatmapSetPanel.getPanelHeight() / 2;
    }

    static getPanelHeight() {
        return 16 * GAME_STATE.screen.height / 100;
    }

    onHover() {

    }

    onClick(evt) {

    }
}