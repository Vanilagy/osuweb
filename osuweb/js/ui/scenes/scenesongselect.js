"use strict";

import {GAME_STATE} from "../../main";
import {SceneBase} from "./scenebase";
import {BeatmapSetPanel} from "../interface/beatmapsetpanel";
import {BeatmapPanelCarousel} from "../interface/beatmappanelcarousel";

const ACCELERATION = 20;

/**
 * @public
 */
export class SceneSongSelect extends SceneBase {
    /**
     * @public
     */
    constructor() {
        super();

        /**
         * @type {BeatmapPanelCarousel}
         * @private
         */
        this._carousel = null;
        /**
         * @type {number}
         * @private
         */
        this._nextIndex = 0;

        /**
         * @type {number}
         * @private
         */
        this._lastDragDistance = 0;
        /**
         * @type {boolean}
         * @private
         */
        this._disableDragging = false;

        /**
         * @type {BeatmapSetPanel[]}
         * @private
         */
        this._panels = [];

        this.addElement("songpanelsDiv", "songpanels");

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

    /**
     * @param {!number}frameModifier
     */
    render(frameModifier) {
        this._carousel.update();
    }

    /**
     * @param {!BeatmapSetPanel} panel
     */
    onPanelMouseDown(panel) {
        this._lastDragDistance = 0;
    }

    /**
     * @param {!BeatmapSetPanel} panel
     */
    onPanelClick(panel) {
        if(this._lastDragDistance < 5 && this._carousel.activeBeatmapSetPanel !== panel) {
            this.setActivePanel(panel);
        }
    }

    /**
     * @param {!KeyboardEvent} event
     */
    onKeyDown(event) {
        if(event.keyCode === 37 && this._carousel.activeBeatmapSetPanel) {
            this._carousel.previousSet();
        }
        else if(event.keyCode === 39 && this._carousel.activeBeatmapSetPanel) {
            this._carousel.nextSet();
        }
        else if(event.keyCode === 38 && this._carousel.activeBeatmapSetPanel) {
            if(this._carousel.activeBeatmapPanel.index === 0) {
                this.previousSet("last");
            }
            else {
                this._carousel.selectMap(this._carousel.activeBeatmapSetPanel.getBeatmapPanel(this._carousel.activeBeatmapPanel.index - 1));
            }
        }
        else if(event.keyCode === 40 && this._carousel.activeBeatmapSetPanel) {
            if(this._carousel.activeBeatmapPanel.index + 1 >= this._carousel.activeBeatmapSetPanel.getBeatmapCount()) {
                this.nextSet();
            }
            else {
                this._carousel.selectMap(this._carousel.activeBeatmapSetPanel.getBeatmapPanel(this._carousel.activeBeatmapPanel.index + 1));
            }
        }
        else if(event.keyCode === 13 && this._carousel.activeBeatmapSetPanel) {
            this._carousel.activeBeatmapPanel.onClick(null);
        }
    }

    /**
     * @param {!number} value
     */
    scroll(value) {
        this._carousel.move(-value * ACCELERATION);
    }

    initializePanels() {
        this._panels = [];

        for(let key in GAME_STATE.database.beatmapSetEntrys) {
            this._panels.push(new BeatmapSetPanel(this._nextIndex++, GAME_STATE.database.beatmapSetEntrys[key]));
        }

        this._carousel = new BeatmapPanelCarousel(this._panels);
        this._carousel.calculateYPos();
    }

    /**
     * @param {BeatmapSetPanel} panel
     * @param {number} subPanel
     */
    setActivePanel(panel, subPanel = 0) {
        this._carousel.selectSet(panel, subPanel)
    }

    /**
     * @returns {BeatmapSetPanel}
     */
    getActivePanel() {
        return this._carousel.activeBeatmapSetPanel;
    }

    /**
     * @inheritDoc
     */
    preOpen(oldScene, callback) {
        callback(true);
    }

    /**
     * @inheritDoc
     */
    postOpen(oldScene, callback) {
        callback(true);

        this.elements["songpanelsDiv"].style.display = "block";

        this.elements["backgroundDiv"].style.filter = "blur(5px)";
        this.elements["backgroundDiv"].style.webkitFilter = "blur(5px)";

        this.initializePanels();
    }

    /**
     * @inheritDoc
     */
    preClose(newScene, callback) {
        this.elements["songpanelsDiv"].style.display = "none";

        this.elements["backgroundDiv"].style.filter = "blur(0px)";
        this.elements["backgroundDiv"].style.webkitFilter = "blur(0px)";

        for(let key in this._panels) this._panels[key].destroyElement();

        callback(true);
    }

    /**
     * @inheritDoc
     */
    postClose(newScene, callback) {
        callback(true);
    }
    get carousel() {
        return this._carousel;
    }
}