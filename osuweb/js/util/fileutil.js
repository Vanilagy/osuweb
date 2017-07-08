"use strict";

import {ZIP} from "../main"
import {Audio} from "../audio/audio";

export class FileUtil {
    constructor() {

    }
	static loadFileAsDataUrl(file, onLoad) {
        let reader = new FileReader();

		reader.onload = onLoad;

		reader.readAsDataURL(file);
	}
    static loadFileAsString(file, onLoad) {
        let reader = new FileReader();

        reader.onload = onLoad;

        reader.readAsText(file);
    }
    static loadAudio(file, onFileLoad, onAudioLoad, isUrl = false, isMusic = false) {
        if(typeof file === "string" && isUrl) {
            let request = new XMLHttpRequest();
            request.open('GET', file, true);
            request.responseType = 'arraybuffer';
            request.onload = (function(e) {
                onFileLoad(new Audio(e.target.response, onAudioLoad, isMusic));
            });
            request.send();
        }
        // This is a zip entry
        else if(typeof file === "string") {
            ZIP.file(file).async("arraybuffer").then((function(result) {
                onFileLoad(new Audio(result, onAudioLoad, 5, isMusic));
            }));
        }
        else if(Object.prototype.toString.call(file) === "[object File]") {
            let reader = new FileReader();
            reader.onload = (function(e) {
                onFileLoad(new Audio(e.target.result, onAudioLoad, 5, isMusic));
            });
            reader.readAsArrayBuffer(file);
        }
        else if(Object.prototype.toString.call(file) === "[object Object]") {
            file.async("arraybuffer").then((function(result) {
                onFileLoad(new Audio(result, onAudioLoad, 5, isMusic));
            }));
        }
    }
}