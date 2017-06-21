function HitObject(data) {
    this.type = "hitobject";
    this.x = data.x;
    this.y = data.y;
    this.startPoint = {x: this.x, y: this.y};
    this.basePoint = {x: this.x, y: this.y};
    this.time = data.time;
    this.endTime = this.time;
    this.newCombo = data.newCombo;
    this.stackHeight = 0;
}

HitObject.prototype.show = function(offset) {
    this.containerDiv.style.visibility = "visible";
    this.containerDiv.style.transition = "opacity " + (((currentPlay.ARMs / 2) - offset) / 1000) + "s linear";
    this.containerDiv.style.opacity = 1;
    this.approachCircleCanvas.style.transform = "scale(1.0)";
    this.approachCircleCanvas.style.transition = "transform " + ((currentPlay.ARMs - offset) / 1000) + "s linear";
};

HitObject.prototype.remove = function() {
    objectContainerDiv.removeChild(this.containerDiv);
};

HitObject.prototype.append = function() {
    objectContainerDiv.appendChild(this.containerDiv);
};

HitObject.prototype.updateStackPosition = function() {
    this.x += this.stackHeight * -4;
    this.y += this.stackHeight * -4;
};

HitObject.prototype.playHitSound = function(data) {
    var skin = currentSkin || defaultSkin;

    var audioObj = skin.skinElements[data.sampleSet + "-hitnormal"];

    audioObj.playAudio();
    audioObj.setVolume(data.volume);

    // Gets information stored in additions bitfield
    if ((data.additions & 2) == 2) {
        var audioObj = skin.skinElements[data.sampleSetAddition + "-hitwhistle"];
        audioObj.playAudio();
        audioObj.setVolume(data.volume);
    }
    if ((data.additions & 4) == 4) {
        var audioObj = skin.skinElements[data.sampleSetAddition + "-hitfinish"];
        audioObj.playAudio();
        audioObj.setVolume(data.volume);
    }
    if ((data.additions & 8) == 8) {
        var audioObj = skin.skinElements[data.sampleSetAddition + "-hitclap"];
        audioObj.playAudio();
        audioObj.setVolume(data.volume);
    }
};