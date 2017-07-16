"use strict";

import {
    TransformationObjectFieldRelative, TransformationObjectMethodRelative
} from "../scenes/transformation";
import {BeatmapSetPanel} from "./beatmapsetpanel";

const ANIMATION_TIME = 150;

export class BeatmapPanelCarousel {
    /**
     * @param {BeatmapSetPanel[]} [initialList]
     */
    constructor(initialList = []) {
        /**
         * @type {BeatmapSetPanel[]}
         */
        this.beatmapSetPanelList = initialList;

        for(let key in this.beatmapSetPanelList) this.beatmapSetPanelList[key].showPanel();

        this.targetTransformation = null;
        this.targetOffset = 0;
    }

    update() {
        for(let key in this.beatmapSetPanelList) this.beatmapSetPanelList[key].updateElement();
    }

    move(value) {
        if(this.targetTransformation) this.targetTransformation.cancel();
        this.targetOffset += value;
        this.targetTransformation = new TransformationObjectMethodRelative(this, "doMove", this.targetOffset, Math.pow(Math.abs(this.targetOffset) / 50, 0.5) * 500, "easeOutCubic")
            .setEndListener((result) => {
                if(result) {
                    this.targetOffset = 0;
                    this.targetTransformation = null;
                }
            })
            .submit();
    }

    doMove(delta) {
        for(let key in this.beatmapSetPanelList) {
            this.beatmapSetPanelList[key].y = this.beatmapSetPanelList[key].y + delta;
        }

        this.targetOffset -= delta;
    }

    prependSet(beatmapPanelSet) {
        this.beatmapSetPanelList.unshift(beatmapPanelSet);

        this.beatmapSetPanelList[0].y = this.beatmapSetPanelList[1].y - BeatmapSetPanel.getPercentFullHeight();
    }

    appendSet(beatmapPanelSet) {
        this.beatmapSetPanelList.push(beatmapPanelSet);

        this.beatmapSetPanelList[this.beatmapSetPanelList.length - 1].y = this.beatmapSetPanelList[this.beatmapSetPanelList -2].y +
            (this.beatmapSetPanelList[this.beatmapSetPanelList - 2] === this._activeBeatmapSetPanel ? this.beatmapSetPanelList[i].getPercentExpandedHeight() : BeatmapSetPanel.getPercentFullHeight());
    }

    selectSet(beatmapSetPanel, subPanel = 0, animated = true) {
        if(this._activeBeatmapSetPanel) this._activeBeatmapSetPanel.collapse();

        this._activeBeatmapSetPanel = beatmapSetPanel;
        this._activeBeatmapPanel = beatmapSetPanel.getBeatmapPanel(subPanel);

        this._activeBeatmapSetPanel.expand();

        this.calculateYPos(animated);
    }

    selectMap(beatmapPanel, animated = true) {
        this._activeBeatmapSetPanel = beatmapPanel.getParent();
        this._activeBeatmapPanel = beatmapPanel;

        this.calculateYPos(animated);
    }

    /**
     * @param {!number|!string} subPanel
     */
    nextSet(subPanel = 0) {
        let currentIndex = this.getBeatmapSetIndex(this.activeBeatmapSetPanel);

        if(currentIndex) {
            this.selectSet(this.beatmapSetPanelList[currentIndex + 1])
        }
    }

    /**
     * @param {!number|!string} subPanel
     */
    previousSet(subPanel = 0) {
        let currentIndex = this.getBeatmapSetIndex(this.activeBeatmapSetPanel);

        if(currentIndex) {
            this.selectSet(this.beatmapSetPanelList[currentIndex - 1])
        }
    }

    getBeatmapSetIndex(beatmapSetPanel) {
        for(let key in this.beatmapSetPanelList.length) {
            if(this.beatmapSetPanelList[key] === this.activeBeatmapSetPanel) return key;
        }
    }

    calculateYPos(animated = true) {
        if(!this.beatmapSetPanelList[0]) return;

        let currentY = this.beatmapSetPanelList[0].y;

        for(let key in this.beatmapSetPanelList) {
            if(animated) {
                new TransformationObjectFieldRelative(this.beatmapSetPanelList[key], "y", currentY - this.beatmapSetPanelList[key].y, ANIMATION_TIME, "easeOutQuint").submit();
            }
            else {
                this.beatmapSetPanelList[key].y = currentY;
            }

            //console.log(currentY);

            currentY += this.beatmapSetPanelList[key] === this._activeBeatmapSetPanel ? this.beatmapSetPanelList[key].getPercentExpandedHeight() : BeatmapSetPanel.getPercentFullHeight();
        }
    }

    get activeBeatmapPanel() {
        return this._activeBeatmapPanel;
    }

    set activeBeatmapPanel(value) {
        if(this._activeBeatmapPanel) this._activeBeatmapPanel.setActive(false);
        this._activeBeatmapPanel = value;
        this._activeBeatmapPanel.setActive(true);
    }

    get activeBeatmapSetPanel() {
        return this._activeBeatmapSetPanel;
    }
    set activeBeatmapSetPanel(value) {
        this._activeBeatmapSetPanel = value;
    }
}