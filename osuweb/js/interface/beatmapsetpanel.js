"use strict";

/**
 * This class represents a beatmapset panel in the song select and controls
 * it's positions and animations as well as input.
 */
export class BeatmapSetPanel {
    constructor(index, beatmapsetentry) {
        this._entry = beatmapsetentry;

        this.previousPanel = null;

        this.active = false;

        this.index = index;
        this._element = null;
        this._y = 0;
        this._height = 16;
        this._expansion = 100;

        this.createElement();
    }

    createElement() {
        this._element = document.createElement("div");
        this._element.className = "songpanel";
        this._element.onclick = this.onClick.bind(this);

        this.updateElement();

        document.getElementById("songpanelswrapper").appendChild(this._element);
    }

    updateElement() {
        let expansion = Math.pow(Math.abs(((16 * i + 8) - 50) / 100), 1.2);

        this._element.style.top = (16*i)+"%";
        this._element.style.right = "calc(-"+(expansion * 20)+"%)";
    }

    onClick(evt) {

    }
}