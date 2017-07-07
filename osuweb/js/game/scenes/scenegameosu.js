"use strict";

import {SceneGame} from "./scenegame";

export class SceneGameOsu extends SceneGame {
    constructor() {
        super();

        this.addElement("playareaDiv", "playarea");
        this.addElement("objectContainerDiv", "objectContainer");
        this.addElement("progressCanvas", "progress");
        this.addElement("spinnerContainerContainer", "spinnerContainerContainer");
        this.addElement("ingameContainerSection", "ingameContainer");

        // Accmeter (bottom-middle)
        this.addElement("accarrowImg", "accarrow");
        this.addElement("accmeterDiv", "accmeter");
        this.addElement("accstrip50Div", "accstrip-50");
        this.addElement("accstrip100Div", "accstrip-100");
        this.addElement("accstrip300Div", "accstrip-300");
        this.addElement("acctickXDiv", "acctick-X");

        // Score display (top-right)
        this.addElement("scoreDisplayP", "scoreDisplay");
        this.addElement("accuracyDisplayP", "accuracyDisplay");
        this.addElement("comboDisplayP", "comboDisplay");
        this.addElement("accContainerDiv", "accContainer");
        this.addElement("accWrapperDiv", "accWrapper");

        this.addElement("snakingInput", "snaking");
        this.addElement("autoInput", "auto");
    }

    render() {
        return super.render();
    }

    preOpen(oldScene, callback) {
        callback(true);
    }

    postOpen(oldScene, callback) {
        this.elements["snakingInput"].disabled = true;

        this.showElements([
            "playareaDiv", "objectContainerDiv", "progressCanvas", "spinnerContainerContainer", "ingameContainerSection",
            "accarrowImg", "accmeterDiv", "accstrip50Div", "accstrip100Div", "accstrip300Div", "acctickXDiv",
            "scoreDisplayP", "accuracyDisplayP", "comboDisplayP", "accContainerDiv", "accWrapperDiv", "snakingInput", "autoInput"]);

        callback(true);
    }

    preClose(newScene, callback) {
        callback(true);
    }

    postClose(newScene, callback) {
        callback(true);
    }
}