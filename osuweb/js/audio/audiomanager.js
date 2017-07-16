"use strict";

import {FileUtil} from "../util/fileutil";
import {Audio} from "./audio";
import {Console} from "../console";

// Audio = music (not sounds)
export class AudioManager {
    constructor(song) {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        // The time the audio context was created
        this.audioTime = window.performance.now();

        this._paused = false;
        this._pauseTime = -1;

        this._soundLibrary = {};
        
        // All loaded songs that are available
        this._songLibrary = {};
        this._currentSongPlaying = false;
        // The audio that is ready for playback (or still shutting down)
        this._currentSong = song !== undefined ? song : null;
        this._currentSongLooping = false;
        this._currentSongStartTime = 0;

        // Whether the next audio should be looped when starting playback
        this._loopSong = false;
        // The audio that will be played after this one using a transition
        this._nextSong = null;
        this._nextSongOffset = 0;

        this._currentSounds = [];

        this._isLoading = false;
        this._loadingQueue = [];
    }

    // Loads an audio to the library and starts playback immediately
    loadSong(fileOrUrl, name, play = false, callback = null, isUrl = false) {
        if(this.isLoading) {
            this._loadingQueue.push({fileOrUrl: fileOrUrl, play: play, callback: callback, isUrl: isUrl});
            return;
        }

        Console.debug("Start loading song '"+name+"'...");

        this._isLoading = true;

        FileUtil.loadAudio(fileOrUrl, (audio) => {
            this._songLibrary[name] = audio;
        }, () => {
            if(callback !== null) callback();

            if(play) {
                this.playSongByName(name);
            }

            Console.debug("Loading song '"+name+"' complete!");

            if(this._loadingQueue.length > 0) {
                let req = this._loadingQueue.shift();
                this.loadSong(req.fileOrUrl, req.name, req.callback, req.isUrl);
            }
            else {
                this._isLoading = false;
            }
        }, isUrl, true);
    }

    loadNextSong(fileOrUrl, name, callback = null) {
        FileUtil.loadAudio(fileOrUrl, (audio) => {
            this._songLibrary[name] = audio;
            this._nextSong = audio;
        }, () => {
            if(callback !== null) callback();
        }, true);
    }

    playSongByName(name, delay = 0, offset = 0, loop = false) {
        if(this._songLibrary[name] !== null && this._songLibrary[name] !== undefined && this._songLibrary[name] !== this._currentSong) {
            this.stopSong();

            this._currentSong = this._songLibrary[name];
        }
        else if(this._songLibrary[name] === this._currentSong) {

        }
        else {
            this._currentSong = null;
            return;
        }

        this.playSong(delay, offset, loop);
    }

    playSong(delay = 0, offset = 0, loop = false) {
        if(this._currentSong === null) return;

        this._currentSong.updateVolume();
        this._currentSong.setOnEnded(this.onSongEnded);
        this._currentSong.play(delay === 0 ? 0 : (this.audioCtx.currentTime + delay), offset, !loop ? -1 : offset, !loop ? -1 : this._currentSong.duration);

        this._currentSongStartTime = this.audioCtx.currentTime + delay - offset;
        this._currentSongPlaying = true;
        this._currentSongLooping = loop;
        this._paused = false;
    }

    _playNextSong() {
        if(this._nextSong === null) return;

        this._currentSong = this._nextSong;

        this.playSong(0, this._nextSongOffset, this._loopSong);
    }

    stopSong(emptyAudio = false) {
        if(!this._currentSongPlaying || this._currentSong === null) return;

        this._currentSong.stop();

        if(emptyAudio) this._currentSong = null;
    }

    pauseSong() {
        if(this._paused || !this.isCurrentSongPlaying()) return;

        this._currentSongPlaying = false;
        this._pauseTime = this.getCurrentSongTime(false);
        this._paused = true;

        this._currentSong.stop();
    }
    
    unpauseSong() {
        if(!this._paused || this.isCurrentSongPlaying()) return;

        this.playSong(0, this._pauseTime, 0, this._currentSongLooping ? 0 : this._currentSong.duration);

        this._pauseTime = -1;
        this.paused = false;
    }

    setNextSong(name, offset = 0) {
        this._nextSong = this._songLibrary[name];
        this._nextSongOffset = offset;
    }

    isCurrentSongPlaying() {
        return this._currentSongPlaying && this._currentSong !== null;
    }

    getCurrentSongTime(inMS = true) {
        return this._currentSongStartTime === null ? 0 : (this.audioCtx.currentTime - this._currentSongStartTime) * (inMS ? 1000 : 1);
    }

    onSongEnded(name) {
        this._currentSongStartTime = null;
        this._currentSongPlaying = false;
        this._currentSongLooping = false;
    }

    getCurrentSong() {
        return this._currentSong;
    }

    loadSound(fileOrUrl, name, callback = null) {
        FileUtil.loadAudio(fileOrUrl, (audio) => {
            this._soundLibrary[name] = audio;
        }, () => {
            if(callback !== null) callback();
        }, false, true);
    }

    loadSoundArrayBuffer(buffer, name, buffercount = 5) {
        this._soundLibrary[name] = new Audio(buffer, null, buffercount, false);
    }

    playSound(name, volume = 1.0) {
        if(this._soundLibrary[name] === null || this._soundLibrary[name] === undefined) return;

        let sound = this._soundLibrary[name];

        this._currentSounds.push(sound);

        sound.updateVolume(volume);
        sound.play();
    }

    updateVolume() {
        this._currentSong.updateVolume();

        for(let key in this._currentSounds) this._currentSounds[key].updateVolume();
    }

    getContext() {
        return this.audioCtx;
    }
}
