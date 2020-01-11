import { audioContext } from "./audio";

interface SoundEmitterOptions {
	destination: AudioNode,
	buffer?: AudioBuffer,
	volume?: number,
	playbackRate?: number
}

export class SoundEmitter {
	private sourceNode: AudioBufferSourceNode = null;
	private gainNode: GainNode;
	private pannerNode: StereoPannerNode;

	private buffer: AudioBuffer = null;
	private playbackRate: number = 1;
	private offset: number = 0;
	private loop: boolean = false;

	private audioStartTime: number = null;
	private playing: boolean = false;

	constructor(destination: AudioNode) {
		this.gainNode = audioContext.createGain();
		this.pannerNode = audioContext.createStereoPanner();

		this.gainNode.connect(this.pannerNode);
		this.pannerNode.connect(destination);
	}

	setVolume(volume: number) {
		this.gainNode.gain.value = volume;
	}

	setPan(newPan: number) {
		this.pannerNode.pan.value = newPan;
	}

	setBuffer(buffer: AudioBuffer) {
		this.buffer = buffer;
	}

	getBuffer() {
		return this.buffer;
	}

	isPlaying() {
		return this.playing;
	}

	setLoopState(state: boolean) {
		this.loop = state;

		if (this.sourceNode) this.sourceNode.loop = state;
	}

	setPlaybackRate(rate: number) {
		this.playbackRate = rate;

		if (this.sourceNode) this.sourceNode.playbackRate.value = rate;
	}

	getPlaybackRate() {
		return this.playbackRate;
	}

	isReallyShort() {
		return this.buffer === null || this.buffer.duration < 0.01; // Buffers shorter than this suck for looping
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

		this.playing = true;
		this.sourceNode.addEventListener('ended', () => {
			this.playing = false;
		});
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