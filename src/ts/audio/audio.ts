const DEFAULT_SOUND_VOLUME = 0.05;

export let audioContext = new AudioContext();

interface SoundEmitterOptions {
    buffer?: AudioBuffer,
    volume?: number,
    playbackRate?: number
}

export class SoundEmitter {
    private volume: number = DEFAULT_SOUND_VOLUME;
    private playbackRate: number = 1;
    private sourceNode: AudioBufferSourceNode = null;
    private gainNode: GainNode;
    private audioStartTime: number = null;
    private buffer: AudioBuffer = null;

    constructor(options: SoundEmitterOptions = {}) {
        if (options.buffer) this.setBuffer(options.buffer);
        if (options.volume) this.volume = options.volume;
        if (options.playbackRate) this.playbackRate = options.playbackRate;

        this.gainNode = audioContext.createGain();
        this.setVolume(this.volume);

        this.gainNode.connect(audioContext.destination);
    }

    setVolume(newVolume: number) {
        this.volume = newVolume;
        this.gainNode.gain.value = this.volume;
    }

    setBuffer(buffer: AudioBuffer) {
        this.buffer = buffer;
    }

    private createSourceNode() {
        if (this.buffer === null) return;

        this.sourceNode = audioContext.createBufferSource();
        this.sourceNode.buffer = this.buffer;
        this.sourceNode.playbackRate.value = this.playbackRate;
        
        this.sourceNode.connect(this.gainNode);
    }

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
        if (offset < 0) delay = offset * -1;

        this.sourceNode.start(delay, offset);
        this.audioStartTime = audioContext.currentTime;
    }

    getCurrentTime() {
        if (this.audioStartTime === null) return 0;
        return (audioContext.currentTime - this.audioStartTime) * this.playbackRate;
    }
}

export let mainMusicSoundEmitter = new SoundEmitter();