"use strict";

import {SceneGame} from "./scenegame";
import {Play} from "../play";
import {GAME_STATE} from "../../main";
import {Console} from "../../console";

export class SceneGameOsu extends SceneGame {
    constructor(beatmap, beatmapset) {
        super();

        this._beatmap = beatmap || GAME_STATE.currentBeatmap;
        this._beatmapset = beatmapset || GAME_STATE.currentBeatmapSet;

        GAME_STATE.currentBeatmap = beatmap;
        GAME_STATE.currentBeatmapSet = beatmapset;

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
        this.addElement("snakingDiv", "snakingOption");
        this.addElement("autoDiv", "autoOption");
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
            "scoreDisplayP", "accuracyDisplayP", "comboDisplayP", "accContainerDiv", "accWrapperDiv", "snakingDiv"]);

        this._beatmapset.getAudioFileByName(this._beatmap.audioFilename, (audioFile) => {
            if(audioFile.key !== undefined) {
                new Play(this._beatmap, audioFile.key);

                GAME_STATE.currentPlay.updatePlayareaSize(() => GAME_STATE.currentPlay.start());
            }
            else if(audioFile !== null) {
                GAME_STATE.currentBeatmapSet.loadSongFileByName(this._beatmap.audioFilename, (key) => {
                    new Play(this._beatmap, key);

                    GAME_STATE.currentPlay.updatePlayareaSize(() => GAME_STATE.currentPlay.start());
                });
            }
            else {
                Console.error("No soundfile could be found!");
            }
        });

        callback(true);
    }

    preClose(newScene, callback) {
        callback(true);
    }

    postClose(newScene, callback) {
        callback(true);
    }
}