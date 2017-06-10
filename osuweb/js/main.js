var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
var audioCtxTime = window.performance.now();

var canvasCtx = document.getElementById("osuweb").getContext("2d");

var zip = new JSZip();

var controls = {
    volumeControl: null
};

console.log("Procatstination (Meowzerrin Style)")

var settings = {
    music: 0.8,
    sound: 0.8,
    master: 0.8,
    setMaster: function(value) {
        this.master = value;

        currentAudio.setVolume(value);

        if(this.master > 1.0) this.master = 1.0;
        if(this.master < 0.0) this.master = 0.0;
    },
    changeMaster: function(value) {
        if(controls.volumeControl == null) {
            controls.volumeControl = new VolumeControl();
        }

        controls.volumeControl.animateMaster(value);
    }
};

var database = null;

var defaultSkinElements = {};

var currentBeatmapSet = null;
var currentBeatmap = null;
var currentAudio = [];
var currentSkin = null;
var currentPlay = null;
var currentScene = null;

function clone(obj) {
    var copy;

    // Handle the 3 simple types, and null or undefined
    if (null == obj || "object" != typeof obj) return obj;

    // Handle Date
    if (obj instanceof Date) {
        copy = new Date();
        copy.setTime(obj.getTime());
        return copy;
    }

    // Handle Array
    if (obj instanceof Array) {
        copy = [];
        for (var i = 0, len = obj.length; i < len; i++) {
            copy[i] = clone(obj[i]);
        }
        return copy;
    }

    // Handle Object
    if (obj instanceof Object) {
        copy = {};
        for (var attr in obj) {
            if (obj.hasOwnProperty(attr)) copy[attr] = clone(obj[attr]);
        }
        return copy;
    }

    throw new Error("Unable to copy obj! Its type isn't supported.");
}