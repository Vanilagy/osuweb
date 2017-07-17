"use strict";

import {VolumeControl} from "./ui/interface/volumecontrol";
import {AUDIO_MANAGER, GAME_STATE} from "./main";

export class Settings {
    constructor() {
        this.loadSettings();
    }

    loadSettings() {
        this._data = JSON.parse(localStorage.getItem("settings"));

        this.validateSettings();
    }

    validateSettings() {
        if(!this._data) this._data = {};

        if(!this._data.music) this._data.music = this.music;
        if(!this._data.sound) this._data.sound = this.sound;
        if(!this._data.master) this._data.master = this.master;
        if(!this._data.sensitivity) this._data.sensitivity = this.sensitivity;
        if(!this._data.keyBindings) this._data.keyBindings = {
            "k1": 83, // S
            "k2": 68,  // D
            "pointerLock": 32 // Space
        };
    }

    get music() {
        return this._data.music >= 0 ? this._data.music : 0.8;
    }

    get sound() {
        return this._data.sound >= 0 ? this._data.sound : 0.8;
    }

    get master() {
        return this._data.master >= 0 ? this._data.master : 0.8;
    }

    set master(value) {
        this._data.master = value;

        if(this._data.master > 1.0) this._data.master = 1.0;
        if(this._data.master < 0.0) this._data.master = 0.0;

        AUDIO_MANAGER.updateVolume();

        this.saveSettings();
    }

    get sensitivity() {
        return this._data.sensitivity || 1.0;
    }

    set sensitivity(value) {
        this._data.sensitivity = value;
    }

    get keyBindings() {
        return this._data.keyBindings;
    }

    saveSettings() {
        localStorage.setItem("settings", JSON.stringify(this._data));
    }

    changeMaster(value) {
        if(GAME_STATE.controls.volumeControl === null) {
            GAME_STATE.controls.volumeControl = new VolumeControl();
        }

        GAME_STATE.controls.volumeControl.animateMaster(value);
    }
}