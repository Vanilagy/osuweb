/**
 * This class represents a beatmapset panel in the song select and controls
 * it's positions and animations as well as input.
 */
"use strict";

import {GAME_STATE, SCENE_MANAGER, AUDIO_MANAGER} from "../../main";
import {BeatmapPanel} from "./beatmappanel";
import {FileUtil} from "../../util/fileutil";

const SCROLL_EXPANSION_FACTOR = 10;
const STATIC_EXPANSION_FACTOR = 15;

/**
 * @type {number}
 */
export let isDrawing = -1;

/**
 * @public
 */
export class BeatmapSetPanel {
    /**
     * @param {!number} index
     * @param {!BeatmapSetEntry} beatmapsetentry
     * @public
     */
    constructor(index, beatmapsetentry) {
        /**
         * @type {BeatmapSetEntry}
         * @private
         */
        this._entry = beatmapsetentry;

        /**
         * @type {string}
         * @private
         */
        this._audioKey = null;

        /**
         * @type {HTMLDivElement}
         * @private
         */
        this._underlayElement = null;
        /**
         * @type {HTMLCanvasElement}
         * @private
         */
        this._element = null;
        /**
         * @type {CanvasRenderingContext2D}
         * @private
         */
        this._ctx = null;

        /**
         * @type {number}
         * @private
         */
        this._index = index;
        /**
         * @type {BeatmapPanel[]}
         * @private
         */
        this._beatmapPanels = [];

        /**
         * @type {boolean}
         * @private
         */
        this._imageSet = false;
        /**
         * @type {string}
         * @private
         */
        this._dataUrl = null;

        /**
         * @type {number}
         * @private
         */
        this._expansion = 0;
        /**
         * @type {number}
         * @private
         */
        this._y = 0;
        /**
         * @type {number}
         * @private
         */
        this._width = GAME_STATE.screen.width * 0.53;
        /**
         * @type {number}
         * @private
         */
        this._height = BeatmapPanel.getPercentBodyHeight() * GAME_STATE.screen.height / 100;

        /**
         * @type {boolean}
         * @private
         */
        this._expanded = false;

        this.createElement();
    }

    loadBeatmapPanels() {
        for(let key in this._entry.beatmaps) {
            if(this._entry.beatmaps[key]) this._beatmapPanels.push(new BeatmapPanel(this, this._entry.beatmaps[key]));
        }

        this._beatmapPanels.sort((a,b) => {
            if(a.beatmap.stars === b.beatmap.stars) return 0;
            return a.beatmap.stars > b.beatmap.stars ? 1 : -1;
        });

        for(let i = 0; i < this._beatmapPanels.length; i++) {
            this._beatmapPanels[i].index = i;
            this._beatmapPanels[i].showPanel();
        }
    }

    /**
     * @param {!number|!string} index
     * @returns {BeatmapPanel}
     */
    getBeatmapPanel(index) {
        return this._beatmapPanels[index === "last" ? this._beatmapPanels.length - 1 : index];
    }

    /**
     * @returns {number}
     */
    getBeatmapCount() {
        return this._beatmapPanels.length;
    }

    createElement() {
        this._height = (BeatmapSetPanel.getPercentFullHeight() - BeatmapSetPanel.getPercentPanelMargin() * 2) * GAME_STATE.screen.height / 100;

        this._underlayElement = document.createElement("div");
        this._underlayElement.className = "songpanelbackground";
        this._underlayElement.style.display = "none";

        this._element = document.createElement("canvas");
        this._element.className = "songpanel";
        this._element.setAttribute("width", this._width);
        this._element.setAttribute("height", this._height);
        this._element.style.display = "none";
        this._element.onclick = this.onClick.bind(this);
        this._element.onmousedown = this.onMouseDown.bind(this);

        //this._element.innerHTML = "<div style='position: relative; left: 7%; top: 15%; pointer-events: none;'><span style='font-family: Exo2; font-size: 25px;'>"+this._entry.beatmaps[Object.keys(this._entry.beatmaps)[0]].title+"</span></div>";

        this.updateElement();

        document.getElementById("songpanelswrapper").appendChild(this._underlayElement);
        document.getElementById("songpanelswrapper").appendChild(this._element);
    }

    /**
     * @returns {boolean}
     */
    needsUpdate() {
        return this._imageSet !== "done";
    }

    updateElement() {
        this.renderBackground();

        this._expansion = Math.pow(Math.abs((this._y - 40) / 100), 1.05) * SCROLL_EXPANSION_FACTOR + STATIC_EXPANSION_FACTOR;

        this._underlayElement.style.top = this._y+"%";
        this._underlayElement.style.right = "-"+(this._expansion)+"%";
        this._element.style.top = this._y+"%";
        this._element.style.right = "-"+this._expansion+"%";

        for(let i = 0; i < this._beatmapPanels.length; i++) this._beatmapPanels[i].updateElement();
    }

    renderBackground() {
        if (!this._imageSet && isDrawing === -1) {
            isDrawing = this._index;

            this._ctx = this._element.getContext("2d");

            this._ctx.width = this._width;
            this._ctx.height = this._height;

            this._imageSet = "loading";

            let imageName = this._entry.getMainImageName();

            if (!imageName || imageName === "") {
                this._imageSet = "loaded";
                SCENE_MANAGER.getScene()._forceUpdate = true;
            }
            else {
                this._entry.getImageFileByName(imageName, (file) => {
                    if (file === null) {
                        this._imageSet = "loaded";
                        SCENE_MANAGER.getScene()._forceUpdate = true;
                        return;
                    }

                    FileUtil.loadFileAsDataUrl(file, (e) => {
                        this._dataUrl = e.target.result;
                        this._img = new Image();
                        this._img.onload = () => {
                            this._imageSet = "loaded";
                        };
                        this._img.src = e.target.result;
                        SCENE_MANAGER.getScene()._forceUpdate = true;
                    });
                });
            }
        }
        else if (this._imageSet === "loaded" && isDrawing === this._index) {
            let time = window.performance.now();

            if (this._img) this._ctx.drawImage(this._img, this._img.width / 2 - this._width / 2, this._img.height / 2 - this._height / 2, this._width, this._height, 0, 0, this._width, this._height);

            let grd = this._ctx.createLinearGradient(0, 0, this._width, this._height);
            grd.addColorStop(0, "rgba(0,0,0,0.5)");
            grd.addColorStop(1, "rgba(0,0,0,0)");

            this._ctx.fillStyle = grd;
            this._ctx.fillRect(0, 0, this._width, this._height);

            let beatmap = this._entry.beatmaps[Object.keys(this._entry.beatmaps)[0]];

            this._ctx.beginPath();
            this._ctx.fillStyle = "white";
            this._ctx.font = Math.round(GAME_STATE.screen.height / 1080 * 30)+"px Exo2MediumItalic";
            this._ctx.fillText(beatmap.title === "" ? beatmap.titleUnicode : beatmap.title, Math.round(this._width * 0.06), Math.round(this._height * 0.35));
            this._ctx.font = Math.round(GAME_STATE.screen.height / 1080 * 18)+"px Exo2LightItalic";
            this._ctx.fillText((beatmap.artist === "" ? beatmap.artistUnicode : beatmap.artist) + " | " + beatmap.creator, Math.round(this._width * 0.06), Math.round(this._height * 0.55));

            delete this._img;
            this._imageSet = "done";
            isDrawing = -1;

            console.log("Drawing panel took: "+(window.performance.now() - time));
        }
    }

    destroyElement() {
        document.getElementById("songpanelswrapper").removeChild(this._underlayElement);
        document.getElementById("songpanelswrapper").removeChild(this._element);

        delete this._underlayElement;
        delete this._element;

        for(let key in this._beatmapPanels[key]) this._beatmapPanels[key].destroyElement();
    }

    /**
     * @returns {number}
     */
    getIndex() {
        return this._index;
    }

    /**
     * @returns {BeatmapPanel[]}
     */
    getSubPanels() {
        return this._beatmapPanels;
    }

    hidePanel() {
        if(this._expanded) {
            this._underlayElement.style.display = "none";
            this._element.style.display = "none";
            this._expanded = false;
        }
    }

    showPanel() {
        if(!this._expanded) {
            this._underlayElement.style.display = "block";
            this._element.style.display = "block";
            this._expanded = true;
        }
    }

    /**
     * @returns {number}
     */
    getPercentExpandedHeight() {
        return BeatmapSetPanel.getPercentBodyHeight() + 2 * BeatmapPanel.getPercentPanelMargin() + BeatmapPanel.getPercentFullHeight() * this._beatmapPanels.length;
    }

    /**
     * @returns {number}
     */
    static getPanelHeight() {
        return BeatmapSetPanel.getPercentFullHeight() * GAME_STATE.screen.height / 100;
    }

    /**
     * @returns {number}
     */
    static getPercentFullHeight() {
        return BeatmapSetPanel.getPercentBodyHeight() + 2 * BeatmapSetPanel.getPercentPanelMargin();
    }

    /**
     * @returns {number}
     */
    static getPercentBodyHeight() {
        return 120/1080 * 100;
    }

    /**
     * @returns {number}
     */
    static getPercentPanelMargin() {
        return 10/1080 * 100;
    }

    expand(subPanel = "first") {
        this._element.style.transform = "translate(-8%, 0)";

        // Create and show panels
        if(this._beatmapPanels.length === 0) {
            this.loadBeatmapPanels();
        }
        else {
            for(let i = 0; i < this._beatmapPanels.length; i++) this._beatmapPanels[i].showPanel();
        }

        if(subPanel === "first") {
            SCENE_MANAGER.getScene().carousel.activeBeatmapPanel = this._beatmapPanels[0];
        }
        else if(subPanel === "last") {
            SCENE_MANAGER.getScene().carousel.activeBeatmapPanel = this._beatmapPanels[this._beatmapPanels.length - 1];
        }
        else {
            SCENE_MANAGER.getScene().carousel.activeBeatmapPanel = this._beatmapPanels[subPanel];
        }

        SCENE_MANAGER.getScene().elements["backgroundDiv"].style.backgroundImage = "url("+this._dataUrl+")";

        AUDIO_MANAGER.stopSong();

        if(this._audioKey === null) {
            this._audioKey = "";

            this._entry.loadSongFileByName(this._entry.beatmaps[Object.keys(this._entry.beatmaps)[0]].audioFilename, (audioKey) => {
                this._audioKey = audioKey;
                if(!GAME_STATE.currentPlay && SCENE_MANAGER.getScene().getActivePanel() === this) AUDIO_MANAGER.playSongByName(this._audioKey, 0, this._entry.beatmaps[Object.keys(this._entry.beatmaps)[0]].previewTime / 1000, true);
            });
        }
        else if (this._audioKey !== "") {
            if(!GAME_STATE.currentPlay && SCENE_MANAGER.getScene().getActivePanel() === this) AUDIO_MANAGER.playSongByName(this._audioKey, 0, this._entry.beatmaps[Object.keys(this._entry.beatmaps)[0]].previewTime / 1000, true);
        }
    }

    collapse() {
        this._element.style.transform = "";

        for(let i = 0; i < this._beatmapPanels.length; i++) this._beatmapPanels[i].hidePanel();
    }

    onClick(evt) {
        GAME_STATE.currentBeatmapSet = this._entry;

        SCENE_MANAGER.getScene().onPanelClick(this);
    }

    onMouseDown(evt) {
        SCENE_MANAGER.getScene().onPanelMouseDown(this);
    }

    get y() {
        return this._y;
    }
    set y(value) {
        this._y = value;
    }

    get entry() {
        return this._entry;
    }
}