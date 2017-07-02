"use strict";

import {ZIP, AUDIO_MANAGER} from "../main";

export class Skin {
    constructor(resource, name, callback = null) {
        this.callback = callback;
        this.skinElements = {};
        this.name = name;

        if (Object.prototype.toString.call(resource) === '[object Array]') {
            alert('Array!');
            this.callback(false);
        }
        else if (Object.prototype.toString.call(resource) === '[object File]') {
            ZIP.loadAsync(resource).then(this.loadOSK.bind(this));
        }
        else if (Object.prototype.toString.call(resource) === '[object String]') {
            JSZipUtils.getBinaryContent(resource, (function (err, data) {
                if (err) {
                    console.log(err);
                }

                ZIP.loadAsync(data).then(this.loadOSK.bind(this));
            }).bind(this));
        }
    }

    loadOSK(zip) {
        for (let key in zip.files) {
            // Get our keyname from filename
            let rawFileName = key.replace(/\.[^/.]+$/, "");
            // Determine how to read this entry
            let output = "string";
            if (key.endsWith(".mp3") || key.endsWith(".ogg") || key.endsWith(".wav")) output = "arraybuffer";
            if (key.endsWith(".jpg") || key.endsWith(".jpeg") || key.endsWith(".png") || key.endsWith(".gif")) output = "base64";
            zip.file(key).async(output).then((result) => {
                if (output === "arraybuffer") {
                    try {
                        if (result.byteLength > 0) {
                            this.skinElements[rawFileName] = rawFileName+this.name;

                            AUDIO_MANAGER.loadSoundArrayBuffer(result, rawFileName+this.name, 50);
                        }
                    }
                    catch (e) {
                        console.log(e + rawFileName);
                    }
                }
                else {
                    this.skinElements[rawFileName] = result;
                }
            }, (fuckme) => {
                console.log(fuckme);
            });
        }
        if(this.callback !== null) this.callback(true);
    };

    static getSampleSetName(id) {
        switch (id) {
            case 1:
                return "normal";
            case 2:
                return "soft";
            case 3:
                return "drum";
            default:
                return "normal";
        }
    }
}