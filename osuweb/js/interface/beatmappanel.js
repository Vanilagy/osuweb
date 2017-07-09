"use strict";

import {GAME_STATE, SCENE_MANAGER} from "../main";
import {BeatmapSetPanel} from "./beatmapsetpanel";
import {SceneGameOsu} from "../game/scenes/scenegameosu";
import {DifficultyCalculator} from "../game/difficulty/difficultycalculator";

const SCROLL_EXPANSION_FACTOR = 10;
const STATIC_EXPANSION_FACTOR = 8;

export class BeatmapPanel {
    constructor(parent, beatmap) {
        this._parent = parent;
        this._beatmap = beatmap;
        this.index = -1;
        this._expansion = 0;
        this._visible = false;
        this._animationTime = null;
        this._hideTime = null;

        this._width = GAME_STATE.screen.width * 0.45;
        this._height = (BeatmapPanel.getPercentFullPanelHeight() - BeatmapPanel.getPercentPanelMargin() * 2) * GAME_STATE.screen.height / 100;
        this._relTop = 0;
        this._element = null;
        this._overlayElement = null;

        this._beatmap.getBackgroundImageName();

        this.createElement();
    }

    createElement() {
        this._element = document.createElement("canvas");
        this._element.className = "diffpanel";
        this._element.setAttribute("width", this._width);
        this._element.setAttribute("height", this._height);
        this._element.onclick = this.onClick.bind(this);

        this._element.style.height = (BeatmapPanel.getPercentFullPanelHeight() - BeatmapPanel.getPercentPanelMargin() * 2)+"%";
        this._element.style.backgroundColor = "hsl(" + Math.max(-50, 200 - 32 * this._beatmap.stars) + ", 100%," + Math.max(0, Math.min(50, 200 - 20 * this._beatmap.stars)) + "%)";

        this._element.style.visibility = "hidden";

        this._ctx = this._element.getContext("2d");

        this._ctx.width = this._width;
        this._ctx.height = this._height;

        let grd = this._ctx.createLinearGradient(0, this._height, 0, -this._height);
        grd.addColorStop(0, "rgba(0,0,0,0.35)");
        grd.addColorStop(1, "rgba(0,0,0,0.05)");

        this._ctx.fillStyle = grd;
        this._ctx.fillRect(0, 0, this._width, this._height);

        this._ctx.fillStyle = "white";
        this._ctx.font = Math.round(GAME_STATE.screen.height / 1080 * 24)+"px Exo2LightItalic";
        this._ctx.fillText(this._beatmap.version, this._width * 0.04, this._height * 0.35);

        this._ctx.strokeStyle = "white";
        this._ctx.lineWidth = 2;
        for(let i = 0; i < Math.max(Math.ceil(this._beatmap.stars), 10); i++) {
            this._ctx.beginPath();
            this._ctx.arc(this._width * (0.055 + 0.04 * i), this._height * 0.7, this._width * 0.015, 0, Math.PI*2);
            this._ctx.stroke();
        }

        this._ctx.fillStyle = "white";
        for(let i = 0; i < Math.ceil(this._beatmap.stars); i++) {
            this._ctx.beginPath();
            this._ctx.arc(this._width * (0.055 + 0.04 * i), this._height * 0.7, (i + 1 === Math.ceil(this._beatmap.stars) ? this._beatmap.stars % 1 : 1) * this._width * 0.012, 0, Math.PI*2);
            this._ctx.fill();
        }

        this.updateElement();

        document.getElementById("songpanelswrapper").appendChild(this._element);
    }

    updateElement() {
        if(this._visible === false && window.performance.now() - this._hideTime > 150) {
            this._hideTime = null;
            this._element.style.visibility = "hidden";
        }

        let animationDiff = Math.min(1, (window.performance.now() - this._animationTime) / 150);

        this._relTop = this._visible ? (this.getPercentRelativePosition() * animationDiff) : this.getPercentRelativePosition() - (this.getPercentRelativePosition() * animationDiff);

        this._expansion = Math.pow(Math.abs((this._parent.getScroll() + (BeatmapSetPanel.getPercentFullPanelHeight() * (this._parent.getIndex() + 1) + BeatmapPanel.getPercentFullPanelHeight()) - 40 + (BeatmapPanel.getPercentFullPanelHeight() * this.index)) / 100), 1.05) * SCROLL_EXPANSION_FACTOR + STATIC_EXPANSION_FACTOR;

        this._element.style.top = this._parent._top+this._relTop+"%";
        this._element.style.right = "-"+(this._expansion)+"%";
    }

    destroyElement() {
        this._element.removeChild(this._overlayElement);
        document.getElementById("songpanelswrapper").removeChild(this._element);

        delete this._element;
        delete this._overlayElement;
    }

    hidePanel() {
        if(this._visible) {
            this._visible = false;

            this._animationTime = window.performance.now();
            this._hideTime = window.performance.now();
        }
    }

    showPanel() {
        if(!this._visible) {
            this._visible = true;

            this._animationTime = window.performance.now();
            this._element.style.visibility = "visible";
        }
    }

    onClick(evt) {
        SCENE_MANAGER.switchScene(new SceneGameOsu(this._beatmap, this._parent._entry));
    }

    getElement() {
        return this._element;
    }

    getPercentRelativePosition() {
        return BeatmapSetPanel.getPercentFullPanelHeight() - BeatmapPanel.getPercentPanelMargin() * 2 + this.index * BeatmapPanel.getPercentFullPanelHeight();
    }

    static getPanelHeight() {
        return BeatmapPanel.getPercentFullPanelHeight() * GAME_STATE.screen.height / 100;
    }

    static getPercentFullPanelHeight() {
        return 70/1080 * 100 + 2 * BeatmapPanel.getPercentPanelMargin();
    }

    static getPercentPanelMargin() {
        return 5/1080 * 100;
    }
}