"use strict";

import {Settings} from "./settings";
import {AudioManager} from "./audio/audiomanager";
import {InputUtil, INPUT_STATE} from "./util/inpututil";
import {Skin} from "./datamodel/skin";
import {SceneMenu} from "./game/scenes/scenemenu";
import {SceneSongSelect} from "./game/scenes/scenesongselect";
import {SceneGameOsu} from "./game/scenes/scenegameosu";
import {BeatmapSet} from "./datamodel/beatmapset";
import {SceneLoading} from "./game/scenes/sceneloading";
import {Database} from "./datamodel/database";
import {SceneManager} from "./game/scenes/scenemanager";
import {SLIDER_SETTINGS} from "./game/drawableslider";

export let GAME_STATE = {
    currentBeatmapSet: null,
    currentBeatmap: null,
    defaultSkin: null,
    currentSkin: null,
    currentPlay: null,
    database: new Database(),
    controls: {
        volumeControl: null
    },
    screen: {
        width: 640,
        height: 480
    }
};

export let ZIP = new JSZip();

export let AUDIO_MANAGER = new AudioManager();
export let SCENE_MANAGER = new SceneManager();

export let SETTINGS = new Settings();


document.getElementById("cursor").style.webkitTransform = "transformZ(0)";
document.getElementById("cursor").style.backfaceVisibility = "hidden";

document.addEventListener("mousemove", function(event) {
    INPUT_STATE.mouseX = event.clientX;
    INPUT_STATE.mouseY = event.clientY;
    INPUT_STATE.lastMousePosUpdateTime = window.performance.now();
    if (GAME_STATE.currentPlay) {
        INPUT_STATE.userPlayfieldCoords = InputUtil.getCursorPlayfieldCoords();
    }

    let newPosition = {x: INPUT_STATE.mouseX, y: INPUT_STATE.mouseY};

    SCENE_MANAGER.getScene().onMouseMove(newPosition)
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
    if (event.keyCode == 13) {
        toggleFullScreen();
    }

    for(let key in SETTINGS.data.keyCodeBindings) {
        if(SETTINGS.data.keyCodeBindings[key] === event.keyCode) {
            if(key === "k1") InputUtil.changeKeyButtonState(event.keyCode, true);
            if(key === "k2") InputUtil.changeKeyButtonState(event.keyCode, true);
        }
    }
});
function toggleFullScreen() {
    if (!document.webkitFullscreenElement) {
        document.getElementById("wrapper").webkitRequestFullscreen();
    } else {
        if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
    }
}
document.addEventListener("keyup", function(event) {
    for(let key in SETTINGS.data.keyCodeBindings) {
        if(SETTINGS.data.keyCodeBindings[key] === event.keyCode) {
            if(key === "k1") InputUtil.changeKeyButtonState(event.keyCode, false);
            if(key === "k2") InputUtil.changeKeyButtonState(event.keyCode, false);
        }
    }
});
window.onload = function() {
    window.onresize();

    // No initialization because loading is the base
    SCENE_MANAGER.setScene(new SceneLoading());

    SCENE_MANAGER.getScene().elements["loadingDiv"].style.transform = "translate(-50%, -50%) scale(1, 1)";
    SCENE_MANAGER.getScene().elements["loadingDiv"].style.webkitTransform = "translate(-50%, -50%) scale(1, 1)";
    SCENE_MANAGER.getScene().elements["loadingDiv"].style.oTransform = "translate(-50%, -50%) scale(1, 1)";
    SCENE_MANAGER.getScene().elements["loadingDiv"].style.mozTransform = "translate(-50%, -50%) scale(1, 1)";
    SCENE_MANAGER.getScene().elements["loadingDiv"].style.msTransform = "translate(-50%, -50%) scale(1, 1)";

    SCENE_MANAGER.getScene().elements["loadingDiv"].style.letterSpacing = "25px";

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
    let ctx = SCENE_MANAGER.getCanvas().getContext("2d");

    GAME_STATE.screen.width = window.innerWidth;
    GAME_STATE.screen.height = window.innerHeight;

    ctx.canvas.width  = window.innerWidth;
    ctx.canvas.height = window.innerHeight;
};

function finishLoading() {
    SCENE_MANAGER.switchScene(new SceneMenu(), (result) => {});
}

document.getElementById("snaking").addEventListener("change", () => {
    SLIDER_SETTINGS.snaking = document.getElementById("snaking").checked;
});

document.getElementById("auto").addEventListener("change", () => {
    if(GAME_STATE.currentPlay) GAME_STATE.currentPlay.autoplay = document.getElementById("auto").checked;
});

document.getElementById("osu").onclick = () => {
    SCENE_MANAGER.switchScene(new SceneSongSelect());
};

document.getElementById("container").addEventListener("wheel", function(e) {
    if(SCENE_MANAGER.getScene().constructor.name === "SceneSongSelect") {
        SCENE_MANAGER.getScene().scroll(Math.round(e.deltaY / 100.0));
    }
    else {
        SETTINGS.changeMaster(0.05 * -Math.round(e.deltaY / 100.0));
    }
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
            entry.file((file) => loadBeatmapFromFile(file));
        } else if (entry.isDirectory) {
            GAME_STATE.database = new Database(entry);
        }
    }
};

document.getElementById("beatmap").addEventListener("change", function(e) {
    loadBeatmapFromFile(e.target.files);
});

function loadBeatmapFromFile(files) {
    new BeatmapSet(files, function(beatmapset) {
        GAME_STATE.currentBeatmapSet = beatmapset;

        let keys = [];
        for (let key in GAME_STATE.currentBeatmapSet.difficulties) {
            keys.push(key);
        }
        AUDIO_MANAGER.stopSong();
        console.log(GAME_STATE.currentBeatmapSet.difficulties[keys[0]]);

        GAME_STATE.currentBeatmapSet.loadDifficulty(GAME_STATE.currentBeatmapSet.difficulties[keys.length === 1 ? keys[0] : (() => {
            let issuedBullshit = prompt("Enter difficulty: \n\n" + keys.join("\n")+"\n");

            if (!isNaN(Number(issuedBullshit))) {
                return keys[issuedBullshit];
            } else {
                return issuedBullshit;
            }
        })()], () => {
            SCENE_MANAGER.switchScene(new SceneGameOsu());
        });
    });
}

// The progression made last call relative to a stable 60 fps (3 = 3 frames on 60 fps passed since last call)
// Update last frame time
let lastFrame = window.performance.now();
// Global render loop
function render() {
    InputUtil.updateCursor();
    InputUtil.updateMouseDelta();

    // Calculate frame modifier for frame-independant animation
    let frameModifier = (window.performance.now() - lastFrame) / (1000 / 60.0);

    lastFrame = window.performance.now();

    SCENE_MANAGER.getScene().render(frameModifier);

    if(GAME_STATE.controls.volumeControl) GAME_STATE.controls.volumeControl.render(frameModifier);

    if(GAME_STATE.currentPlay) GAME_STATE.currentPlay.render(frameModifier);

    requestAnimationFrame(render);
}
requestAnimationFrame(render);

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