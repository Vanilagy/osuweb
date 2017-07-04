"use strict";

import {BeatmapSetEntry} from "./beatmapsetentry";
import {SkinEntry} from "./skinentry";

export class Database {
    constructor(directoryEntry) {
        this.beatmapSetEntrys = {};
        this.finishedBeatmapSetEntrys = 0;
        this.processesRunning = 0;
        this.skinEntrys = [];

        if(directoryEntry) this.loadDirectory(directoryEntry)
    }

    loadDirectory(directoryEntry) {
        if (directoryEntry !== undefined) {
            this.startTime = window.performance.now();

            let reader = directoryEntry.createReader();
            reader.readEntries(this.directoryCallback.bind(this, reader, [], directoryEntry.name));

            console.log(this.beatmapSetEntrys);
        }
    }

    directoryCallback(reader, entries, dirName, results) {
        if (!results.length) {
            this.processDirectoryEntries(entries, dirName);
        }
        else {
            entries = entries.concat(results);
            reader.readEntries(this.directoryCallback.bind(this, reader, entries, dirName));
        }
    }

    isSkin(fileEntrys) {

    }

    isMap(fileEntrys) {
        let osuFileExists = false;
        let soundFileExists = false;

        for (let fileEntry in fileEntrys) {
            let entry = fileEntrys[fileEntry];

            if (entry.name.endsWith(".osu")) {
                osuFileExists = true;
            }
            else if (entry.name.endsWith(".mp3") || entry.name.endsWith(".wav") || entry.name.endsWith(".ogg")) {
                soundFileExists = true;
            }

            if (osuFileExists && soundFileExists) return true;
        }

        return false;
    }

    processDirectoryEntries(entries, dirName) {
        let files = [];
        let directories = [];

        for (let i = 0; i < entries.length; i++) {
            let entry = entries[i];
            if (entry.isDirectory) {
                directories.push(entry);
            }
            else if (entry.isFile) {
                files.push(entry);
            }
        }

        if (this.isMap(files)) {
            let beatmapSetEntry = new BeatmapSetEntry(files, (function () {
                this.finishedBeatmapSetEntrys++;
                console.log(this.finishedBeatmapSetEntrys + " (time passed: " + (window.performance.now() - this.startTime) + ")");
                this.processesRunning--;
            }).bind(this));

            if (beatmapSetEntry[dirName] === undefined) this.beatmapSetEntrys[dirName] = beatmapSetEntry;
        }
        else if (this.isSkin(files)) {
            this.skinEntrys.push(new SkinEntry(files));
            this.processesRunning--;
        }
        else {
            for (let i = 0; i < directories.length; i++) {
                let dirReader = directories[i].createReader();
                dirReader.readEntries(this.directoryCallback.bind(this, dirReader, [], directories[i].name));
            }
            this.processesRunning--;
        }
    }
}