"use strict";

import {Settings} from "./settings";
import {AudioManager} from "./audio/audiomanager";
import {InputUtil, INPUT_STATE, cursorElement} from "./util/inpututil";
import {Skin} from "./datamodel/skin";
import {SceneMenu} from "./game/scenes/scenemenu";
import {SceneSongSelect} from "./game/scenes/scenesongselect";
import {SceneGameOsu} from "./game/scenes/scenegameosu";
import {BeatmapSet} from "./datamodel/beatmapset";
import {Play} from "./game/play";
import {SceneLoading} from "./game/scenes/sceneloading";

export let GAME_STATE = {
    currentScene: null,
    currentBeatmapSet: null,
    currentBeatmap: null,
    defaultSkin: null,
    currentSkin: null,
    currentPlay: null,
    database: null,
    controls: {
        volumeControl: null
    }
};

export let ZIP = new JSZip();

export let AUDIO_MANAGER = new AudioManager();

export let SETTINGS = new Settings();

document.addEventListener("mousemove", function(event) {
    INPUT_STATE.mouseX = event.clientX;
    INPUT_STATE.mouseY = event.clientY;
    INPUT_STATE.lastMousePosUpdateTime = window.performance.now();
    if (GAME_STATE.currentPlay) {
        INPUT_STATE.userPlayfieldCoords = InputUtil.getCursorPlayfieldCoords();
    }
    InputUtil.updateCursor();
});
document.addEventListener("mousedown", function(e) {
    if(e.button === 0) InputUtil.changeMouseButtonState(true, true);
    else if(e.button === 2) InputUtil.changeMouseButtonState(false, true);
});
document.addEventListener("mouseup", function(e) {
    if(e.button === 0) InputUtil.changeMouseButtonState(true, false);
    else if(e.button === 2) InputUtil.changeMouseButtonState(false, false);
});
document.addEventListener("contextmenu", function(e) {
    e.preventDefault();
});
document.addEventListener("keydown", function(event) {
    for(var key in SETTINGS.data.keyCodeBindings) {
        if(SETTINGS.data.keyCodeBindings[key] === event.keyCode) {
            if(key === "k1") InputUtil.changeKeyButtonState(event.keyCode, true);
            if(key === "k2") InputUtil.changeKeyButtonState(event.keyCode, true);
        }
    }
});
document.addEventListener("keyup", function(event) {
    for(var key in SETTINGS.data.keyCodeBindings) {
        if(SETTINGS.data.keyCodeBindings[key] === event.keyCode) {
            if(key === "k1") InputUtil.changeKeyButtonState(event.keyCode, false);
            if(key === "k2") InputUtil.changeKeyButtonState(event.keyCode, false);
        }
    }
});
window.onload = function() {
    // No initialization because loading is the base
    GAME_STATE.currentScene = new SceneLoading();

    window.onresize();

    GAME_STATE.currentScene.elements["loadingDiv"].style.transform = "translate(-50%, -50%) scale(1, 1)";
    GAME_STATE.currentScene.elements["loadingDiv"].style.webkitTransform = "translate(-50%, -50%) scale(1, 1)";
    GAME_STATE.currentScene.elements["loadingDiv"].style.oTransform = "translate(-50%, -50%) scale(1, 1)";
    GAME_STATE.currentScene.elements["loadingDiv"].style.mozTransform = "translate(-50%, -50%) scale(1, 1)";
    GAME_STATE.currentScene.elements["loadingDiv"].style.msTransform = "translate(-50%, -50%) scale(1, 1)";

    GAME_STATE.currentScene.elements["loadingDiv"].style.letterSpacing = "25px";

    let timePassed = false;
    let audioLoad = false;
    let skinLoad = false;

    setTimeout(function() {if(skinLoad && audioLoad) finishLoading(); else timePassed = true;}, 500);

    GAME_STATE.defaultSkin = new Skin("./assets/default.osk", "default", function() {if(timePassed && audioLoad) finishLoading(); else skinLoad = true});

    AUDIO_MANAGER.loadSong("./audio/circles.mp3", "circles", false, function() {
        if(timePassed && skinLoad) finishLoading(); else audioLoad = true
    }, true);
};

window.onresize = function() {
    let ctx = GAME_STATE.currentScene.elements["osuwebCanvas"].getContext("2d");

    ctx.canvas.width  = window.innerWidth;
    ctx.canvas.height = window.innerHeight;
};

function finishLoading() {
    cursorElement.src = "data:image/png;base64,"+GAME_STATE.defaultSkin.skinElements["cursor"];

    GAME_STATE.currentScene.elements["loadingDiv"].style.opacity = 0;

    setTimeout(function() {
        GAME_STATE.currentScene.elements["loadingDiv"].style.transition = "opacity 1s linear";
        GAME_STATE.currentScene.elements["loadingDiv"].innerHTML = "WELCOME";
        GAME_STATE.currentScene.elements["loadingDiv"].style.opacity = 1;
        AUDIO_MANAGER.playSound(GAME_STATE.defaultSkin.skinElements["welcome"]);

        setTimeout(function () {
            GAME_STATE.currentScene.elements["loadingDiv"].style.opacity = 0;
            GAME_STATE.currentScene.elements["foregroundDiv"].style.opacity = 0;

            setTimeout(function () {
                GAME_STATE.currentScene.elements["loadingDiv"].style.display = "none";
                GAME_STATE.currentScene.elements["foregroundDiv"].style.display = "none";
                GAME_STATE.currentScene = new SceneMenu();
                GAME_STATE.currentScene.elements["osuInput"].style.display = "block";
                AUDIO_MANAGER.playSongByName("circles", 0, 0, true);
            }, 1000)
        }, 2000)
    }, 1100);
}

function startSongSelect() {
    GAME_STATE.currentScene.elements["osuInput"].style.display = "none";

    GAME_STATE.currentScene = new SceneSongSelect();

    GAME_STATE.currentScene.elements["songpanelsDiv"].style.display = "block";
}

document.getElementById("container").addEventListener("wheel", function(e) {
    SETTINGS.changeMaster(0.05 * -Math.round(e.deltaY / 100.0));
});

document.getElementById("container").ondragenter = function(e) {
    e.preventDefault();
};

document.getElementById("container").ondragover = function(e) {
    e.preventDefault();
};

document.getElementById("container").ondrop = function(e) {
    e.preventDefault();
    let length = e.dataTransfer.items.length;
    for (let i = 0; i < length; i++) {
        let entry = e.dataTransfer.items[i].webkitGetAsEntry();
        if (entry.isFile) {
            console.log(entry);
        } else if (entry.isDirectory) {
            GAME_STATE.database = new Database(entry);
        }
    }
};

document.getElementById("beatmap").addEventListener("change", function(e) {
    GAME_STATE.currentScene.elements["osuInput"].style.display = "none";

    GAME_STATE.currentScene = new SceneGameOsu();

    new BeatmapSet(e.target.files, function(beatmapset) {
        GAME_STATE.currentBeatmapSet = beatmapset;
        document.getElementById("beatmap").style.visibility = "hidden";

        let keys = [];
        for (let key in GAME_STATE.currentBeatmapSet.difficulties) {
            keys.push(key);
        }
        AUDIO_MANAGER.stopSong();
        console.log(GAME_STATE.currentBeatmapSet.difficulties[keys[0]]);

        GAME_STATE.currentBeatmapSet.loadDifficulty(GAME_STATE.currentBeatmapSet.difficulties[keys.length === 1 ? keys[0] : (function() {
            let issuedBullshit = prompt("Enter difficulty: (" + keys.join(", ") + ") or id");

            if (Number(issuedBullshit) === issuedBullshit) {
                return keys[issuedBullshit];
            } else {
                return issuedBullshit;
            }
        })()], () => {
            new Play(GAME_STATE.currentBeatmap, GAME_STATE.currentBeatmap.audioName);

            GAME_STATE.currentScene.elements["objectContainerDiv"].style.display = "block";
            GAME_STATE.currentScene.setElementVisibility(true);
            GAME_STATE.currentPlay.updatePlayareaSize(() => GAME_STATE.currentPlay.start());
        });
    });
});

export function clone(obj) {
    let copy;

    // Handle the 3 simple types, and null or undefined
    if (null === obj || "object" !== typeof obj) return obj;

    // Handle Date
    if (obj instanceof Date) {
        copy = new Date();
        copy.setTime(obj.getTime());
        return copy;
    }

    // Handle Array
    if (obj instanceof Array) {
        copy = [];
        for (let i = 0, len = obj.length; i < len; i++) {
            copy[i] = clone(obj[i]);
        }
        return copy;
    }

    // Handle Object
    if (obj instanceof Object) {
        copy = {};
        for (let attr in obj) {
            if (obj.hasOwnProperty(attr)) copy[attr] = clone(obj[attr]);
        }
        return copy;
    }

    throw new Error("Unable to copy obj! Its type isn't supported.");
}