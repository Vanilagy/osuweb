"use strict";

import {Beatmap} from "./beatmap";
import {FileUtil} from "../util/fileutil";
import {AUDIO_MANAGER} from "../main";

export class BeatmapSetEntry {
    /**
     * @param {File[]} fileEntrys
     * @param {function} callback
     */
    constructor(fileEntrys, callback) {
        this._fileEntrys = fileEntrys;
        /**
         * @type {File[]}
         * @private
         */
        this._audioFiles = [];
        /**
         * @type {File[]}
         * @private
         */
        this._imageFiles = [];
        /**
         * @type {Object.<string, Beatmap>}
         * @private
         */
        this._beatmaps = {};
        /**
         * @type {number}
         * @private
         */
        this._loadingMaps = 0;
        /**
         * @type {number}
         * @private
         */
        this._beatmapSetID = -1;

        /**
         * @type {boolean}
         * @private
         */
        this._readingFilesDone = false;
        /**
         * @type {boolean}
         * @private
         */
        this._readingMapsDone = false;

        for (let key in this._fileEntrys) {
            let fileEntry = this._fileEntrys[key];

            let name = fileEntry.name.toLowerCase();

            if (name.endsWith(".osu")) {
                this._loadingMaps++;
                fileEntry.file((file) => {
                    FileUtil.loadFileAsString(file, (content) => {
                        let beatmap = new Beatmap(content.target.result);

                        if (this._beatmapSetID === -1 && beatmap._beatmapSetID !== undefined) {
                            this._beatmapSetID = beatmap._beatmapSetID;
                        }

                        this._beatmaps[beatmap.version] = beatmap;

                        this._loadingMaps--;
                        if (this._loadingMaps === 0) callback();
                    });
                });
            }
            else if(name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".gif") || name.endsWith(".png")) {
                this._imageFiles.push(fileEntry);
            }
            else if(name.endsWith(".mp3") || name.endsWith(".wav") || name.endsWith(".ogg")) {
                this._audioFiles.push(fileEntry);
            }
        }
    }

    getMainImageName() {
        let counts = {};

        for(let key in this._beatmaps) {
            let imageName = this._beatmaps[key].getBackgroundImageName();

            if(counts[imageName] === undefined) {
                counts[imageName] = 1;
            }
            else {
                counts[imageName]++;
            }
        }

        let biggestName = null;
        let biggestValue = 0;

        for(let key in counts) {
            if(counts[key] > biggestValue) {
                biggestValue = counts[key];
                biggestName = key;
            }
        }

        return biggestName;
    }

    getImageFileByName(fileName, callback) {
        for(let key in this._imageFiles) {
            let file = this._imageFiles[key];

            if(Object.prototype.toString.call(file) === "[object File]" && file.name.endsWith(fileName)) {
                callback(file);
                return;
            }

            if(Object.prototype.toString.call(file) === "[object FileEntry]" && file.name.endsWith(fileName)) {
                file.file((f) => callback(f));
                return;
            }
        }

        callback(null);
    }

    loadSongFileByName(fileName, callback) {
        this.getAudioFileByName(fileName, (audio) => {
            audio.key = fileName + ":" + Math.random();
            AUDIO_MANAGER.loadSong(audio, audio.key, false, () => {
                callback(audio.key);
            });
        });
    }

    getAudioFileByName(fileName, callback) {
        for(let key in this._audioFiles) {
            let file = this._audioFiles[key];

            if(Object.prototype.toString.call(file) === "[object File]" && file.name.endsWith(fileName)) {
                callback(file);
                return;
            }

            if(Object.prototype.toString.call(file) === "[object FileEntry]" && file.name.endsWith(fileName)) {
                file.file((f) => {
                    this._audioFiles[key] = f;
                    callback(f)
                });
                return;
            }
        }
    }

    get beatmaps() {
        return this._beatmaps;
    }
}