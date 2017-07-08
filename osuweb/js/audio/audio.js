"use strict";

import {AUDIO_MANAGER, SETTINGS} from "../main";
import {Console} from "../console";

export class Audio {
    constructor(arrayBuffer, callback, bufferCount, isMusic) {
        this.isMusic = !(isMusic === undefined || isMusic === null || !isMusic);
        this.buffer = null;
        this.duration = arrayBuffer.duration;

        this.creationCallback = callback;

        if (bufferCount === undefined) bufferCount = 2;
        this.gainNodes = new Array(Math.min(bufferCount, 2));

        for(let i = 0; i < this.gainNodes.length; i++)  {
            this.gainNodes[i] = AUDIO_MANAGER.getContext().createGain();
            this.gainNodes[i].connect(AUDIO_MANAGER.getContext().destination);
        }
        this.currentGainNodeIndex = 0;

        this.sourceNodes = new Array(bufferCount);
        this.currentSourceNodeIndex = -1;
        this.nextNodeNumber = 0;
        this.volume = 1;

        this.onEnded = () => {};

        AUDIO_MANAGER.getContext().decodeAudioData(arrayBuffer, (function (buffer) {
            this.buffer = buffer;
            this.duration = buffer.duration;

            for (let i = 0; i < bufferCount; i++) {
                this.createNode(i);
            }
        }).bind(this), this.onError.bind(this));
    }

    createNode(index) {
        this.sourceNodes[index] = AUDIO_MANAGER.getContext().createBufferSource();
        this.sourceNodes[index].buffer = this.buffer;

        // Recreate node on end
        this.sourceNodes[index].onended = this.onAudioEnded.bind(this, index);

        if (this.creationCallback !== undefined && this.creationCallback !== null) {
            this.creationCallback();

            this.creationCallback = null;
        }
    }

    onAudioEnded(index) {
        this.onEnded();
        this.currentSourceNodeIndex = -1;
        this.sourceNodes[index].disconnect();
        this.createNode(index);
    }

    isRunning() {
        return this.currentSourceNodeIndex !== -1;
    }

    play(time = 0, offset = 0, loopStart = -1, loopEnd = -1) {
        if (this.buffer === null) return;

        let enableLoop = false;

        if (loopStart !== undefined && loopStart > 0) {
            this.sourceNodes[this.nextNodeNumber].loopStart = loopStart;
            enableLoop = true;
        }
        if (loopEnd !== undefined && loopEnd > 0) {
            this.sourceNodes[this.nextNodeNumber].loopEnd = loopEnd;
            enableLoop = true;
        }

        if(enableLoop) this.sourceNodes[this.nextNodeNumber].loop = enableLoop;
        this.sourceNodes[this.nextNodeNumber].connect(this.gainNodes[(++this.currentGainNodeIndex) % this.gainNodes.length]);
        this.updateVolume(this.volume);
        this.sourceNodes[this.nextNodeNumber].start(time, Math.max(offset, 0));

        this.currentSourceNodeIndex = this.nextNodeNumber++;
        this.nextNodeNumber %= this.sourceNodes.length;
    }

    stop(time) {
        if (time === undefined) time = 0;

        if (this.currentSourceNodeIndex >= 0) {
            this.sourceNodes[this.currentSourceNodeIndex].stop(time);
            this.sourceNodes[this.currentSourceNodeIndex].disconnect();
        }
    }

    setOnEnded(onEnded) {
        this.onEnded = onEnded;
    }

    updateVolumeAll(customVolume = 1) {
        this.volume = customVolume;

        for(let key in this.gainNodes) this.gainNodes[key].gain.value = (this.isMusic ? SETTINGS.data.music : SETTINGS.data.sound) * SETTINGS.data.master * this.volume;
    }

    updateVolume(customVolume = 1) {
        this.volume = customVolume;

        this.gainNodes[this.currentGainNodeIndex % this.gainNodes.length].gain.value = (this.isMusic ? SETTINGS.data.music : SETTINGS.data.sound) * SETTINGS.data.master * this.volume;
    }

    onError(err) {
        Console.error(this.buffer);
    }
}