"use strict";

import {Beatmap} from "./beatmap";
import {FileUtil} from "../util/fileutil";
import {AUDIO_MANAGER} from "../main";

export class BeatmapSetEntry {
    constructor(fileEntrys, callback) {
        
    }

    static createBase() {
        let beatmapSetEntry = new BeatmapSetEntry();

        beatmapSetEntry._audioFiles = [];
        /**
         * @type {File[]}
         * @private
         */
        beatmapSetEntry._imageFiles = [];
        /**
         * @type {Object.<string, Beatmap>}
         * @private
         */
        beatmapSetEntry._beatmaps = {};
        /**
         * @type {number}
         * @private
         */
        beatmapSetEntry._beatmapSetID = -1;
        /**
         * @type {Blob}
         * @private
         */
        beatmapSetEntry._mainImage = null;

        return beatmapSetEntry;
    }

    /**
     * @param {File[]} fileEntrys
     * @param {function} callback
     */
    static createFromFileEntry(fileEntrys, callback) {
        let beatmapSetEntry = BeatmapSetEntry.createBase();

        let loadingMaps = 0;

        for (let key in this._fileEntrys) {
            let fileEntry = this._fileEntrys[key];

            let name = fileEntry.name.toLowerCase();

            if (name.endsWith(".osu")) {
                loadingMaps++;
                fileEntry.file((file) => {
                    FileUtil.loadFileAsString(file, (content) => {
                        let beatmap = new Beatmap(content.target.result);

                        if (this._beatmapSetID === -1 && beatmap._beatmapSetID !== undefined) {
                            this._beatmapSetID = beatmap._beatmapSetID;
                        }

                        this._beatmaps[beatmap.version] = beatmap;

                        loadingMaps--;
                        if (loadingMaps === 0) callback(this);
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

        return beatmapSetEntry;
    }

    static createFromObject(beatmapSetObject) {
        let beatmapSetEntry = BeatmapSetEntry.createBase();

        this._mainImage

        return beatmapSetEntry;
    }

    getMainImage(callback) {
        
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