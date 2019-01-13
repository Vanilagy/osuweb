const BOIS = "BOIS";

"use strict";

import {Settings} from "./settings";
import {AudioManager} from "./audio/audiomanager";
import {InputUtil, INPUT_STATE} from "./util/inpututil";
import {Skin} from "./datamodel/skin";
import {SceneMenu} from "./ui/scenes/scenemenu";
import {SceneSongSelect} from "./ui/scenes/scenesongselect";
import {SceneGameOsu} from "./ui/scenes/scenegameosu";
import {BeatmapSet} from "./datamodel/beatmapset";
import {SceneLoading} from "./ui/scenes/sceneloading";
import {Database} from "./datamodel/database";
import {SceneManager} from "./ui/scenes/scenemanager";
import {SLIDER_SETTINGS} from "./game/drawableslider";
import {TRANSFORMATION_MANAGER} from "./ui/scenes/transformation";
import {GraphicUtil} from "./util/graphicutil";

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

export let FILE_SYSTEM = null;

navigator.webkitPersistentStorage.requestQuota(1024*1024*1024*2, function(grantedBytes) {
    window.webkitRequestFileSystem(PERSISTENT, grantedBytes, function(fs) {
        FILE_SYSTEM = fs;
    }, function(e) {
        console.log('Error', e);
    });
}, function(e) {
    console.log('Error', e);
});

export let DB = new Database();

export let ZIP = new JSZip();

export let AUDIO_MANAGER = new AudioManager();
export let SCENE_MANAGER = new SceneManager();

export let SETTINGS = new Settings();

let pointerLocked = false;
let resized = true;

let bodyElement = document.getElementsByTagName("body")[0];

bodyElement.requestPointerLock = bodyElement.requestPointerLock || bodyElement.mozRequestPointerLock;
document.exitPointerLock = document.exitPointerLock || document.mozExitPointerLock;

document.getElementById("cursor").style.backfaceVisibility = "hidden";

document.addEventListener("resize", function() {
    resized = true;
});
document.addEventListener("mousemove", function(event) {
    if(pointerLocked) {
        INPUT_STATE.mouseX += event.movementX * SETTINGS.sensitivity;
        INPUT_STATE.mouseY += event.movementY * SETTINGS.sensitivity;

        if(INPUT_STATE.mouseX < 0) INPUT_STATE.mouseX = 0;
        if(INPUT_STATE.mouseY < 0) INPUT_STATE.mouseY = 0;
        if(INPUT_STATE.mouseX > GraphicUtil.getWindowDimensions().width) INPUT_STATE.mouseX = GraphicUtil.getWindowDimensions().width;
        if(INPUT_STATE.mouseY > GraphicUtil.getWindowDimensions().height) INPUT_STATE.mouseY = GraphicUtil.getWindowDimensions().height;
    }
    else {
        INPUT_STATE.mouseX = event.clientX;
        INPUT_STATE.mouseY = event.clientY;
    }

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
    if (event.keyCode === 13) {
        //toggleFullScreen();
    }

    if(event.keyCode === SETTINGS.keyBindings["pointerLock"]) (pointerLocked = !pointerLocked) ? bodyElement.requestPointerLock() : document.exitPointerLock();

    SCENE_MANAGER.onKeyDown(event);

    if(event.keyCode === 16) INPUT_STATE.shiftDown = true;
    if(event.keyCode === 17) INPUT_STATE.ctrlDown = true;
    if(event.keyCode === 18) INPUT_STATE.altDown = true;

    if(event.keyCode === 27) { // ESC
        // TODO back functionality

        if (GAME_STATE.currentPlay) {
            GAME_STATE.currentPlay.togglePause();
        }
    }

    if (event.keyCode === 32) { // Space
        if (GAME_STATE.currentPlay && GAME_STATE.currentPlay.skipEndTime) {
            AUDIO_MANAGER.skipTo(GAME_STATE.currentPlay.skipEndTime / 1000);
        }
    }

    for(let key in SETTINGS.keyBindings) {
        if(SETTINGS.keyBindings[key] === event.keyCode) {
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
    if(event.keyCode === 16) INPUT_STATE.shiftDown = false;
    if(event.keyCode === 17) INPUT_STATE.ctrlDown = false;
    if(event.keyCode === 18) INPUT_STATE.altDown = false;

    for(let key in SETTINGS.keyBindings) {
        if(SETTINGS.keyBindings[key] === event.keyCode) {
            if(key === "k1") InputUtil.changeKeyButtonState(event.keyCode, false);
            if(key === "k2") InputUtil.changeKeyButtonState(event.keyCode, false);
        }
    }
});
window.onload = function() {
    document.getElementsByTagName("body")[0].removeChild(document.getElementById("f1"));
    document.getElementsByTagName("body")[0].removeChild(document.getElementById("f2"));
    document.getElementsByTagName("body")[0].removeChild(document.getElementById("f3"));
    document.getElementsByTagName("body")[0].removeChild(document.getElementById("f4"));
    document.getElementsByTagName("body")[0].removeChild(document.getElementById("f5"));
    document.getElementsByTagName("body")[0].removeChild(document.getElementById("f6"));

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
};

function finishLoading() {
    SCENE_MANAGER.switchScene(new SceneMenu(), (result) => {});
}

document.getElementById("snaking").addEventListener("change", () => {
    SLIDER_SETTINGS.snaking = document.getElementById("snaking").checked;
});

document.getElementById("osu").onclick = () => {
    SCENE_MANAGER.switchScene(new SceneSongSelect());
};

(function(window,document) {
    let prefix = "", _addEventListener, support;

    // detect event model
    if ( window.addEventListener ) {
        _addEventListener = "addEventListener";
    } else {
        _addEventListener = "attachEvent";
        prefix = "on";
    }

    // detect available wheel event
    support = "onwheel" in document.createElement("div") ? "wheel" : // Modern browsers support "wheel"
        document.onmousewheel !== undefined ? "mousewheel" : // Webkit and IE support at least "mousewheel"
            "DOMMouseScroll"; // let's assume that remaining browsers are older Firefox

    window.addWheelListener = function( elem, callback, useCapture ) {
        _addWheelListener( elem, support, callback, useCapture );

        // handle MozMousePixelScroll in older Firefox
        if( support === "DOMMouseScroll" ) {
            _addWheelListener( elem, "MozMousePixelScroll", callback, useCapture );
        }
    };

    function _addWheelListener( elem, eventName, callback, useCapture ) {
        elem[ _addEventListener ]( prefix + eventName, support === "wheel" ? callback : function( originalEvent ) {
            !originalEvent && ( originalEvent = window.event );

            // create a normalized event object
            let event = {
                // keep a ref to the original event object
                originalEvent: originalEvent,
                target: originalEvent.target || originalEvent.srcElement,
                type: "wheel",
                deltaMode: originalEvent.type === "MozMousePixelScroll" ? 0 : 1,
                deltaX: 0,
                deltaY: 0,
                deltaZ: 0,
                preventDefault: function() {
                    originalEvent.preventDefault ?
                        originalEvent.preventDefault() :
                        originalEvent.returnValue = false;
                }
            };

            // calculate deltaY (and deltaX) according to the event
            if ( support === "mousewheel" ) {
                event.deltaY = - 1/40 * originalEvent.wheelDelta;
                // Webkit also support wheelDeltaX
                originalEvent.wheelDeltaX && ( event.deltaX = - 1/40 * originalEvent.wheelDeltaX );
            } else {
                event.deltaY = originalEvent.deltaY || originalEvent.detail;
            }

            // it's time to fire the callback
            return callback( event );

        }, useCapture || false );
    }

})(window,document);

addWheelListener(document.getElementById("container"), function(e) {
    if(SCENE_MANAGER.getScene().constructor.name === "SceneSongSelect" && !INPUT_STATE.altDown) {
        SCENE_MANAGER.getScene().scroll(Math.round(InputUtil.normalizeWheelEvent(e) / 120));
    }
    else {
        SETTINGS.changeMaster(0.05 * -Math.round(InputUtil.normalizeWheelEvent(e) / 120));
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
            DB.importDirectory(entry);
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
    // Input updates
    if(!INPUT_STATE.suppressManualCursorControl) InputUtil.updateCursor(INPUT_STATE.mouseX, INPUT_STATE.mouseY);
    InputUtil.updateMouseDelta();

    if(resized) {
        GraphicUtil.setWindowDimensions(document.innerWidth, document.innerHeight);
        resized = false;
    }

    // Calculate frame modifier for frame-independant animation
    let frameModifier = (window.performance.now() - lastFrame) / (1000 / 60.0);

    lastFrame = window.performance.now();

    TRANSFORMATION_MANAGER.update();

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