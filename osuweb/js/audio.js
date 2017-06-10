function Audio(arrayBuffer, callback, bufferCount, isMusic) {
    this.isMusic = !(isMusic == undefined || isMusic == null || !isMusic);
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
    this.gainNode.gain.value = (this.isMusic ? settingsData.music : settingsData.sound) * settingsData.master;
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
    this.gainNode.gain.value = value;
}

Audio.prototype.onError = function(err) {

};