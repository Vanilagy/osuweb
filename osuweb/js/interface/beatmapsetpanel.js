/**
 * This class represents a beatmapset panel in the song select and controls
 * it's positions and animations as well as input.
 */
"use strict";

import {GAME_STATE, SCENE_MANAGER, AUDIO_MANAGER} from "../main";
import {BeatmapPanel} from "./beatmappanel";
import {FileUtil} from "../util/fileutil";

const SCROLL_EXPANSION_FACTOR = 10;
const STATIC_EXPANSION_FACTOR = 15;

export let isDrawing = -1;

export class BeatmapSetPanel {
    constructor(index, beatmapsetentry) {
        this._entry = beatmapsetentry;
        this._expansion = 0;

        this.active = false;

        this._audioName = null;

        this._underlayElement = null;
        this._element = null;
        this._ctx = null;
        this._textElement = null;

        this._index = index;
        this._scroll = 0;
        this._expansion = 100;
        this._subPanels = [];

        this._imageSet = false;
        this._audioSet = false;
        this._dataUrl = null;

        this._x = 0;
        this._y = 0;
        this._width = GAME_STATE.screen.width * 0.53;
        this._height = 0;

        this._visible = false;

        this.createElement();
    }

    setScroll(scroll) {
        this._scroll = scroll;
    }

    createElement() {
        this._height = (BeatmapSetPanel.getPercentFullPanelHeight() - BeatmapSetPanel.getPercentPanelMargin() * 2) * GAME_STATE.screen.height / 100;

        this._underlayElement = document.createElement("div");
        this._underlayElement.className = "songpanelbackground";
        this._underlayElement.setAttribute("width", this._width);
        this._underlayElement.setAttribute("height", this._height);
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

    needsUpdate() {
        return this._imageSet !== "done";
    }

    updateElement() {
        if(!this._imageSet && isDrawing === -1) {
            isDrawing = this._index;

            this._ctx = this._element.getContext("2d");

            this._ctx.width = this._width;
            this._ctx.height = this._height;

            this._imageSet = "loading";

            let imageName = this._entry.getMainImageName();

            if(!imageName || imageName === "") {
                this._imageSet = "loaded";
                SCENE_MANAGER.getScene()._forceUpdate = true;
            }
            else {
                this._entry.getImageFileByName(imageName, (file) => {
                    if(file === null) {
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
        else if(this._imageSet === "loaded" && isDrawing === this._index) {
            if(this._img) this._ctx.drawImage(this._img, this._img.width / 2 - this._width / 2, this._img.height / 2 - this._height / 2, this._width, this._height, 0, 0, this._width, this._height);

            let grd = this._ctx.createLinearGradient(0, 0, this._width, this._height);
            grd.addColorStop(0, "rgba(0,0,0,0.5)");
            grd.addColorStop(1, "rgba(0,0,0,0)");

            this._ctx.fillStyle = grd;
            this._ctx.fillRect(0, 0, this._width, this._height);

            let beatmap = this._entry.beatmaps[Object.keys(this._entry.beatmaps)[0]];

            this._ctx.beginPath();
            this._ctx.fillStyle = "white";
            this._ctx.font = "30px Exo2MediumItalic";
            this._ctx.fillText(beatmap.title === "" ? beatmap.titleUnicode : beatmap.title, Math.round(this._width * 0.06), Math.round(this._height * 0.35));
            this._ctx.font = "18px Exo2LightItalic";
            this._ctx.fillText((beatmap.artist === "" ? beatmap.artistUnicode : beatmap.artist) + " | " + beatmap.creator, Math.round(this._width * 0.06), Math.round(this._height * 0.55));

            delete this._img;
            this._imageSet = "done";
            isDrawing = -1;
        }

        this._expansion = Math.pow(Math.abs((this._scroll + (BeatmapSetPanel.getPercentFullPanelHeight() * this._index + BeatmapPanel.getPercentFullPanelHeight()) - 40) / 100), 1.05) * SCROLL_EXPANSION_FACTOR + STATIC_EXPANSION_FACTOR;

        this._left = this._expansion;
        this._top = this._scroll + (BeatmapSetPanel.getPercentFullPanelHeight() * this._index);
        this._x = this._left * GAME_STATE.screen.width / 100;
        this._y = this._top * GAME_STATE.screen.height / 100;

        this._underlayElement.style.top = this._top+"%";
        this._underlayElement.style.right = "-"+(this._left)+"%";
        this._element.style.top = this._top+"%";
        this._element.style.right = "-"+this._left+"%";

        for(let i = 0; i < this._subPanels.length; i++) this._subPanels[i].updateElement();
    }

    destroyElement() {
        document.getElementById("songpanelswrapper").removeChild(this._underlayElement);
        document.getElementById("songpanelswrapper").removeChild(this._element);

        delete this._underlayElement;
        delete this._element;

        for(let key in this._subPanels[key]) this._subPanels[key].destroyElement();
    }

    getCenterY() {
        return this._scroll * GAME_STATE.screen.height / 100 + BeatmapSetPanel.getPanelHeight() * this._index + BeatmapSetPanel.getPanelHeight() / 2;
    }

    getIndex() {
        return this._index;
    }

    getScroll() {
        return this._scroll;
    }

    getSubPanels() {
        return this._subPanels;
    }

    hidePanel() {
        if(this._visible) {
            this._underlayElement.style.display = "none";
            this._element.style.display = "none";
            this._visible = false;
        }
    }

    showPanel() {
        if(!this._visible) {
            this._underlayElement.style.display = "block";
            this._element.style.display = "block";
            this._visible = true;
        }
    }

    static getPanelHeight() {
        return BeatmapSetPanel.getPercentFullPanelHeight() * GAME_STATE.screen.height / 100;
    }

    static getPercentFullPanelHeight() {
        return 120/1080 * 100 + 2 * BeatmapSetPanel.getPercentPanelMargin();
    }

    static getPercentPanelMargin() {
        return 10/1080 * 100;
    }

    expand() {
        if(this._subPanels.length === 0) {
            let index = 0;

            for(let key in this._entry.beatmaps) {
                this._subPanels[index++] = new BeatmapPanel(this, this._entry.beatmaps[key]);
            }

            this._subPanels.sort((a, b) => {
                if(a._stars === b._stars) return 0;
                return a._stars > b._stars ? 1 : 0;
            })

            for(let i = 0; i < this._subPanels.length; i++) {
                this._subPanels[i]._index = i;
                this._subPanels[i].showPanel();
            }
        }
        else {
            for(let i = 0; i < this._subPanels.length; i++) this._subPanels[i].showPanel();
        }

        SCENE_MANAGER.getScene().elements["backgroundDiv"].style.backgroundImage = "url("+this._dataUrl+")";

        AUDIO_MANAGER.stopSong();

        if(this._audioName === null) {
            this._audioName = "";

            this._entry.loadSongFileByName(this._entry.beatmaps[Object.keys(this._entry.beatmaps)[0]].audioFilename, (audioKey) => {
                this._audioName = audioKey;
                if(!GAME_STATE.currentPlay && SCENE_MANAGER.getScene().getActivePanel() === this) AUDIO_MANAGER.playSongByName(this._audioName, 0, this._entry.beatmaps[Object.keys(this._entry.beatmaps)[0]].previewTime / 1000, true);
            });
        }
        else if (this._audioName !== "") {
            if(!GAME_STATE.currentPlay && SCENE_MANAGER.getScene().getActivePanel() === this) AUDIO_MANAGER.playSongByName(this._audioName, 0, this._entry.beatmaps[Object.keys(this._entry.beatmaps)[0]].previewTime / 1000, true);
        }
    }

    collapse() {
        for(let i = 0; i < this._subPanels.length; i++) this._subPanels[i].hidePanel();
    }

    onHover() {

    }

    onClick(evt) {
        GAME_STATE.currentBeatmapSet = this._entry;

        SCENE_MANAGER.getScene().onPanelClick(this);
    }

    onMouseDown(evt) {
        SCENE_MANAGER.getScene().onPanelMouseDown(this);
    }
}