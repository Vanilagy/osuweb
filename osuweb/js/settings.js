"use strict";

import {VolumeControl} from "./interface/volumecontrol";
import {AUDIO_MANAGER, GAME_STATE} from "./main";

export class Settings {
    constructor() {
        this.loadSettings();
    }

    loadSettings() {
        this.data = JSON.parse(localStorage.getItem("settings")) || {
            music: 0.8,
            sound: 0.8,
            master: 0.8,
            keyCodeBindings: {
                "k1": 83, // S
                "k2": 68  // D
            }
        }
    }

    saveSettings() {
        localStorage.setItem("settings", JSON.stringify(this.data));
    }

    setMaster(value) {
        this.data.master = value;

        AUDIO_MANAGER.updateVolume();

        if(this.data.master > 1.0) this.data.master = 1.0;
        if(this.data.master < 0.0) this.data.master = 0.0;

        this.saveSettings();
    }

    changeMaster(value) {
        if(GAME_STATE.controls.volumeControl === null) {
            GAME_STATE.controls.volumeControl = new VolumeControl();
            GAME_STATE.controls.volumeControl.startRender();
        }

        GAME_STATE.controls.volumeControl.animateMaster(value);
    }
}