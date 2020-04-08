import { audioContext } from "./audio";
import { AudioPlayer } from "./audio_player";
import { VirtualFile } from "../file_system/virtual_file";
import { fetchAsArrayBuffer } from "../util/network_util";
import { EMPTY_AUDIO_BUFFER } from "../util/audio_util";

export class AudioBufferPlayer extends AudioPlayer {
	private sourceNode: AudioBufferSourceNode = null;
	private gainNode: GainNode;
	private pannerNode: StereoPannerNode;

	private audioBuffer: AudioBuffer = null;
	private playbackRate: number = 1;
	private offset: number = 0;
	private loop: boolean = false;

	private audioStartTime: number = null;
	private playing: boolean = false;

	constructor(destination: AudioNode) {
		super(destination);

		this.gainNode = audioContext.createGain();
		this.pannerNode = audioContext.createStereoPanner();

		this.gainNode.connect(this.pannerNode);
		this.pannerNode.connect(destination);
	}
	
	async loadFile(file: VirtualFile) {
		return this.loadBuffer(await file.readAsArrayBuffer());
	}

	async loadBuffer(buffer: ArrayBuffer) {
		try {
			this.audioBuffer = await audioContext.decodeAudioData(buffer);
		} catch (e) {
			console.error(e);
			this.audioBuffer = EMPTY_AUDIO_BUFFER;
		}
	}

	async loadUrl(url: string) {
		return this.loadBuffer(await fetchAsArrayBuffer(url));
	}

	loadAudioBuffer(audioBuffer: AudioBuffer) {
		this.audioBuffer = audioBuffer;
	}

	isEmpty() {
		return this.audioBuffer === null;
	}

	private createSourceNode() {
		if (this.audioBuffer === null) return;

		this.sourceNode = audioContext.createBufferSource();
		this.sourceNode.buffer = this.audioBuffer;
		this.sourceNode.playbackRate.value = this.playbackRate;
		this.sourceNode.loop = this.loop;
		
		this.sourceNode.connect(this.gainNode);
	}

	start(offset: number = 0) {
		if (this.audioBuffer === null) {
			console.error("Cannot start a AudioBufferPlayer that's lacking an audio buffer.");
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
		this.sourceNode = null;
	}

	isPlaying() {
		return this.playing;
	}

	setVolume(volume: number) {
		this.gainNode.gain.value = volume;
	}

	setPan(newPan: number) {
		this.pannerNode.pan.value = newPan;
	}

	setLoopState(state: boolean) {
		this.loop = state;

		if (this.sourceNode) this.sourceNode.loop = state;
	}

	setPlaybackRate(rate: number) {
		this.playbackRate = rate;

		if (this.sourceNode) this.sourceNode.playbackRate.value = rate;
	}

	getVolume() {
		return this.gainNode.gain.value;
	}

	getPan() {
		return this.pannerNode.pan.value;
	}

	getLoopState() {
		return this.loop;
	}

	getPlaybackRate() {
		return this.playbackRate;
	}

	getDuration() {
		return this.audioBuffer && this.audioBuffer.duration;
	}

	getCurrentTime() {
		if (this.audioStartTime === null) return 0;
		return (audioContext.currentTime - this.audioStartTime + this.offset) * this.playbackRate;
	}

	clone() {
		let player = new AudioBufferPlayer(this.destination);
		player.loadAudioBuffer(this.audioBuffer);

		player.setVolume(this.getVolume());
		player.setPan(this.getPan());
		player.setPlaybackRate(this.getPlaybackRate());
		player.setLoopState(this.getLoopState());

		return player;
	}
}