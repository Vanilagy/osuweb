var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
var audioCtxTime = window.performance.now();

var canvasCtx = document.getElementById("osuweb").getContext("2d");

var zip = new JSZip();

/*
canvasCtx.canvas.width  = window.innerWidth - 2;
canvasCtx.canvas.height = window.innerHeight - 2;
*/

var currentBeatmapSet = null;
var currentBeatmap = null;
var currentAudio = null;
var currentSkin = null;
var currentPlay = null;

var osuweb = {
    version: "2017.05.29.0000",
    versionType: "alpha",
};

osuweb.game = {
	// 0 - Main Menu
	// 1 - Song Select
	// 2 - In Game
	// 20 - Paused
	state: 0,
	database: {
		// The place where the database will be stored locally
		databaseFile: "",
		songDirectory: "",
		skinDirectory: "",
		mapsets: {},
		collections: {}
	}
}

osuweb.audio = {
	songBuffer: null,
	songSource: null,
	hitsound: {
		normal: {
			hit: null,
			clap: null,
			whistle: null,
			finish: null
		},
		drum: {
			hit: null,
			clap: null,
			whistle: null,
			finish: null
		},
		soft: {
			hit: null,
			clap: null,
			whistle: null,
			finish: null
		}
	}
}

osuweb.file = {
	loadDir: function(onReturn) {
		var input = $(document.createElement('input'));
        input.attr("type", "file");
        input.attr("id", "filepicker");
        input.attr("name", "filelist");
        input.attr("webkitdirectory", "true");
		$('#filepicker').change(onReturn);
        input.trigger('click');
	},
	loadFile: function(file, onLoad) {
		var reader = new FileReader();

		reader.onload = onLoad;

		reader.readAsDataURL(file);
	},
	loadAudio: function(file, onFileLoad, onAudioLoad) {
        var reader = new FileReader();
        reader.onload = (function(e) {
            onFileLoad(new Audio(e.target.result, onAudioLoad));
        });
        reader.readAsArrayBuffer(file);
    }
}

osuweb.graphics = {
    coordinateDimensions: {
        x: 512,
        y: 384
    },
    playAreaDimensions: {
        x: 640,
        y: 480
    }
}

osuweb.mathutil = {
	coordsOnBezier: function(pointArray, t) {
        var bx = 0, by = 0, n = pointArray.length - 1; // degree

        if (n == 1) { // if linear
            bx = (1 - t) * pointArray[0].x + t * pointArray[1].x;
            by = (1 - t) * pointArray[0].y + t * pointArray[1].y;
        } else if (n == 2) { // if quadratic
            bx = (1 - t) * (1 - t) * pointArray[0].x + 2 * (1 - t) * t * pointArray[1].x + t * t * pointArray[2].x;
            by = (1 - t) * (1 - t) * pointArray[0].y + 2 * (1 - t) * t * pointArray[1].y + t * t * pointArray[2].y;
        } else if (n == 3) { // if cubic
            bx = (1 - t) * (1 - t) * (1 - t) * pointArray[0].x + 3 * (1 - t) * (1 - t) * t * pointArray[1].x + 3 * (1 - t) * t * t * pointArray[2].x + t * t * t * pointArray[3].x;
            by = (1 - t) * (1 - t) * (1 - t) * pointArray[0].y + 3 * (1 - t) * (1 - t) * t * pointArray[1].y + 3 * (1 - t) * t * t * pointArray[2].y + t * t * t * pointArray[3].y;
        } else {
            for(var i = 0; i <= n; i++) {
                bx += this.binomialCoef(n, i) * Math.pow(1 - t, n - i) * Math.pow(t, i) * pointArray[i].x;
                by += this.binomialCoef(n, i) * Math.pow(1 - t, n - i) * Math.pow(t, i) * pointArray[i].y;
            }
        }

        return {x: bx, y: by}
	},
	binomialCoef: function(n, k) {
		var r = 1;

        if (k > n)
            return 0;

        for (var d = 1; d <= k; d++) {
            r *= n--;
            r /= d;
        }

        return r;
	},
    circleCenterPos: function(p1, p2, p3) {
        var yDelta_a = p2.y - p1.y,
            xDelta_a = p2.x - p1.x,
            yDelta_b = p3.y - p2.y,
            xDelta_b = p3.x - p2.x,
            center = {};

        var aSlope = yDelta_a / xDelta_a,
            bSlope = yDelta_b / xDelta_b;

        center.x = (aSlope * bSlope * (p1.y - p3.y) + bSlope * (p1.x + p2.x) - aSlope * (p2.x + p3.x)) / (2 * (bSlope - aSlope));
        center.y = -1 * (center.x - (p1.x + p2.x) / 2) / aSlope + (p1.y + p2.y) / 2;

        return center;
    },
    reflect: function(val) {
        if (Math.floor(val) % 2 == 0) {
            return val - Math.floor(val);
        } else {
            return 1 - (val - Math.floor(val));
        }
    }
}

osuweb.graphics.scene = {
	sceneSwitching: false,
	scenes: {
		sceneMainMenu: "You havent edited this yet lol"
	}
}

osuweb.util = {
	getHighResolutionContextTime: function() {
		return window.performance.now() - audioCtxTime;
	}
}

function BeatmapSet(files) {
    this.files = files;
    this.audioFiles = [];
    this.imageFiles = [];
    this.difficulties = {};

    for(var i = 0; i < files.length; i++) {
        var filename = files[i].name.toLowerCase();

        if(filename.endsWith(".mp3") || filename.endsWith(".wav") || filename.endsWith(".ogg")) {
            this.audioFiles.push(files[i]);
            continue;
        }
        if(filename.endsWith(".jpg") || filename.endsWith(".jpeg") || filename.endsWith(".png") || filename.endsWith(".gif")) {
            this.imageFiles.push(files[i]);
            continue;
        }

        var regex = /\[([^\[^\]]+)]\.osu$/g;
        var str = files[i].webkitRelativePath;
        var m;

        while ((m = regex.exec(str)) !== null) {
            // This is necessary to avoid infinite loops with zero-width matches
            if (m.index === regex.lastIndex) {
                regex.lastIndex++;
            }

            // The result can be accessed through the `m`-variable.
            m.forEach((function(match, groupIndex){
                if(groupIndex == 1) {
                    this.difficulties[match] = files[i];
                }
            }).bind(this));
        }
    }

    //this.selectDifficulty(Object.values(this.difficulties)[0]);
}

BeatmapSet.prototype.loadDifficulty = function(difficultyFile, audioCallback) {
    currentBeatmap = new Beatmap(difficultyFile, function() {
        // find background image if it exists
        var imageFile = null;

        for(var i = 0; i < currentBeatmap.events.length; i++) {
            if(currentBeatmap.events[i].type == "image") {
                var imageFileName = currentBeatmap.events[i].file;

                for(var j = 0; j < this.imageFiles.length; j++) {
                    if(this.imageFiles[j].name == imageFileName) {
                        imageFile = this.imageFiles[j];
                        break;
                    }
                }

                break;
            }
        }

        if(imageFile != null) {
            osuweb.file.loadFile(imageFile, function(e) {
                var img = new Image;
                img.onload = function(){
                    canvasCtx.drawImage(img,0,0,img.width,img.height,0,0,canvasCtx.canvas.width,canvasCtx.canvas.height);
                };
                img.src = e.target.result;
            });
        }

        // find audio file
        var audioFile = null;

        for(var i = 0; i < this.audioFiles.length; i++) {
            if(this.audioFiles[i].name == currentBeatmap["audioFile"]) {
                audioFile = this.audioFiles[i];
                break;
            }
        }

        osuweb.file.loadAudio(audioFile, (function(a) {
            currentAudio = a;
        }).bind(this), (function() {
            audioCallback();
        }).bind(this));
    }.bind(this));
}

BeatmapSet.prototype.selectDifficulty = function(difficultyFile, audioFiles, imageFiles) {
    this.loadDifficulty(difficultyFile, audioFiles, imageFiles, function() {
        currentAudio.playAudioFromOffsetWithLoop(0, currentBeatmap["previewTime"] / 1000.0, currentBeatmap["previewTime"] / 1000.0)
    });
}

function Beatmap(file, callback) {
    var reader = new FileReader();
    reader.onload = (function(e){
        this.events = [];
        this.timingPoints = [];
        this.hitObjects = [];
        this.colours = [];

        var timingPointIndex = 0;

        var lines = e.target.result.split('\n');

        var section = "header";
        var eventType = "";

        for(var i = 0; i < lines.length; i++){
            var line = lines[i].trim();

            if(line == "") continue;

            if(line.startsWith("osu file format v") && !line.endsWith("14")) console.log("The beatmap version seems to be older than supported. We could run into issue here!");

            if(line == "[General]") {
                section = "general";
                continue;
            }
            if(line == "[Metadata]") {
                section = "metadata";
                continue;
            }
            if(line == "[Difficulty]")  {
                section = "difficulty";
                continue;
            }
            if(line == "[Events]")  {
                section = "events";
                continue;
            }
            if(line == "[TimingPoints]")  {
                section = "timing";
                continue;
            }
            if(line == "[HitObjects]")  {
                section = "hitObjects";
                continue;
            }
            if(line == "[Colours]")  {
                section = "colours";
                continue;
            }

            if(section != "timing" && section != "hitObjects") {
                if(line.startsWith("AudioFilename")) this.audioFile=line.split(':')[1].trim();
                if(line.startsWith("AudioLeadIn")) this.audioLeadIn=parseInt(line.split(':')[1].trim(), 10);
                if(line.startsWith("PreviewTime")) this.previewTime=parseInt(line.split(':')[1].trim(), 10);
                if(line.startsWith("Countdown")) this.countdown=parseInt(line.split(':')[1].trim(), 10);
                if(line.startsWith("SampleSet")) this.sampleSet=parseInt(line.split(':')[1].trim(), 10);
                if(line.startsWith("StackLeniency")) this.stackLeniency=parseFloat(line.split(':')[1].trim());
                if(line.startsWith("Mode")) this.mode=parseInt(line.split(':')[1].trim(), 10);
                if(line.startsWith("LetterboxInBreaks")) this.letterBoxInBreaks=parseInt(line.split(':')[1].trim(), 10);
                if(line.startsWith("WidescreenStoryboard")) this.widescreenStoryboard=parseInt(line.split(':')[1].trim(), 10);

                if(line.startsWith("Title")) this.title=line.split(':')[1].trim();
                if(line.startsWith("TitleUnicode")) this.titleUnicode=line.split(':')[1].trim();
                if(line.startsWith("Artist")) this.artist=line.split(':')[1].trim();
                if(line.startsWith("ArtistUnicode")) this.artistUnicode=line.split(':')[1].trim();
                if(line.startsWith("Creator")) this.creator=line.split(':')[1].trim();
                if(line.startsWith("Version")) this.version=line.split(':')[1].trim();
                if(line.startsWith("Source")) this.source=line.split(':')[1].trim();
                if(line.startsWith("Tags")) this.tags=line.split(':')[1].trim();
                if(line.startsWith("BeatmapID")) this.beatmapID=line.split(':')[1].trim();
                if(line.startsWith("BeatmapSetID")) this.beatmapSetID=line.split(':')[1].trim();

                if(line.startsWith("HPDrainRate")) this.HP=line.split(':')[1].trim();
                if(line.startsWith("CircleSize")) this.CS=line.split(':')[1].trim();
                if(line.startsWith("OverallDifficulty")) this.OD=line.split(':')[1].trim();
                if(line.startsWith("ApproachRate")) this.AR=line.split(':')[1].trim();
                if(line.startsWith("SliderMultiplier")) this.SV=line.split(':')[1].trim();
                if(line.startsWith("SliderTickRate")) this.sliderTickRate=line.split(':')[1].trim();
            }
            if(section == "colours") {
                var col = line.split(':')[1].trim().split(',');

                this.colours.push({
                    r: col[0],
                    g: col[1],
                    b: col[2],
                });
            }
            if(section == "timing") {
                var values = line.split(',');

                this.timingPoints.push({
                    index: timingPointIndex++,
                    offset: parseInt(values[0], 10),
                    msPerBeat: parseFloat(values[1]),
                    BPM: parseFloat(values[1]) > 0 ? 60000/values[1] : -1,
                    meter: parseInt(values[2], 10),
                    sampleType: parseInt(values[3], 10),
                    sampleSet: parseInt(values[4], 10),
                    volume: parseInt(values[5], 10),
                    inherited: parseFloat(values[1]) < 0,
                    kiai: parseInt(values[7], 10),
                });
            }
            if(section == "events") {
                if(line.startsWith("//")) continue;

                var values = line.split(',');

                switch(values[0]) {
                    case "0":
                        this.events.push({
                            type: "image",
                            time: parseInt(values[1], 10),
                            file: values[2].substring(1,values[2].length - 1),
                            x: parseInt(values[3], 10),
                            y: parseInt(values[4], 10)
                        });
                        break;
                    case "2":
                        this.events.push({
                            type: "break",
                            start: parseInt(values[1], 10),
                            end: parseInt(values[2], 10)
                        });
                        break;
                }


            }
            if(section == "hitObjects") {
                var values = line.split(',');
                // circle
                if(values[3] == "1" || values[3] == "5") {
                    var circle = {
                        type: "circle",
                        newCombo: values[3] == "5",
                        x: parseInt(values[0], 10),
                        y: parseInt(values[1], 10),
                        time: parseInt(values[2], 10),
                        hitSound: parseInt(values[4], 10),
                    };

                    circle.startPoint = [circle.x, circle.y];
                    circle.basePoint = [circle.x, circle.y];

                    // samplings
                    if(values[5] != undefined) {
                        var SamplingValues = values[5].split(':');
                    }
                    else {
                        var SamplingValues = [0, 0];
                    }

                    circle["samplings"] = {sampleSet: parseInt(SamplingValues[0], 10), sampleSetAddition: parseInt(SamplingValues[1], 10)};

                    this.hitObjects.push(circle);
                }
                // slider
                else if(values[3] == "2" || values[3] == "6") {
                    var sliderPoints = values[5].split("|");

                    var sliderType = sliderPoints[0];

                    var sliderSections = [];

                    var sliderSectionPoints = [];

                    var lastPoint = null;

                    for(var j = 1; j < sliderPoints.length; j++) {
                        var coords = sliderPoints[j].split(':');

                        if(j == 1) {
                            // add first point
                            sliderSectionPoints.push({x: parseInt(values[0], 10), y: parseInt(values[1], 10)});
                        }

                        var nextPoint = {x: parseInt(coords[0], 10), y: parseInt(coords[1], 10)};

                        sliderSectionPoints.push(nextPoint);

                        // end section if same point appears twice and start a new one if end is not reached
                        if(JSON.stringify(lastPoint) === JSON.stringify(nextPoint) || j + 1 == sliderPoints.length) {
                            if(sliderPoints.length == 3 && sliderSectionPoints.length == 3 && sliderType == "P") {
                                var sectionType = "circle";
                            }
                            else if(sliderSectionPoints.length == 2) {
                                var sectionType = "linear";
                            }
                            else {
                                var sectionType = "bezier";
                            }

                            sliderSections.push({type: sectionType, values: sliderSectionPoints});

                            sliderSectionPoints = [];
                            sliderSectionPoints.push(nextPoint);
                        }

                        lastPoint = nextPoint;
                    }

                    var slider = {
                        type: "slider",
                        newCombo: values[3] == "6",
                        x: parseInt(values[0], 10),
                        y: parseInt(values[1], 10),
                        time: parseInt(values[2], 10),
                        hitSound: parseInt(values[4], 10),
                        sections: sliderSections,
                        repeat: parseInt(values[6], 10),
                        length: parseFloat(values[7])
                    };

                    slider.startPoint = [slider.x, slider.y];

                    if(slider.repeat % 2 == 1) {
                        var lastSection = sliderSections[sliderSections.length - 1];
                        slider.basePoint = lastSection.values[lastSection.values.length - 1];
                    }
                    else {
                        slider.basePoint = slider.startPoint;
                    }

                    if(values.length > 8) {
                        // edgeAdditions
                        var additionsValuesRaw = values[8].split('|');

                        var additions = [];

                        for(var j = 0; j < additionsValuesRaw; j++) {
                            additions.push(parseInt(additionsValuesRaw[j], 10));
                        }

                        slider["additions"] = additions;

                        // edge samplings
                        var edgeSamplings = [];

                        if(values[9] != undefined) {
                            var splitEdgeSampleSetsRaw = values[9].split('|');
                        }
                        else {
                            var splitEdgeSampleSetsRaw = [];

                            for(var j = 0; j < sliderSections.length; j++) splitEdgeSampleSetsRaw.push("0:0");
                        }

                        for(var j = 0; j < splitEdgeSampleSetsRaw.length; j++) {
                            var val = splitEdgeSampleSetsRaw[j].split(':');

                            edgeSamplings.push({sampleSet: parseInt(val[0], 10), sampleSetAddition: parseInt(val[1], 10)});
                        }

                        slider["edgeSamplings"] = edgeSamplings;

                        // body samplings
                        if(values[10] != undefined) {
                            var sliderBodySamplingValues = values[10].split(':');
                        }
                        else {
                            var sliderBodySamplingValues = [0, 0];
                        }

                        slider["bodySamplings"] = {sampleSet: parseInt(sliderBodySamplingValues[0], 10), sampleSetAddition: parseInt(sliderBodySamplingValues[1], 10)};
                    }

                    this.hitObjects.push(slider);
                }
                // spinner
                else if(values[3] == "8" || values[3] == "12") {
                    var spinner = {
                        type: "spinner",
                        newCombo: values[3] == "12",
                        x: parseInt(values[0], 10),
                        y: parseInt(values[1], 10),
                        time: parseInt(values[2], 10),
                        hitSound: parseInt(values[4], 10),
                        endTime: parseInt(values[5], 10),
                    };

                    // samplings
                    if(values[6] != undefined) {
                        var SamplingValues = values[6].split(':');
                    }
                    else {
                        var SamplingValues = [0, 0];
                    }

                    spinner["samplings"] = {sampleSet: parseInt(SamplingValues[0], 10), sampleSetAddition: parseInt(SamplingValues[1], 10)};

                    this.hitObjects.push(spinner);
                }
            }
        }

        callback();
    }).bind(this);
    reader.readAsText(file);
}

Beatmap.prototype.getNextNonInheritedTimingPoint = function(num) {
    for(var i = num + 1; i < this.timingPoints.length; i++) {
        if(!this.timingPoints[i].inherited) return this.timingPoints[i];
    }

    return null;
}

function Play(beatmap, audio) {
    currentPlay = this;

    this.audio = audio;
    this.beatmap = beatmap;
    console.log(this.beatmap);

    this.cs = this.beatmap.CS;
    this.csPixel = Math.round((109 - 9 * this.cs) / osuweb.graphics.playAreaDimensions.x * width);
    this.halfCsPixel = this.csPixel / 2;

    this.arMs = 1800 - 120 * this.beatmap.AR;
    if (this.beatmap.AR > 5) {
        this.arMs = 1950 - 150 * this.beatmap.AR;
    }

    this.hitObjects = [];
    var zIndex = 1000000;
    var comboInfo = {
        comboNum: 0,
        n: 1
    }

    var lastStackEnd = 0;

    var clonedObjects = [];

    var stackLeniencyFrame = this.arMs * this.beatmap.stackLeniency;

    for (var i = 0; i < this.beatmap.hitObjects.length; i++) {
        var hitObject = clone(this.beatmap.hitObjects[i]);

        hitObject.stackShift = 0;

        for (var b = i - 1; b >= 0; b--) {
            var prev = clonedObjects[b];

            if (JSON.stringify(hitObject.startPoint) == JSON.stringify(prev.basePoint) && hitObject.time - prev.time <= stackLeniencyFrame) {
                hitObject.stackParent = prev;

                var isSlider = hitObject.type == "slider";
                var firstSliderIndex = -1;

                var currentChild = hitObject;

                var childList = [];

                while (currentChild.stackParent != undefined) {
                    currentChild = currentChild.stackParent;

                    childList.push(currentChild);

                    if(currentChild.type == "slider" && firstSliderIndex == -1) firstSliderIndex = childList.length - 1;
                }

                console.log(childList);

                if(firstSliderIndex == -1) {
                    childList.forEach(function(curr, index, array) {curr.stackShift -= 4});
                }
                else {
                    if(isSlider) {
                        childList.forEach(function(curr, index, array) {curr.stackShift -= 4 * ((childList.length - 1) - firstSliderIndex)});
                    }
                    else {
                        childList.forEach(function(curr, index, array) {curr.stackShift += 4});
                    }
                }

                break;
            }
            else if (hitObject.time - prev.time > stackLeniencyFrame) {
                break;
            }
        }

        clonedObjects.push(hitObject);

        /*
         var nextStackObject = (function(hitObj, hitObjNum) {
         if(hitObj.stackMoved) return null;

         for(var b = 1;;b++) {
         var next = this.beatmap.hitObjects[hitObjNum + b];

         if(next == undefined) return null;

         if(JSON.stringify(hitObj.basePoint) == JSON.stringify(next.startPoint) && next.time - hitObj.time <= stackLeniencyFrame && !hitObj.stackMoved) {
         return nextStackObject;
         }
         else if(next.time - hitObj.time > stackLeniencyFrame) {
         break;
         }
         }

         return null;
         }).bind(this);

         var stackObj = nextStackObject(hitObject, i);

         // Stacks
         if(i >= lastStackEnd && hitObject.type != "spinner" && stackObj != undefined && stackObj.type != "spinner" && JSON.stringify(stackObj.startPoint) == JSON.stringify(hitObject.basePoint)) {
         var stackDepth = 0;

         var stackElements = [hitObject];

         var lastObject = hitObject;

         var lastSlider = hitObject.type == "slider" ? 0 : -1;

         while(nextStackObject(lastObj, i + stackDepth).type != "spinner") {
         var nextObject = nextStackObject(lastObject, i + stackDepth);

         if(JSON.stringify(lastObject.basePoint) == JSON.stringify(nextObject.startPoint)) {
         stackDepth++;

         stackElements.push(nextObject);

         lastObject = nextObject;

         if(nextObject.type == "slider") lastSlider = stackDepth;

         if(i + 1 + stackDepth == this.beatmap.hitObjects.length - 1) break;
         }
         else {
         break;
         }
         }

         lastStackEnd = i + 1 + stackDepth;

         if(lastSlider == -1 || lastSlider + 1 == stackElements.length) {
         for(var j = stackElements.length - 1; j >= 0; j--) {
         stackElements[j].x -= 4 * ((stackElements.length - 1) - j);
         stackElements[j].y -= 4 * ((stackElements.length - 1) - j);
         stackElements[j].stackMoved = true;
         }
         }
         else {
         var beforeLastSliderStack = stackElements.slice(0, lastSlider + 1);
         var afterLastSliderStack = stackElements.slice(lastSlider, stackElements.length);

         for(var j = beforeLastSliderStack.length - 1; j >= 0; j--) {
         beforeLastSliderStack[j].x -= 4 * ((beforeLastSliderStack.length - 1) - j);
         beforeLastSliderStack[j].y -= 4 * ((beforeLastSliderStack.length - 1) - j);
         beforeLastSliderStack[j].stackMoved = true;
         }

         for(var h = 0; h < afterLastSliderStack.length; h++) {
         afterLastSliderStack[h].x += 4 * afterLastSliderStack.length;
         afterLastSliderStack[h].y += 4 * afterLastSliderStack.length;
         afterLastSliderStack[h].stackMoved = true;
         }
         }
         }
         */
    }

    for (var o = 0; o < clonedObjects.length; o++) {
        var obj = clonedObjects[o];

        if(obj.stackShift != 0) console.log(obj);

        if (obj.newCombo) {
            comboInfo.comboNum++;
            comboInfo.n = 1;
        }

        if (obj.type == "circle") {
            var newObject = new Circle(obj, zIndex, comboInfo);
        } else if (obj.type == "slider") {
            var newObject = new Slider(obj, zIndex, comboInfo);
        }

        newObject.append();
        this.hitObjects.push(newObject);
        zIndex--;
        comboInfo.n++;
    }
    console.log(this.hitObjects);

    this.audioStartTime = null;
    this.audioCurrentTime = 0;
    this.metronome = null;
    this.nextMetronome = null;
    this.metronomeRunning = false;
    this.audioStarted = false;

    this.currentTimingPoint = 1;
    this.lastNonInheritedTimingPointMs = null;
    this.currentMsPerBeat = null;
    this.currentMsPerBeatMultiplier = 100;

    this.currentHitObject = 0;

    this.tickClock = function() {
        this.audioCurrentTime = window.performance.now() - this.audioStartTime - 2000;
        document.getElementById("timeDisplay").innerHTML = (this.audioCurrentTime / 1000).toFixed(2);

        if (this.audioCurrentTime >= 0 && !this.audioStarted) {
            currentAudio.playAudio(0);
            this.audioStarted = true;
        }

        if (this.currentTimingPoint < this.beatmap.timingPoints.length) {
            while (this.beatmap.timingPoints[this.currentTimingPoint].offset <= this.audioCurrentTime) {
                var timingPoint = this.beatmap.timingPoints[this.currentTimingPoint];

                if (timingPoint.inherited) {
                    this.currentMsPerBeatMultiplier = -timingPoint.msPerBeat;
                } else {
                    this.currentMsPerBeat = timingPoint.msPerBeat;
                    this.lastNonInheritedTimingPointMs = timingPoint.offset;
                }

                this.currentTimingPoint++;

                if (this.currentTimingPoint == this.beatmap.timingPoints.length) {
                    break;
                }
            }
        }

        if (this.currentHitObject < this.hitObjects.length) {
            while (this.hitObjects[this.currentHitObject].time - this.arMs <= this.audioCurrentTime) {
                var hitObject = this.hitObjects[this.currentHitObject];

                hitObject.show(this.audioCurrentTime - (this.hitObjects[this.currentHitObject].time - this.arMs));

                this.currentHitObject++;

                if (this.currentHitObject == this.hitObjects.length) {
                    break;
                }
            }
        }



    }.bind(this);



    /*this.loop = new interval(1, (function() {
        var time = osuweb.util.getHighResolutionContextTime();

        if(this.audioStartTime <= time) {
            this.audioCurrentTime = time - this.audioStartTime;

            var nextNonInheritedTimingPoint = this.beatmap.getNextNonInheritedTimingPoint(this.currentTimingPoint);

            if(this.nextMetronome == null && nextNonInheritedTimingPoint != null) {
                this.nextMetronome = new interval(nextNonInheritedTimingPoint.msPerBeat, this.metronomeTick.bind(this), this.audioStartTime + nextNonInheritedTimingPoint.offset);
            }

            if(this.metronome != null && !this.metronomeRunning && this.audioCurrentTime >= this.metronomeStart) {
                this.metronome.run();
                this.metronomeRunning = true;
            }

            else if(nextNonInheritedTimingPoint != null) {
                if(nextNonInheritedTimingPoint.offset <= this.audioCurrentTime) {
                    this.currentTimingPoint = nextNonInheritedTimingPoint.index;
                    this.currentMsPerBeat = nextNonInheritedTimingPoint.msPerBeat;
                    console.log("MsPerBeat: "+this.currentMsPerBeat);

                    this.metronome.stop();
                    this.metronome = this.nextMetronome;
                    this.nextMetronome = null;
                    this.metronome.run();
                }
            }
        }
    }).bind(this));*/
}

Play.prototype.metronomeTick = function() {
    currentSkin.skinElements["normal-hitnormal"].playAudio(0);
}

Play.prototype.start = function() {
    // stop running song
    if(currentAudio != null) {
        if(currentAudio.isRunning()) currentAudio.stop();
        currentAudio = null;
    }

    this.currentMsPerBeat = this.beatmap.timingPoints[0].msPerBeat;
    this.lastNonInheritedTimingPointMs = this.beatmap.timingPoints[0].offset;

    this.audioStartTime = window.performance.now();
    setInterval(this.tickClock);
    currentAudio = this.audio;

    // metronome start
    /*this.metronomeStart = this.beatmap.timingPoints[0].offset
    this.currentMsPerBeat = parseFloat(this.beatmap.timingPoints[0].msPerBeat);
    console.log("MsPerBeat: "+this.currentMsPerBeat);

    this.metronome = new interval(this.currentMsPerBeat, this.metronomeTick.bind(this));

    this.audioStartTime = this.beatmap.audioLeadIn + osuweb.util.getHighResolutionContextTime();

    currentAudio = this.audio;
    this.audio.playAudio(0);

    this.loop.run();*/
}

function Audio(arrayBuffer, callback, bufferCount) {
    this.gainNode = audioCtx.createGain();
    this.gainNode.connect(audioCtx.destination);
    this.buffer = null;
    this.duration = arrayBuffer.duration;
    this.creationCallback = callback;

    if(bufferCount == undefined) bufferCount = 2;
    this.sourceNodes = new Array(bufferCount);
    this.currentNodeNumber = -1;
    this.nextNodeNumber = 0;

    audioCtx.decodeAudioData(arrayBuffer, (function(buffer) {
        this.buffer = buffer;
        this.duration = buffer.duration;

        for(var i = 0; i < bufferCount; i++) {
            this.createNode(i);
        }
    }).bind(this), this.onError);
}

Audio.prototype.createNode = function(index) {
    var i = index;

    this.sourceNodes[index] = audioCtx.createBufferSource();
    this.sourceNodes[index].buffer = this.buffer;
    // Recreate node on end
    this.sourceNodes[index].onended = (function(e) {
        this.currentNodeNumber = -1;
        this.sourceNodes[index].disconnect();
        this.createNode(i);
    }).bind(this);

    if(this.creationCallback != undefined && this.creationCallback != null) {
        this.creationCallback();

        this.creationCallback = null;
    }
}

Audio.prototype.isRunning = function() {
    return this.currentNodeNumber != -1;
}

Audio.prototype.playAudio = function(time) {
    if (time == undefined) time = 0;

    this.playAudioFromOffset(0, time);
}

Audio.prototype.playAudioFromOffset = function(time, offset) {
    this.playAudioFromOffsetWithLoop(time, offset, -1, -1);
}

Audio.prototype.playAudioFromOffsetWithLoop = function(time, offset, loopStart, loopEnd) {
    var enableLoop = false;

    if(loopStart != undefined && loopStart != -1) {
        this.sourceNodes[this.nextNodeNumber].loopStart = loopStart;
        enableLoop = true;
    }
    if(loopEnd != undefined && loopEnd != -1) {
        this.sourceNodes[this.nextNodeNumber].loopEnd = loopEnd;
        enableLoop = true;
    }

    this.sourceNodes[this.nextNodeNumber].loop = enableLoop;

    this.sourceNodes[this.nextNodeNumber].connect(this.gainNode);
    this.sourceNodes[this.nextNodeNumber].start(time, Math.max(offset, 0));

    this.currentNodeNumber = this.nextNodeNumber++;
    this.nextNodeNumber %= this.sourceNodes.length;
}

Audio.prototype.stop = function(time) {
    if (time == undefined) time = 0;

    if(this.currentNodeNumber >= 0) {
        this.sourceNodes[this.currentNodeNumber].stop(time);
        this.sourceNodes[this.currentNodeNumber].disconnect();
    }
}

Audio.prototype.setVolume = function(value) {
    this.gainNode.value = value;
}

Audio.prototype.onError = function(err) {

}

function Skin(oskOrDirectory) {
    this.skinElements = {};

    if (Object.prototype.toString.call(oskOrDirectory) === '[object Array]') {
        alert('Array!');
    }
    // We're getting a skin file bois!
    else {
        zip.loadAsync(oskOrDirectory).then((function (zip) {
            for(var key in zip.files) {
                // Get our keyname from filename
                let rawFileName = key.replace(/\.[^/.]+$/, "");

                // Determine how to read this entry
                var output = "string";

                if(key.endsWith(".mp3") || key.endsWith(".ogg") || key.endsWith(".wav")) output = "arraybuffer";
                if(key.endsWith(".jpg") || key.endsWith(".jpeg") || key.endsWith(".png") || key.endsWith(".gif")) output = "base64";

                zip.file(key).async(output).then((function(result) {
                    if(output == "arraybuffer") {
                        try {
                            if(result.byteLength > 0) {
                                this.skinElements[rawFileName] = new Audio(result, function(){}, 5);
                            }
                        }
                        catch(e) {
                            console.log(rawFileName);
                        }
                    }
                    else {
                        this.skinElements[rawFileName] = result;
                    }
                }).bind(this), (function(fuckme) {
                    console.log(fuckme);
                }).bind(this));
            }
        }).bind(this));
    }
}

function interval(duration, fn, baseline){
    this.baseline = baseline

    this.run = function(){
        if(this.baseline === undefined){
            this.baseline = osuweb.util.getHighResolutionContextTime();
        }
        fn();
        var end = osuweb.util.getHighResolutionContextTime();
        this.baseline += duration

        var nextTick = duration - (end - this.baseline);
        if(nextTick<0){
            nextTick = 0
        }
        (function(i){
            i.timer = setTimeout(function(){
                i.run(end)
            }, nextTick)
        })(this)
    }

    this.stop = function(){
        clearTimeout(this.timer)
    }
}

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

// attach the .equals method to Array's prototype to call it on any array
Array.prototype.equals = function (array) {
    // if the other array is a falsy value, return
    if (!array)
        return false;

    // compare lengths - can save a lot of time
    if (this.length != array.length)
        return false;

    for (var i = 0, l=this.length; i < l; i++) {
        // Check if we have nested arrays
        if (this[i] instanceof Array && array[i] instanceof Array) {
            // recurse into the nested arrays
            if (!this[i].equals(array[i]))
                return false;
        }
        else if (this[i] != array[i]) {
            // Warning - two different object instances will never be equal: {x:20} != {x:20}
            return false;
        }
    }
    return true;
}
// Hide method from for-in loops
Object.defineProperty(Array.prototype, "equals", {enumerable: false});

/*osuweb.graphics.skin.prototype.constructor = function(filePath) {

}*/
