"use strict";

import {GAME_STATE, ZIP, AUDIO_MANAGER} from "../main";
import {FileUtil} from "../util/fileutil";
import {Beatmap} from "./beatmap";

export class BeatmapSet {
    constructor(files, callback) {
        this.files = files[0].name.endsWith(".osz") ? files[0] : files;
        this.audioFiles = [];
        this.imageFiles = [];
        this.difficulties = {};
        this.osz = false;

        if (Object.prototype.toString.call(this.files) === '[object File]') {
            this.osz = true;

            ZIP.loadAsync(this.files).then((function (zip) {
                this.files = zip.files;

                for (let key in zip.files) {
                    if (key.endsWith(".mp3") || key.endsWith(".wav") || key.endsWith(".ogg")) {
                        this.audioFiles.push(key);
                        continue;
                    }
                    if (key.endsWith(".jpg") || key.endsWith(".jpeg") || key.endsWith(".png") || key.endsWith(".gif")) {
                        this.imageFiles.push(key);
                        continue;
                    }

                    let regex = /\[([^\[^\]]+)]\.osu$/g;
                    let str = key;
                    let m;

                    while ((m = regex.exec(str)) !== null) {
                        // This is necessary to avoid infinite loops with zero-width matches
                        if (m.index === regex.lastIndex) {
                            regex.lastIndex++;
                        }

                        // The result can be accessed through the `m`-variable.
                        m.forEach((function (match, groupIndex) {
                            if (groupIndex === 1) {
                                this.difficulties[match] = key;
                            }
                        }).bind(this));
                    }
                }

                if (callback !== undefined) callback(this);
            }).bind(this));
        }
        else {
            for (let i = 0; i < this.files.length; i++) {
                let filename = this.files[i].name.toLowerCase();

                if (filename.endsWith(".mp3") || filename.endsWith(".wav") || filename.endsWith(".ogg")) {
                    this.audioFiles.push(this.files[i]);
                    continue;
                }
                if (filename.endsWith(".jpg") || filename.endsWith(".jpeg") || filename.endsWith(".png") || filename.endsWith(".gif")) {
                    this.imageFiles.push(this.files[i]);
                    continue;
                }

                let regex = /\[([^\[^\]]+)]\.osu$/g;
                let str = this.files[i].webkitRelativePath;
                let m;

                while ((m = regex.exec(str)) !== null) {
                    // This is necessary to avoid infinite loops with zero-width matches
                    if (m.index === regex.lastIndex) {
                        regex.lastIndex++;
                    }

                    // The result can be accessed through the `m`-variable.
                    m.forEach((function (match, groupIndex) {
                        if (groupIndex === 1) {
                            this.difficulties[match] = this.files[i];
                        }
                    }).bind(this));
                }
            }
            if (callback !== undefined) callback(this);
        }
    }

    loadDifficulty(difficultyFile, audioCallback) {
         new Beatmap(difficultyFile, (beatmap) => {
             GAME_STATE.currentBeatmap = beatmap;

             // find background image if it exists
             let imageFile = null;

             for (let i = 0; i < GAME_STATE.currentBeatmap.events.length; i++) {
                 if (GAME_STATE.currentBeatmap.events[i].type === "image") {
                     let imageFileName = GAME_STATE.currentBeatmap.events[i].file;

                     for (let j = 0; j < this.imageFiles.length; j++) {
                         let imageName = typeof this.imageFiles[j] === "string" ? this.imageFiles[j] : this.imageFiles[j].name;

                         if (imageName === imageFileName) {
                             imageFile = this.imageFiles[j];
                             break;
                         }
                     }

                     break;
                 }
             }

             if (imageFile !== null) {
                 if (this.osz) {
                     ZIP.file(imageFile).async("base64").then((function (result) {
                         document.getElementById("background").style.backgroundImage = 'url(data:image/png;base64,' + result + ')';
                     }));
                 }
                 else {
                     FileUtil.loadFileAsDataUrl(imageFile, function (e) {
                         document.getElementById("background").style.backgroundImage = 'url(' + e.target.result + ')';
                     });
                 }
             }

             // find audio file
             beatmap.audioFile = null;
             beatmap.audioName = "";

             for (let i = 0; i < this.audioFiles.length; i++) {
                 beatmap.audioName = typeof this.audioFiles[i] === "string" ? this.audioFiles[i] : this.audioFiles[i].name;

                 if (beatmap.audioName === GAME_STATE.currentBeatmap["audioFilename"]) {
                     beatmap.audioFile = this.audioFiles[i];
                     break;
                 }
             }

             AUDIO_MANAGER.loadSong(beatmap.audioFile, beatmap.audioName, false, audioCallback);
        });
    }

    selectDifficulty(difficultyFile, audioFiles, imageFiles) {
        this.loadDifficulty(difficultyFile, audioFiles, imageFiles, function () {
            currentAudio.playAudioFromOffsetWithLoop(0, GAME_STATE.currentBeatmap["previewTime"] / 1000.0, GAME_STATE.currentBeatmap["previewTime"] / 1000.0)
        });
    }
}