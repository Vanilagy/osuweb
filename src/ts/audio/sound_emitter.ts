import { audioContext } from "./audio";

interface SoundEmitterOptions {
    destination: AudioNode,
    buffer?: AudioBuffer,
    volume?: number,
    playbackRate?: number
}

export class SoundEmitter {
    private volume: number = 1; // !???!
    private playbackRate: number = 1;
    private sourceNode: AudioBufferSourceNode = null;
    private gainNode: GainNode;
    private audioStartTime: number = null;
    private buffer: AudioBuffer = null;
    private offset: number = 0;
    private loop: boolean = false;

    constructor(options: SoundEmitterOptions) {
        if (options.buffer) this.setBuffer(options.buffer);
        if (options.volume) this.volume = options.volume;
        if (options.playbackRate) this.playbackRate = options.playbackRate;

        this.gainNode = audioContext.createGain();
        this.setVolume(this.volume);

        this.gainNode.connect(options.destination);
    }

    setVolume(newVolume: number) {
        this.volume = newVolume;
        this.gainNode.gain.value = this.volume;
    }

    setBuffer(buffer: AudioBuffer) {
        this.buffer = buffer;
    }

    getBuffer() {
        return this.buffer;
    }

    setLoopState(state: boolean) {
        this.loop = state;

        if (this.sourceNode) this.sourceNode.loop = state;
    }
 
    private createSourceNode() {
        if (this.buffer === null) return;

        this.sourceNode = audioContext.createBufferSource();
        this.sourceNode.buffer = this.buffer;
        this.sourceNode.playbackRate.value = this.playbackRate;
        this.sourceNode.loop = this.loop;
        
        this.sourceNode.connect(this.gainNode);
    }

    // offset in seconds
    start(offset: number = 0) {
        if (this.buffer === null) {
            console.error("Cannot start a SoundEmitter that's lacking a buffer.");
            return;
        }

        if (this.sourceNode) {
            this.sourceNode.stop();
        }

        this.createSourceNode();

        let delay = 0;
        if (offset < 0) {
            delay = offset * -1;
        }

        this.offset = offset;

        this.sourceNode.start(audioContext.currentTime + delay, (offset < 0)? 0: offset);
        this.audioStartTime = audioContext.currentTime;
    }

    stop() {
        if (!this.sourceNode) return;

        this.sourceNode.stop();
    }

    getCurrentTime() {
        if (this.audioStartTime === null) return 0;
        return (audioContext.currentTime - this.audioStartTime + this.offset) * this.playbackRate;
    }
}