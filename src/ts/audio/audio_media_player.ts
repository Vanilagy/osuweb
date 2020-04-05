import { audioContext } from "./audio";
import { MathUtil } from "../util/math_util";
import { VirtualFile } from "../file_system/virtual_file";
import { TickingTask, addTickingTask, removeTickingTask } from "../util/ticker";
import { AnalyserNodeWrapper } from "./analyser_node_wrapper";
import { EMPTY_FUNCTION } from "../util/misc_util";
import { AudioPlayer } from "./audio_player";

const MEDIA_NUDGE_INTERVAL = 333; // In ms
const OBSERVED_AUDIO_MEDIA_OFFSET = 12; // In ms. Seemed like the HTMLAudioElement.currentTime was a few AHEAD of the actual sound being heard, causing the visuals to be shifted forwards in time. By subtracting these milliseconds from the returned currentTime, we compensate for that and further synchronize the visuals and gameplay with the audio.

/** A basic, fast media player, that is however not fully precise. */
export class AudioMediaPlayer extends AudioPlayer {
	private audioElement: HTMLAudioElement = null;
	private audioNode: MediaElementAudioSourceNode = null;
	private startTime: number = null;
	private timingDeltas: number[] = [];
	private lastNudgeTime: number = null;
	private offset: number;
	private playing: boolean = false;
	private timeout: any; // any 'cause it, for some reason, doesn't work with 'number'
	private pausedTime: number = null;
	private volume: number = 1;
	private pannerNode: StereoPannerNode;
	private gainNode: GainNode;
	private playbackRate = 1.0;
	private lastCurrentTime: number = null;
	private doLoop = false;
	private loopStart = 0;
	private loopEnd = -1;
	private tickingTask: TickingTask = null;
	private analysers: AnalyserNodeWrapper[] = [];

	constructor(destination: AudioNode) {
		super(destination);

		this.pannerNode = audioContext.createStereoPanner();
		this.pannerNode.connect(this.destination);

		this.gainNode = audioContext.createGain();
		this.setVolume(this.volume);
		this.gainNode.connect(this.pannerNode);
		
		this.tickingTask = () => {
			// Handle loop end behavior
			if (!this.audioElement) return;
			if (this.audioElement.paused) return;
			if (!this.doLoop) return;
			if (this.loopEnd === -1) return;

			if (this.audioElement.currentTime >= this.loopEnd) {
				this.start(this.loopStart);
			}
		};
	}

	private resetAudioElement() {
		if (this.audioNode) {
			this.audioNode.disconnect();
		}

		this.audioElement = new Audio();
		this.audioElement.playbackRate = this.playbackRate;
		this.audioNode = audioContext.createMediaElementSource(this.audioElement);
		this.audioNode.connect(this.gainNode);
		for (let a of this.analysers) a.hook(this.audioNode);
		this.timingDeltas.length = 0;
		this.lastNudgeTime = null;
		this.pausedTime = null;
		this.startTime = null;
		this.audioElement.onended = () => this.onPlaybackEnd();
	}

	private onPlaybackEnd() {
		if (this.doLoop) {
			this.start(this.loopStart);
		}
	}

	async loadFile(file: VirtualFile) {
		return this.loadUrl(await file.readAsResourceUrl());
	}

	loadBuffer(buffer: ArrayBuffer) {
		let url = URL.createObjectURL(new Blob([buffer]));
		return this.loadUrl(url);
	}

	loadUrl(url: string) {
		if (this.audioElement && this.audioElement.src === url) return;

		return new Promise<void>((resolve) => {
			this.resetAudioElement();
			this.audioElement.src = url;
			this.audioElement.preload = 'auto';
			this.audioElement.load();

			// Fires once the browser thinks it can play the whole file without buffering
			this.audioElement.addEventListener('canplaythrough', () => {
				resolve();
			});
		});
	}

	isEmpty() {
		return !this.audioElement || !this.audioElement.src;
	}

	start(offset: number = 0) {
		audioContext.resume();
		if (!this.audioElement) return;

		if (!this.audioElement.paused) this.pause();

		this.offset = offset;
		this.startTime = performance.now();
		this.pausedTime = null;
		this.lastCurrentTime = -Infinity;

		if (this.offset >= 0) {
			// This code basically assumes the file is an MP3 and tries to quantize the offset based on its frames. This is purely approximate, but *can* decrease error when seeking.
			this.offset = Math.floor(this.offset * 1000 / 26.122448979591837) * 26.122448979591837 / 1000;

			this.audioElement.currentTime = this.offset;
			this.audioElement.play().catch(EMPTY_FUNCTION);
			this.audioElement.playbackRate = this.playbackRate;
		} else {
			this.audioElement.currentTime = 0;

			// Any inaccuracies in this timeout (+-2ms) will be ironed out by the nudging algorithm in getCurrentTime
			this.timeout = setTimeout(() => {
				this.audioElement.play().catch(EMPTY_FUNCTION);
				this.audioElement.playbackRate = this.playbackRate;
			}, this.offset * -1 * 1000 / this.playbackRate);
		}

		this.playing = true;
	}

	stop() {
		this.pause();
		this.pausedTime = null;
	}

	pause() {
		if (!this.playing) return;

		let time = this.getCurrentTime();
		
		clearTimeout(this.timeout);
		this.audioElement.pause();

		this.playing = false;
		this.pausedTime = time;
	}

	unpause() {
		if (this.pausedTime === null) {
			console.error("Cannot unpause a MediaPlayer that hasn't been paused.");
			return;
		}

		this.start(this.pausedTime);
	}

	isPlaying() {
		return this.playing;
	}

	isPaused() {
		return !this.isPlaying() && this.pausedTime !== undefined;
	}

	setVolume(newVolume: number) {
		this.volume = newVolume;
		this.gainNode.gain.value = this.volume;
	}

	setPan(pan: number) {
		this.pannerNode.pan.value = pan;
	}

	setLoopBehavior(doLoop: boolean, loopStart = 0, loopEnd = -1) {
		this.doLoop = doLoop;
		this.loopStart = loopStart;
		this.loopEnd = loopEnd;

		if (doLoop) {
			addTickingTask(this.tickingTask);
		} else {
			removeTickingTask(this.tickingTask);
		}
	}

	setLoopState(loop: boolean) {
		this.setLoopState(loop);
	}

	setPlaybackRate(rate: number) {
		this.playbackRate = rate;
		if (this.audioElement) this.audioElement.playbackRate = rate;
	}

	getVolume() {
		return this.volume;
	}

	getPan() {
		return this.pannerNode.pan.value;
	}

	getLoopState() {
		return this.doLoop;
	}

	getPlaybackRate() {
		return this.playbackRate;
	}

	getCurrentTime() {
		if (this.startTime === null) return 0;
		if (this.pausedTime !== null) return this.pausedTime;

		let now = performance.now();
		let offsetMs = this.offset * 1000;

		let calculated = this.playbackRate * (now - this.startTime) + offsetMs;   
		let actual = this.audioElement.currentTime * 1000;

		// Only do this if the audio element has started playing, which, when its currentTime is 0, is likely not the case.
		if (actual > 0) {
			let delta = calculated - actual;
			this.timingDeltas.push(delta);

			// Keep the calculated time as close as possible to the ACTUAL time of the audio. The reason we don't use HTMLAudioElement.currentTime for getting the current time directly, is that it tends to fluctuate +-5ms. We avoid that fluctuation by using performance.now(), but that requires us to perform this synchronization:

			if (this.lastNudgeTime === null) this.lastNudgeTime = now;
			
			if (now - this.lastNudgeTime >= MEDIA_NUDGE_INTERVAL) {
				let average = MathUtil.getAggregateValuesFromArray(this.timingDeltas).avg; // Average of last deltas
				let absAverage = Math.abs(average);

				// if (absAverage >= 5) console.warn("High average media playback delta: " + average + "ms - Nudging offset...");
				if (absAverage >= 1) this.startTime += average / 2; // Nudge closer towards zero

				this.timingDeltas.length = 0;
				this.lastNudgeTime = now;
			}
		}

		let seconds = (calculated - OBSERVED_AUDIO_MEDIA_OFFSET) / 1000; // return in seconds

		// This here is done to guarantee getCurrentTime to be monotonically increasing. We don't want the current time to suddenly go backwards because a nudge happened, we just want it to stay still. A lot of other code assumes the monotonic increase of this value.
		let returnValue = Math.max(this.lastCurrentTime, seconds);
		this.lastCurrentTime = returnValue;

		return returnValue;
	}

	createAnalyser(fftSize: number) {
		let analyserWrapper = new AnalyserNodeWrapper(fftSize);
		if (this.audioNode) analyserWrapper.hook(this.audioNode);

		this.analysers.push(analyserWrapper);

		return analyserWrapper;
	}

	getDuration() {
		return this.audioElement && this.audioElement.duration;
	}

	clone() {
		let player = new AudioMediaPlayer(this.destination);

		if (this.audioElement && this.audioElement.src) player.loadUrl(this.audioElement.src);

		player.setVolume(this.getVolume());
		player.setPan(this.getPan());
		player.setPlaybackRate(this.getPlaybackRate());
		player.setLoopBehavior(this.doLoop, this.loopStart, this.loopEnd);
		
		return player;
	}
}