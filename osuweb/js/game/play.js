function Play(beatmap, audio) {
    currentPlay = this;

    this.audio = audio;
    this.beatmap = beatmap;
    console.log(this.beatmap);

    this.playAreaHeight = Math.floor(window.innerHeight * 0.95 / 4) * 4;
    this.playAreaWidth = this.playAreaHeight / GraphicUtil.widthToHeightRatio;
    currentScene.playareaCanvas.style.height = this.playAreaHeight;
    currentScene.playareaCanvas.style.width = this.playAreaWidth;

    this.pixelRatio = this.playAreaWidth / GraphicUtil.playAreaDimensions.x;
    this.marginWidth = (GraphicUtil.playAreaDimensions.x - GraphicUtil.coordinateDimensions.x) / 2;
    this.marginHeight = this.marginWidth * GraphicUtil.widthToHeightRatio;

    this.csPixel = Math.round((109 - 9 * this.beatmap.CS) / GraphicUtil.playAreaDimensions.x * this.playAreaWidth);
    this.halfCsPixel = this.csPixel / 2;

    this.ARMs = TimingUtil.getMsFromAR(this.beatmap.AR);

    this.hitObjects = [];
    this.followPoints = [];
    var hitObjectId = 0;

    var currentTimingPoint = 1;
    var currentMsPerBeat = this.beatmap.timingPoints[0].msPerBeat;
    var currentMsPerBeatMultiplier = 100;

    var comboCount = 1;
    var nextCombo = 0;

    var mapGenerationStartTime = window.performance.now();

    for (var o = 0; o < this.beatmap.hitObjects.length; o++) {
        var obj = this.beatmap.hitObjects[o];

        if(obj.newCombo != null) {
            if (obj.newCombo == -1) {
                nextCombo++;
            }
            else {
                nextCombo += obj.newCombo + 1;
            }
            comboCount = 1;
        }
        var comboInfo = {
            comboNum: nextCombo,
            n: comboCount++
        };

        if (currentTimingPoint < this.beatmap.timingPoints.length) {
            while (this.beatmap.timingPoints[currentTimingPoint].offset <= obj.time) {
                var timingPoint = this.beatmap.timingPoints[currentTimingPoint];

                if (timingPoint.inherited) {
                    currentMsPerBeatMultiplier = -timingPoint.msPerBeat;
                } else {
                    currentMsPerBeatMultiplier = 100;
                    currentMsPerBeat = timingPoint.msPerBeat;
                }

                currentTimingPoint++;

                if (currentTimingPoint == this.beatmap.timingPoints.length) {
                    break;
                }
            }
        }

        var newObject = null;

        if (obj.type == "circle") {
            var newObject = new Circle(obj);
        } else if (obj.type == "slider") {
            var newObject = new Slider(obj);

            var timingInfo = {
                msPerBeat: currentMsPerBeat,
                msPerBeatMultiplier: currentMsPerBeatMultiplier,
                sliderVelocity: 100 * currentPlay.beatmap.SV / (currentMsPerBeat * (currentMsPerBeatMultiplier / 100))
            };
            var sliderTickCompletions = [];

            for (var tickCompletion = 0; tickCompletion < newObject.repeat; tickCompletion += (timingInfo.sliderVelocity * (timingInfo.msPerBeat / currentPlay.beatmap.sliderTickRate)) / newObject.length) {
                var t = Math.round(MathUtil.reflect(tickCompletion) * 10000) / 10000; // Rounding to get fucking actual values that make sense

                if (t > 0 && t < 1) {
                    sliderTickCompletions.push(tickCompletion);
                }
            }

            newObject.endTime = newObject.time + newObject.repeat * newObject.length / timingInfo.sliderVelocity;
            newObject.timingInfo = timingInfo;
            newObject.sliderTickCompletions = sliderTickCompletions;
        } else {
            console.log(obj.type);
        }

        if (newObject != null) {
            newObject.id = hitObjectId;
            newObject.comboInfo = comboInfo;
            this.hitObjects.push(newObject);
        }

        hitObjectId++;
    }

    for (var i = 1; i < this.hitObjects.length; i++) {
        var prevObj = this.hitObjects[i - 1], currObj = this.hitObjects[i];
        if (prevObj.comboInfo.comboNum == currObj.comboInfo.comboNum && prevObj.comboInfo.n != currObj.comboInfo.n) {
            this.followPoints.push(new FollowPoint(prevObj, currObj));
        }
    }

    var zIndexBase = 1000000;
    var zIndexSortedArray = this.hitObjects.slice(0).sort(function(a, b) {
        if (Math.round(a.endTime) != Math.round(b.endTime)) {
            return Math.round(a.endTime) - Math.round(b.endTime);
        } else {
            return b.time - a.time;
        }
    });
    for (var i = 0; i < zIndexSortedArray.length; i++) {
        zIndexSortedArray[i].zIndex = zIndexBase - i;
    }

    this.applyStackShift();

    for(var z = 0; z < this.hitObjects.length; z++) {
        this.hitObjects[z].updateStackPosition();
        this.hitObjects[z].draw();
    }

    console.info("Map build time: " + (window.performance.now() - mapGenerationStartTime).toFixed(2) + "ms", this.hitObjects);

    this.audioStartTime = null;
    this.audioCurrentTime = 0;
    this.audioOffset = -2000;
    this.metronome = null;
    this.nextMetronome = null;
    this.metronomeRunning = false;
    this.audioStarted = false;

    this.currentHitObject = 0;
    this.lastAppendedHitObject = 0;
    this.currentFollowPoint = 0;
    this.onScreenHitObjects = {};

    this.inBreak = true;
    this.startBreak = true;
    this.nextBreak = null;

    // Debug variables
    this.lastTickClockTime = window.performance.now();
    this.recordedTickSpeeds = [];
    this.stupidClock = window.performance.now();
}

Play.prototype.gameLoop = function() {
    ///// DEBUG /////
    var timeDif = window.performance.now() - this.lastTickClockTime;
    this.recordedTickSpeeds.push(timeDif);
    if (timeDif > 10) {
        console.warn("Slow clock: " + timeDif.toFixed(2) + "ms since last execution!");
    }
    this.lastTickClockTime = window.performance.now();
    if (window.performance.now() - this.stupidClock > 2000) {
        var sum = 0;
        for (var i = 0; i < this.recordedTickSpeeds.length; i++) {
            sum += this.recordedTickSpeeds[i];
        }
        console.log("Current average clock tick speed: " + (sum / this.recordedTickSpeeds.length).toFixed(2) + "ms / " + (1000 / (sum / this.recordedTickSpeeds.length)).toFixed(2) + "Hz");
        this.stupidClock = window.performance.now();
    }
    ///// DEBUG END ///// 

    this.audioCurrentTime = window.performance.now() - this.audioStartTime + this.audioOffset;

    // Starts the song
    if (this.audioCurrentTime >= 0 && !this.audioStarted) {
        console.log("Audio start offset: " + this.audioCurrentTime.toFixed(2) + "ms");
        currentAudio.playAudio(this.audioCurrentTime / 1000);
        this.audioStarted = true;
    }

    // hitObject updates
    for (var id in this.onScreenHitObjects) {
        var hitObject = this.onScreenHitObjects[id];

        if (hitObject.type == "circle") {
            if (this.audioCurrentTime >= hitObject.time && !hitObject.hitCircleExploded) {
                hitObject.containerDiv.style.animation = "0.15s destroyHitCircle linear forwards";
                hitObject.approachCircleCanvas.style.display = "none";
                hitObject.hitCircleExploded = true;
            }

            if (this.audioCurrentTime >= hitObject.time + 200) {
                hitObject.remove();
                delete this.onScreenHitObjects[id];
                continue;
            }
        } else if (hitObject.type == "slider") {
            if (this.audioCurrentTime >= hitObject.time && !hitObject.hitCircleExploded) {
                hitObject.sliderHeadContainer.style.animation = "0.15s destroyHitCircle linear forwards";
                hitObject.approachCircleCanvas.style.display = "none";
                hitObject.hitCircleExploded = true;
            }

            if (this.audioCurrentTime >= hitObject.endTime && !hitObject.fadingOut) {
                hitObject.containerDiv.style.animation = "0.15s sliderFadeOut linear forwards";
                hitObject.fadingOut = true;
            }

            if (this.audioCurrentTime >= hitObject.endTime + 200) {
                hitObject.remove();
                delete this.onScreenHitObjects[id];
                continue;
            }

            if (hitObject.sliderTickCompletions[hitObject.currentSliderTick] != undefined) {
                var completion = hitObject.timingInfo.sliderVelocity * (this.audioCurrentTime - hitObject.time) / hitObject.length;

                while (completion >= hitObject.sliderTickCompletions[hitObject.currentSliderTick]) {
                    hitObject.currentSliderTick++;
                }
            }

        }
    }

    // Handles breaks
    if(this.audioCurrentTime > this.hitObjects[0].time - 1500 && this.startBreak) {
        document.getElementById("background-dim").style.opacity = "0.8";
        this.inBreak = false;
        this.startBreak = false;
    }
    else if (this.hitObjects[this.hitObjects.length - 1].endTime - this.audioCurrentTime < -300) {
        document.getElementById("background-dim").style.opacity = "0";
        this.inBreak = true;
    }
    else {
        if(this.nextBreak == null) {
            for(var ii = 0; ii < this.beatmap.events.length; ii++) {
                if(this.beatmap.events[ii].type != "break") continue;

                if(this.beatmap.events[ii].start > this.audioCurrentTime) {
                    if(this.nextBreak != null && this.nextBreak.start > this.beatmap.events[ii].start) {
                        this.nextBreak = this.beatmap.events[ii];
                    }
                    else {
                        this.nextBreak = this.beatmap.events[ii];
                    }
                }
            }
        }

        if (this.inBreak && this.nextBreak != null && this.audioCurrentTime > this.nextBreak.end) {
            document.getElementById("background-dim").style.opacity = "0.8";
            this.inBreak = false;
            this.nextBreak = null;
        }
        else if(!this.inBreak && this.nextBreak != null && this.audioCurrentTime > this.nextBreak.start) {
            document.getElementById("background-dim").style.opacity = "0";
            this.inBreak = true;
        }
    }

    // Makes hitObjects show up on-screen
    if (this.currentHitObject < this.hitObjects.length) {
        while (this.hitObjects[this.currentHitObject].time - this.ARMs <= this.audioCurrentTime) {
            var hitObject = this.hitObjects[this.currentHitObject];

            hitObject.show(this.audioCurrentTime - (this.hitObjects[this.currentHitObject].time - this.ARMs));
            this.onScreenHitObjects[hitObject.id] = hitObject;

            this.currentHitObject++;

            if (this.currentHitObject == this.hitObjects.length) {
                break;
            }
        }
    }

    // Makes follow points show up on-screen
    if (this.currentFollowPoint < this.followPoints.length) {
        while (this.followPoints[this.currentFollowPoint].startTime - 450 <= this.audioCurrentTime) {
            this.followPoints[this.currentFollowPoint].spawn();

            this.currentFollowPoint++;

            if (this.currentFollowPoint == this.followPoints.length) {
                break;
            }
        }
    }

    // Appends upcoming hitObjects to the playarea
    while (this.hitObjects.length > this.lastAppendedHitObject && this.lastAppendedHitObject - this.currentHitObject < 1) {
        var nextTime = this.hitObjects[this.lastAppendedHitObject].time;

        while (this.hitObjects.length > this.lastAppendedHitObject && this.hitObjects[this.lastAppendedHitObject].time <= nextTime) {
            this.hitObjects[this.lastAppendedHitObject].append.bind(this.hitObjects[this.lastAppendedHitObject])();
            this.lastAppendedHitObject++;
        }
    }

    setTimeout(this.gameLoop.bind(this));
};

Play.prototype.applyStackShift = function() {
    var lastStackEnd = 0;
    var stackThreshold = this.ARMs * this.beatmap.stackLeniency;
    var stackSnapDistance = 3;

    var extendedEndIndex = this.hitObjects.length - 1;
    for (var i = this.hitObjects.length - 1; i >= 0; i--) {
        var hitObject = this.hitObjects[i];

        var stackBaseIndex = i;
        for (var b = i +1; b < this.hitObjects.length; b++) {
            var objectB = this.hitObjects[b];
            var stackBaseObject = this.hitObjects[i];

            if(stackBaseObject.type == "spinner") break;
            if(objectB.type == "spinner") continue;

            var endTime = stackBaseObject.endTime;

            if(objectB.time - endTime > stackThreshold) break;

            if(Math.hypot(stackBaseObject.startPoint.x - objectB.startPoint.x, stackBaseObject.startPoint.y - objectB.startPoint.y) < stackSnapDistance ||
               stackBaseObject.type == "slider" && MathUtil.distance(stackBaseObject.basePoint, objectB.startPoint) < stackSnapDistance) {
                stackBaseIndex = b;

                objectB.stackHeight = 0;
            }
        }

        if (stackBaseIndex > extendedEndIndex)
        {
            extendedEndIndex = stackBaseIndex;
            if (extendedEndIndex == beatmap.HitObjects.Count - 1)
                break;
        }
    }

    var extendedStartIndex = 0;
    for (var i = extendedEndIndex; i > 0; i--) {
        var n = i;

        var objectI = this.hitObjects[i];
        if (objectI.stackHeight != 0 || objectI.type == "spinner") continue;
        if (objectI.type == "circle") {
            while (--n >= 0) {
                var objectN = this.hitObjects[n];
                if (objectN.type == "spinner") continue;

                var endTime = objectN.endTime;

                if (objectI.time - endTime > stackThreshold)
                    break;

                if (n < extendedStartIndex) {
                    objectN.stackHeight = 0;
                    extendedStartIndex = n;
                }

                if (objectN.type == "slider" && MathUtil.distance(objectN.basePoint, objectI.startPoint) < stackSnapDistance)
                {
                    var offset = objectI.stackHeight - objectN.stackHeight + 1;

                    for (var j = n + 1; j <= i; j++) {
                        var objectJ = this.hitObjects[j];
                        if (MathUtil.distance(objectN.basePoint, objectJ.startPoint) < stackSnapDistance)
                            objectJ.stackHeight -= offset;
                    }
                    break;
                }

                if (MathUtil.distance(objectN.startPoint, objectI.startPoint) < stackSnapDistance) {
                    objectN.stackHeight = objectI.stackHeight + 1;
                    objectI = objectN;
                }
            }
        }
        else if (objectI.type == "slider") {
            while (--n >= 0) {
                var objectN = this.hitObjects[n];

                if (objectN.type == "spinner") continue;

                if (objectI.time - objectN.time > stackThreshold)
                    break;

                if (MathUtil.distance(objectN.basePoint, objectI.startPoint) < stackSnapDistance) {
                    objectN.stackHeight = objectI.stackHeight + 1;
                    objectI = objectN;
                }
            }
        }
    }
};

Play.prototype.start = function() {
    // stop running song
    if(currentAudio != null) {
        if(currentAudio.isRunning()) currentAudio.stop();
        currentAudio = null;
    }

    this.audioStartTime = window.performance.now();
    this.gameLoop.bind(this)();
    currentAudio = this.audio;
};