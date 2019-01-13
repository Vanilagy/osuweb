"use strict";

import { processDirectory } from "./beatmapimport";

export class Database {
    constructor() {
        this._idb = null;

        let dbReq = window.indexedDB.open('osuweb', 1);

        dbReq.onupgradeneeded = function(evt) {
            let db = this.result;

            db.createObjectStore('mapsets', {keyPath: 'Id'});
            db.createObjectStore('maps', {keyPath: 'Id'});
            db.createObjectStore('skins', {keyPath: 'Id'});
            db.createObjectStore('songs', {keyPath: 'Hash'});
            db.createObjectStore('images', {keyPath: 'Hash'});
        };

        dbReq.onsuccess = (function(evt) {
            this._idb = dbReq.result;
        }).bind(this); 
    }

    importOsz() {

    }

    importDirectory(directoryEntry) {
        processDirectory(directoryEntry).then(entries => {
            let tx = this._idb.transaction(['maps', 'mapsets', 'songs', 'images'], 'readwrite'); 

            tx.oncomplete = () => {
                console.info("Done importing beatmap set!");
            };
    
            tx.onerror = () => {
                console.error("Error importing beatmap set!");
            };

            entries.flat().forEach(entry => {
                entry.Beatmaps.forEach(beatmap => tx.objectStore('maps').put(beatmap));
                entry.Audios.forEach(audio => tx.objectStore('songs').put(audio));
                entry.Images.forEach(image => tx.objectStore('images').put(image));
                
                tx.objectStore('mapsets').put(entry.BeatmapSet);
            });
        });
    }
}