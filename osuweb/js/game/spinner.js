function Spinner(data) {
    HitObject.call(this, data);
    this.basePoint = {
        x: 256,
        y: 192
    };
    this.type = "spinner";
    this.endTime = data.endTime;

    this.duration = this.endTime - this.time;
    this.requiredSpins = (100 + currentPlay.beatmap.OD * 15) * this.duration / 60000 * 0.88; // This shit's approximate af. But I mean it's ppy.
    this.active = false;
    this.cleared = false;
    this.completed = false;
    this.absoluteDegreesRotated = 0;
    this.totalDegreesRotated = 0;
    this.completedSpins = 0;
    this.completedBonusSpins = 0;
    this.SPMSamples = [0];
    this.lastTimeSampled = null;
    this.readyForSound = false;
}

Spinner.prototype = Object.create(HitObject.prototype);
Spinner.prototype.constructor = Spinner;

Spinner.prototype.remove = function() {
    currentScene.elements["spinnerContainerContainer"].removeChild(this.containerDiv);
};

Spinner.prototype.append = function() {
    currentScene.elements["spinnerContainerContainer"].appendChild(this.containerDiv);
};

Spinner.prototype.show = function() {
    this.containerDiv.style.visibility = "visible";
    this.containerDiv.style.transition = "opacity 0.35s linear";
    this.containerDiv.style.opacity = 1;

    this.update();
};

Spinner.prototype.update = function() {
    var accurateCurrentTime = window.performance.now() - currentPlay.audioStartTime + currentPlay.audioOffset;
    var completion = (accurateCurrentTime - this.time) / this.duration;

    if (accurateCurrentTime >= this.time && accurateCurrentTime < this.endTime) {
        var currentAngle = Math.atan2(inputData.userPlayfieldCoords.y - 192, inputData.userPlayfieldCoords.x - 256);
        var angleDifference = 0;
        var now = window.performance.now();
        var timeDifference = now - this.lastTimeSampled;

        if (this.lastPoint != undefined && inputData.isHolding) {
            var angleFromLastPoint = Math.atan2(inputData.userPlayfieldCoords.y - this.lastPoint.y, inputData.userPlayfieldCoords.x - this.lastPoint.x);
            var optimalAngle = Math.atan2(Math.sin(currentAngle) - Math.sin(this.lastAngle), Math.cos(currentAngle) - Math.cos(this.lastAngle));
            var angleDifference = MathUtil.getNormalizedAngleDelta(currentAngle, this.lastAngle);
            var circularInaccuracy = MathUtil.getNormalizedAngleDelta(angleFromLastPoint, optimalAngle);
            var pheta = MathUtil.getNormalizedAngleDelta(currentAngle, optimalAngle); // angle between mousePos, center point and optimalAngle
            var circularCorrectness = 1 - Math.abs(circularInaccuracy) / Math.abs(pheta) * 0.15 /* less punishment */;

            angleDifference *= circularCorrectness;

            this.absoluteDegreesRotated += Math.abs(angleDifference);
            this.totalDegreesRotated += angleDifference;

            if (angleDifference && this.readyForSound) {
                var skin = currentSkin || defaultSkin;
                var audioObj = skin.skinElements["spinnerspin"];

                audioObj.playAudio();
                audioObj.setVolume(this.hitSoundInfo.volume);

                this.readyForSound = false;
            }
        }

        this.SPMSamples.push(Math.min(477 /* ;^) */, Math.abs((angleDifference / (Math.PI * 2)) / timeDifference) * 60000));
        if (this.SPMSamples.length > 12) {
            this.SPMSamples.splice(0, 1);
        }

        this.lastTimeSampled = now;
        this.lastPoint = inputData.userPlayfieldCoords;
        this.lastAngle = currentAngle;

        this.updateApproachCircle(Math.max(0, 1 - completion));
        this.circleElement.style.transform = "translate(-50%, -50%) rotate(" + this.totalDegreesRotated + "rad)";
        this.spmDisplay.innerHTML = "SPM: " + Math.ceil(this.SPMSamples.getAvg());
    }

    if (completion < 1) { // CANCER IDK WHAT'S GOING ON
        requestAnimationFrame(this.update.bind(this));
    }
};

Spinner.prototype.clear = function() {
    this.cleared = true;
    this.hasBeenClearedDisplay.style.opacity = 1;
};

Spinner.prototype.scoreBonusSpin = function() {
    var newCompletedBonusSpins = Math.floor((this.absoluteDegreesRotated - this.requiredSpins * Math.PI * 2) / (Math.PI * 2));
    currentPlay.score.addScore((newCompletedBonusSpins - this.completedBonusSpins) * 1000, true, true);
    this.completedBonusSpins = newCompletedBonusSpins;
    this.bonusSpinsCounter.innerHTML = newCompletedBonusSpins * 1000;
    this.bonusSpinsCounter.style.animation = "none";
    this.bonusSpinsCounter.offsetWidth;
    this.bonusSpinsCounter.style.animation = "0.15s increaseSpinnerBonus ease-out forwards";

    var skin = currentSkin || defaultSkin;
    var audioObj = skin.skinElements["spinnerbonus"];

    audioObj.playAudio();
    audioObj.setVolume(this.hitSoundInfo.volume);
};

Spinner.prototype.score = function() {
    var spinsSpinned = this.absoluteDegreesRotated / (Math.PI * 2);

    if (spinsSpinned < this.requiredSpins) {
        currentPlay.score.addScore(0, false, true, this);
    } else {
        this.playHitSound(this.hitSoundInfo);

        currentPlay.score.addScore((function() {
            if (spinsSpinned >= this.requiredSpins + 0.5) {
                return 300;
            } else if (spinsSpinned >= this.requiredSpins + 0.25) {
                return 100;
            } else {
                return 50;
            }
        }.bind(this)()), false, false, this);
    }
};

Spinner.prototype.draw = function() {
    this.containerDiv = document.createElement("div");
    this.containerDiv.className = "spinnerContainer";
    this.containerDiv.style.visibility = "hidden";
    this.containerDiv.style.opacity = 0;

    this.circleElement = document.createElement("canvas");
    this.circleElement.setAttribute("width", 70 * pixelRatio);
    this.circleElement.setAttribute("height", 70 * pixelRatio);
    this.circleElement.className = "center";

    var circleCtx = this.circleElement.getContext("2d");

    circleCtx.arc(35 * pixelRatio, 35 * pixelRatio, 30 * pixelRatio, -Math.PI * 0.75, -Math.PI * 0.25);
    circleCtx.lineWidth = 10 * pixelRatio;
    circleCtx.strokeStyle = "white";
    circleCtx.stroke();

    circleCtx.beginPath();
    circleCtx.arc(35 * pixelRatio, 35 * pixelRatio, 5 * pixelRatio, 0, pi2);
    circleCtx.fillStyle = "white";
    circleCtx.fill();

    this.containerDiv.appendChild(this.circleElement);

    this.approachCircleElement = document.createElement("canvas");
    this.approachCircleElement.setAttribute("width", 400 * pixelRatio);
    this.approachCircleElement.setAttribute("height", 400 * pixelRatio);
    this.approachCircleElement.className = "center";

    var approachCircleCtx = this.approachCircleElement.getContext("2d");

    this.updateApproachCircle = function(scalar) {
        approachCircleCtx.clearRect(0, 0, 400 * pixelRatio, 400 * pixelRatio);
        approachCircleCtx.beginPath();
        approachCircleCtx.arc(200 * pixelRatio, 200 * pixelRatio, 195 * pixelRatio * scalar, 0, pi2);
        approachCircleCtx.lineWidth = 5 * pixelRatio * scalar;
        approachCircleCtx.strokeStyle = "white";
        approachCircleCtx.stroke();
    };
    this.updateApproachCircle(1);
    this.containerDiv.appendChild(this.approachCircleElement);

    var spinnerTitle = document.createElement("h1");
    spinnerTitle.innerHTML = "Spin!";
    spinnerTitle.style.fontSize = 35 * pixelRatio + "px";
    spinnerTitle.style.bottom = 80 * pixelRatio + "px";
    this.containerDiv.appendChild(spinnerTitle);

    this.hasBeenClearedDisplay = document.createElement("h1");
    this.hasBeenClearedDisplay.innerHTML = "Clear!";
    this.hasBeenClearedDisplay.style.fontSize = 31 * pixelRatio + "px";
    this.hasBeenClearedDisplay.style.top = 125 * pixelRatio + "px";
    this.hasBeenClearedDisplay.style.opacity = 0;
    this.hasBeenClearedDisplay.style.transition = "opacity 0.4s";
    this.containerDiv.appendChild(this.hasBeenClearedDisplay);

    this.bonusSpinsCounter = document.createElement("h1");
    this.bonusSpinsCounter.style.fontSize = 50 * pixelRatio + "px";
    this.bonusSpinsCounter.style.fontFamily = "monospace";
    this.bonusSpinsCounter.style.bottom = 120 * pixelRatio + "px";
    this.bonusSpinsCounter.style.fontWeight = 100;
    this.containerDiv.appendChild(this.bonusSpinsCounter);

    this.spmContainer = document.createElement("div");
    this.spmContainer.className = "spmContainer";

    this.spmDisplay = document.createElement("p");
    this.spmDisplay.innerHTML = "SPM: 0";
    this.spmContainer.appendChild(this.spmDisplay);

    this.containerDiv.appendChild(this.spmContainer);
};