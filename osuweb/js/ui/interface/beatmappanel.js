"use strict";

import {GAME_STATE, SCENE_MANAGER} from "../../main";
import {BeatmapSetPanel} from "./beatmapsetpanel";
import {SceneGameOsu} from "../scenes/scenegameosu";
import {TransformationObjectFieldTimeout, TransformationObjectField} from "../scenes/transformation";

const SCROLL_EXPANSION_FACTOR = 10;
const STATIC_EXPANSION_FACTOR = 8;

export class BeatmapPanel {
    /**
     * @param {BeatmapSetPanel} parent
     * @param {Beatmap} beatmap
     */
    constructor(parent, beatmap) {
        /**
         *
         * @type {BeatmapSetPanel}
         * @private
         */
        this._parent = parent;
        /**
         * @type {Beatmap}
         * @private
         */
        this._beatmap = beatmap;
        this._index = -1;
        this._expansion = 0;
        this._expanded = false;
        this._visible = false;

        this._expansionTransformation = null;
        this._hideTransformation = null;

        /**
         * @type {number}
         * @private
         */
        this._width = GAME_STATE.screen.width * 0.45;
        /**
         * @type {number}
         * @private
         */
        this._height = BeatmapPanel.getPercentBodyHeight() * GAME_STATE.screen.height / 100;
        this._relTop = 0;

        this._element = null;
        this._underlayElement = null;

        this._beatmap.getBackgroundImageName();

        this.createElement();
    }

    createElement() {
        this._underlayElement = document.createElement("div");
        this._underlayElement.className = "diffpanelbackground";
        this._underlayElement.style.width = this._width * 1.2;
        this._underlayElement.style.height = BeatmapPanel.getPercentBodyHeight()+"%";

        this._underlayElement.style.background = "linear-gradient(to left, hsl(" + Math.max(-50, 200 - 32 * this._beatmap.stars) + ", 100%," + Math.max(0, Math.min(50, 200 - 20 * this._beatmap.stars)) + "%) 80%, hsla(" + Math.max(-50, 200 - 32 * this._beatmap.stars) + ", 100%," + Math.max(0, Math.min(50, 200 - 20 * this._beatmap.stars)) + "%, 0) 100%)";
        this._underlayElement.style.visibility = "hidden";

        this._element = document.createElement("canvas");
        this._element.className = "diffpanel";
        this._element.setAttribute("width", this._width);
        this._element.setAttribute("height", this._height);
        this._element.onclick = this.onClick.bind(this);

        this._element.style.height = BeatmapPanel.getPercentBodyHeight()+"%";
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

        document.getElementById("songpanelswrapper").appendChild(this._underlayElement);
        document.getElementById("songpanelswrapper").appendChild(this._element);
    }

    updateElement() {
        let animationDiff = Math.min(1, (window.performance.now() - this._animationTime) / 150);

        this._expansion = Math.pow(Math.abs((this._parent.y + this._relTop - 40) / 100), 1.05) * SCROLL_EXPANSION_FACTOR + STATIC_EXPANSION_FACTOR;
        //this._expansion = Math.pow(Math.abs((this.parent.getScroll() + (BeatmapSetPanel.getPercentFullHeight() * (this.parent.getIndex() + 1) + BeatmapPanel.getPercentFullHeight()) - 40 + (BeatmapPanel.getPercentFullHeight() * this.index)) / 100), 1.05) * SCROLL_EXPANSION_FACTOR + STATIC_EXPANSION_FACTOR;

        this._underlayElement.style.top = this._parent.y+this._relTop+"%";
        this._underlayElement.style.right = "-"+(this._expansion)+"%";
        this._element.style.top = this._parent.y+this._relTop+"%";
        this._element.style.right = "-"+(this._expansion)+"%";
    }

    getParent() {
        return this._parent;
    }

    setActive(bool) {
        this._underlayElement.style.visibility = bool ? "visible" : "hidden";
    }

    destroyElement() {
        document.getElementById("songpanelswrapper").removeChild(this._underlayElement);
        document.getElementById("songpanelswrapper").removeChild(this._element);

        delete this._element;
        delete this._underlayElement;
    }

    hidePanel() {
        if(this._expanded) {
            this._expanded = false;

            if(this._expansionTransformation) this._expansionTransformation.cancel();
            if(this._hideTransformation) this._hideTransformation.cancel();

            this._expansionTransformation = new TransformationObjectField(this, "_relTop", null, 0, 150, "easeOutQuint").submit();
            this._hideTransformation = new TransformationObjectFieldTimeout(this, "_visible", false, 150)
                .setEndListener((result) => {
                    if(result) {
                        this._underlayElement.style.visibility = "hidden";
                        this._element.style.visibility = "hidden";
                    }
                })
                .submit();
        }
    }

    showPanel() {
        if(!this._expanded) {
            this._expanded = true;
            this._visible = true;

            if(this._expansionTransformation) this._expansionTransformation.cancel();
            if(this._hideTransformation) this._hideTransformation.cancel();

            this._expansionTransformation = new TransformationObjectField(this, "_relTop", null, this.getPercentRelativePosition(), 150, "easeOutQuint").submit();

            this._element.style.visibility = "visible";
        }
    }

    onClick(evt) {
        if(SCENE_MANAGER.getScene().carousel.activeBeatmapPanel === this) {
            SCENE_MANAGER.switchScene(new SceneGameOsu(this._beatmap, this._parent.entry));
        }
        else {
            SCENE_MANAGER.getScene().carousel.activeBeatmapPanel = this;
        }
    }

    getElement() {
        return this._element;
    }

    getPercentRelativePosition() {
        return BeatmapSetPanel.getPercentFullHeight() - BeatmapSetPanel.getPercentPanelMargin() + this._index * BeatmapPanel.getPercentFullHeight();
    }

    static getPanelHeight() {
        return BeatmapPanel.getPercentFullHeight() * GAME_STATE.screen.height / 100;
    }

    static getPercentFullHeight() {
        return BeatmapPanel.getPercentBodyHeight() + 2 * BeatmapPanel.getPercentPanelMargin();
    }

    static getPercentBodyHeight() {
        return 70/1080 * 100;
    }

    static getPercentPanelMargin() {
        return 5/1080 * 100;
    }

    get beatmap() {
        return this._beatmap;
    }

    get index() {
        return this._index;
    }
    set index(value) {
        this._index = value;
    }
}