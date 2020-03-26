import { Mp3Util, AudioUtil } from "../util/audio_util";
import { audioContext } from "./audio";
import { addTickingTask, removeTickingTask } from "../util/ticker";
import { VirtualFile } from "../file_system/virtual_file";
import { MathUtil } from "../util/math_util";

const SECTION_LENGTH = 5.0; // In seconds
const NEXT_SECTION_MARGIN = 2.0; // How many seconds before the end of the current section the next section should start being prepared

interface AudioBufferInfo {
	startTime: number,
	intendedDuration: number, // For how long the buffer SHOULD play, rather than its actual duration
	buffer: AudioBuffer,
	startOffset: number,
	endOffset: number,
	eofReached: boolean // If the audio buffer reaches into the end of file
}

export class HighAccuracyMediaPlayer {
	private data: ArrayBuffer;
	private dataView: DataView;
	private fileHeader: ArrayBuffer;

	private tempo: number = 1.0;
	private pitch: number = 1.0;

	private destination: AudioNode;
	private currentMasterNode: AudioNode = null;
	private currentMasterNodeId: number = 0;
	private lastAudioNode: AudioBufferSourceNode = null;
	private cachedAudioBuffers: AudioBufferInfo[] = []; // Keep as many sections as possible, so that repeated playing doesn't require re-decoding audio data

	private isMp3: boolean;
	private starting = false;
	private playing = false;
	private startTime: number;
	private performanceStartTime: number;
	private pausedTime: number = null;
	private currentBufferEndTime: number = 0.0;
	private lastBufferOffset: number;
	private suppressTick = false;
	private endOfDataReached = false;
	private offset: number;

	// Non-MP3 stuff:
	private entireAudioBuffer: AudioBuffer | Promise<void> = null;
	private beginningSliceCache: AudioBuffer | Promise<AudioBuffer> = null;
	/** The minimum duration the beginning slice should be long. */
	private minimumBeginningSliceDuration: number = 0;

	/** Whether or not to stop the current time from advancing when the song is over, or to keep ticking on indefinitely. */
	private timeCap: boolean = true;
	private lastCurrentTimeValue: number = -Infinity;
	private timingDeltas: number[] = [];
	private lastDeltaAdjustmentTime: number = null;
	
	private tickingTask = () => { this.tick(); };

	constructor(destination: AudioNode) {
		this.destination = destination;
	}

	loadBuffer(data: ArrayBuffer) {
		if (this.playing) this.stop();

		this.data = data;
		this.dataView = new DataView(this.data);

		const noMp3 = () => {
			this.isMp3 = false;
			this.fileHeader = null;
		};

		if (Mp3Util.isId3Tag(this.dataView, 0)) {
			this.isMp3 = true;

			// Get the file header. This will be appended to the start of every audio buffer slice.
			let fileHeaderByteLength = Mp3Util.getFileHeaderByteLength(this.dataView, 0);
			this.fileHeader = this.data.slice(0, fileHeaderByteLength);

			if (!Mp3Util.isFrameHeader(this.dataView, fileHeaderByteLength)) {
				// The file is... weird. Take the safe route.
				noMp3();
			}
		} else {
			noMp3();
		}

		this.clearBufferCache();
	}

	async loadFromVirtualFile(file: VirtualFile) {
		let arrayBuffer = await file.readAsArrayBuffer();
		this.loadBuffer(arrayBuffer);
	}

	setTempo(newTempo: number) {
		if (this.isPlaying()) throw new Error("Don't, uhm, set tempo while it's playing. The code's too primitive to support that at the moment.");
		if (newTempo === this.tempo) return;

		this.tempo = newTempo;
		this.clearBufferCache();
	}

	setPitch(newPitch: number) {
		if (this.isPlaying()) throw new Error("Don't, uhm, set pitch while it's playing. The code's too primitive to support that at the moment.");
		if (newPitch === this.pitch) return;

		this.pitch = newPitch;
		this.clearBufferCache();
	}

	private setStartTime() {
		this.startTime = audioContext.currentTime;
		this.performanceStartTime = performance.now();
	}

	async start(offset = 0) {
		if (!this.data) throw new Error("Can't start without a file loaded!");
		await this.internalStart(offset, true);
	}

	private async internalStart(offset: number, resetLastCurrentTimeValue: boolean) {
		audioContext.resume();

		if (this.starting) return;
		this.starting = true;

		if (this.playing) this.pause();

		// Init master node
		this.currentMasterNode = audioContext.createGain();
		this.currentMasterNode.connect(this.destination);
		this.currentMasterNodeId++;
		this.lastAudioNode = null;
		this.offset = offset;

		let fn = Mp3Util.getFrameHeaderIndexAtTime;
		let frameHeaderIndex: ReturnType<typeof fn>;
		if (this.isMp3) {
			// Seek for the right frame to begin playback from
			frameHeaderIndex = Mp3Util.getFrameHeaderIndexAtTime(this.dataView, this.fileHeader.byteLength, Math.max(offset, 0));

			// Reset some attributes
			this.endOfDataReached = false;
			this.lastBufferOffset = frameHeaderIndex.offset;
			this.currentBufferEndTime = frameHeaderIndex.exactTime;

			await this.readyNextBufferSource();
		} else {
			await this.internalStartNonMp3();
		}
		
		if (resetLastCurrentTimeValue) this.lastCurrentTimeValue = -Infinity; // Reset it after the await because someone may get the currentTime while decoding is happening
		this.pausedTime = null;
		this.playing = true;
		this.starting = false;
		addTickingTask(this.tickingTask);

		// Can happen if 'offset' is outside of the song's length
		if (this.isMp3 && frameHeaderIndex.eofReached) {
			this.setStartTime(); // Gotta set it here because it wasn't set in readyNextBufferSource
			this.pause();
		}
	}

	// Incase a non-MP3 file is loaded, playback works a little differently: If it can, it fetches a small bit from the beginning of that song and plays that as soon as it can. Then, once the entire song has been decoded, it "swaps out" the buffers, so that the song can play 'til the end.
	private async internalStartNonMp3() {
		let masterNodeId = this.currentMasterNodeId;

		let playBuffer = (buffer: AudioBuffer) => {
			if (this.currentMasterNodeId !== masterNodeId) return;

			// If tempo === pitch, then we can naively speed up the playbackRate of a source node to yield the desired effect. This also avoids unnecessary processing.
			let useNativePlaybackRate = this.tempo === this.pitch;
			// If the buffer speed has been changed using playbackRate, then we don't need to divide. If it hasn't and we instead loaded a custom, sped-up buffer, then we do need to divide.
			let startDurationDivisor = useNativePlaybackRate? 1 : this.tempo;
			// The tempo and pitch change has an observed delay of 8192 samples, so we need to shift the playback by that much. And a bit more.
			let startDurationAdditionalOffset = useNativePlaybackRate? 0 : 8192 / audioContext.sampleRate + 0.008;

			let bufferSource = audioContext.createBufferSource();
			bufferSource.buffer = buffer;
			bufferSource.playbackRate.value = useNativePlaybackRate? this.tempo : 1;
			bufferSource.connect(this.currentMasterNode);

			if (this.lastAudioNode === null) {
				let currentContextTime = audioContext.currentTime;

				let when = currentContextTime - Math.min(this.offset, 0) / this.tempo;
				let offset = Math.max(this.offset, 0) / startDurationDivisor + startDurationAdditionalOffset;
	
				bufferSource.start(when, offset);
				this.setStartTime();
			} else {
				let currentContextTime = audioContext.currentTime;

				let when = Math.max(currentContextTime, this.startTime - Math.min(this.offset, 0) / this.tempo);
				let offset = Math.max(this.offset + (currentContextTime - this.startTime) * this.tempo, 0) / startDurationDivisor + startDurationAdditionalOffset;

				// Swap out
				bufferSource.start(when, offset);
				this.lastAudioNode.disconnect();
			}
			
			this.lastAudioNode = bufferSource;
		};

		let startBeginningSlice = async () => {
			let buffer: AudioBuffer;
			
			if (this.beginningSliceCache === null) {
				this.beginningSliceCache = new Promise(async (resolve) => {
					let useNativePlaybackRate = this.tempo === this.pitch;

					// Decode a super small part of audio so that we can get approximate bitrate info.
					let superSmallSlice = await audioContext.decodeAudioData(this.data.slice(0, 32768));
					// The amount of bytes of audio we think we'll need to encode in order to reach the required minimum duration
					let projectedBytes = this.minimumBeginningSliceDuration / superSmallSlice.duration * 32768;

					let endIndex = Math.min(this.data.byteLength, Math.floor(projectedBytes) + this.calculateBeginningSliceSafetyMargin());
					let slice = this.data.slice(0, endIndex);
					let rawAudioBuffer = await audioContext.decodeAudioData(slice);
					let finalAudioBuffer: AudioBuffer;

					if (useNativePlaybackRate) {
						finalAudioBuffer = rawAudioBuffer;
					} else {
						let processedBuffer = await AudioUtil.changeTempoAndPitch(rawAudioBuffer, audioContext, this.tempo, this.pitch);
						finalAudioBuffer = processedBuffer;
					}

					resolve(finalAudioBuffer);
					this.beginningSliceCache = finalAudioBuffer;
				});
			}
			
			if (this.beginningSliceCache instanceof Promise) {
				buffer = await this.beginningSliceCache;
			} else {
				buffer = this.beginningSliceCache;
			}

			playBuffer(buffer);
		};

		if (this.entireAudioBuffer === null) {
			let useNativePlaybackRate = this.tempo === this.pitch;

			let promise = new Promise<void>(async (resolve) => {
				let rawAudioBuffer = await audioContext.decodeAudioData(this.data.slice(0));
				let finalAudioBuffer: AudioBuffer;

				if (useNativePlaybackRate) {
					finalAudioBuffer = rawAudioBuffer;
				} else {
					let processedBuffer = await AudioUtil.changeTempoAndPitch(rawAudioBuffer, audioContext, this.tempo, this.pitch);
					finalAudioBuffer = processedBuffer;
				}

				this.entireAudioBuffer = finalAudioBuffer;

				resolve();
			});
			this.entireAudioBuffer = promise;
		}
		
		if (this.entireAudioBuffer instanceof Promise) {
			this.entireAudioBuffer.then(() => playBuffer(this.entireAudioBuffer as AudioBuffer));

			let permittedOffset = this.minimumBeginningSliceDuration;
			if (this.beginningSliceCache instanceof AudioBuffer) permittedOffset += (this.beginningSliceCache.duration - this.minimumBeginningSliceDuration) / 2;

			if (this.offset <= permittedOffset) await startBeginningSlice();			
			else await this.entireAudioBuffer;
		} else {
			playBuffer(this.entireAudioBuffer as AudioBuffer);
		}
	}

	/** Returns the amount of bytes the beginning slice should be extended by to ensure that it is long enough, so that when it is completed, the full buffer will be done decoding. */
	private calculateBeginningSliceSafetyMargin() {
		let useNativePlaybackRate = this.tempo === this.pitch;
		return Math.max(75000, Math.floor(this.data.byteLength * 0.04 * (useNativePlaybackRate? 1 : 1.5)));
	}

	private async readyNextBufferSource() {
		let masterNodeId = this.currentMasterNodeId;
		// If tempo === pitch, then we can naively speed up the playbackRate of a source node to yield the desired effect. This also avoids unnecessary processing.
		let useNativePlaybackRate = this.tempo === this.pitch;
		// If the buffer speed has been changed using playbackRate, then we don't need to divide. If it hasn't and we instead loaded a custom, sped-up buffer, then we do need to divide.
		let startDurationDivisor = useNativePlaybackRate? 1 : this.tempo;
		// The tempo and pitch change has an observed delay of 8192 samples, so we need to shift the playback by that much. And a bit more.
		let startDurationAdditionalOffset = useNativePlaybackRate? 0 : 8192 / audioContext.sampleRate + 0.008;

		let bufferSource = audioContext.createBufferSource();
		let newBufferInfo: AudioBufferInfo;
		let cachedBuffer = this.cachedAudioBuffers.find((x) => {
			if (this.currentBufferEndTime >= x.startTime && this.currentBufferEndTime < x.startTime + x.intendedDuration) return true;
			return false;
		});

		if (cachedBuffer) {
			newBufferInfo = cachedBuffer;
		} else {
			let frameHeaderIndex = Mp3Util.getFrameHeaderIndexAtTime(this.dataView, this.lastBufferOffset, SECTION_LENGTH);
			// Get the index to a frame a small amount of time later. This will give us a margin to blend over the two audio sources.
			let padddingIndex = Mp3Util.getFrameHeaderIndexAtTime(this.dataView, frameHeaderIndex.offset, 0.2 + 3 * startDurationAdditionalOffset);
	
			if (frameHeaderIndex.eofReached && frameHeaderIndex.exactTime === 0) {
				this.endOfDataReached = true;
				return;
			}
	
			// Construct the small MP3 snippet
			let buffer = new Uint8Array(this.fileHeader.byteLength + (padddingIndex.offset - this.lastBufferOffset));
			buffer.set(new Uint8Array(this.fileHeader), 0);
			buffer.set(new Uint8Array(this.data.slice(this.lastBufferOffset, padddingIndex.offset)), this.fileHeader.byteLength);
	
			let rawAudioBuffer = await audioContext.decodeAudioData(buffer.buffer);
			let finalAudioBuffer: AudioBuffer;
	
			if (useNativePlaybackRate) {
				bufferSource.playbackRate.value = this.tempo;
				finalAudioBuffer = rawAudioBuffer;
			} else {
				let processedBuffer = await AudioUtil.changeTempoAndPitch(rawAudioBuffer, audioContext, this.tempo, this.pitch);
				finalAudioBuffer = processedBuffer;
			}

			newBufferInfo = {
				startTime: this.currentBufferEndTime,
				intendedDuration: frameHeaderIndex.exactTime,
				buffer: finalAudioBuffer,
				startOffset: this.lastBufferOffset,
				endOffset: frameHeaderIndex.offset,
				eofReached: frameHeaderIndex.eofReached
			};

			this.cachedAudioBuffers.push(newBufferInfo);
			// Start removing old caches when the cache gets really big (to save memory)
			if (this.cachedAudioBuffers.length > 150) this.cachedAudioBuffers.shift();
		}

		if (this.currentMasterNodeId !== masterNodeId) return; // Master node has changed while decoding! Abort!

		bufferSource.buffer = newBufferInfo.buffer;

		// This package here is a crossfader:
		let gain1 = audioContext.createGain(); // Belongs to the freshly created buffer source
		let gain2 = audioContext.createGain(); // Belongs to the previous buffer source
		gain1.connect(this.currentMasterNode);
		gain2.connect(this.currentMasterNode);

		bufferSource.connect(gain1);

		if (this.lastAudioNode === null) {
			let currentContextTime = audioContext.currentTime;

			let when = currentContextTime - Math.min(this.offset, 0) / this.tempo;
			let offset = Math.max(this.offset - newBufferInfo.startTime, 0) / startDurationDivisor + startDurationAdditionalOffset;

			bufferSource.start(when, offset);
			this.setStartTime();
		} else {
			const swapDelay = 0.1;
			const crossfadeDuration = 0.02;
			let swapTime = (this.startTime + (this.currentBufferEndTime - this.offset) / this.tempo) + (swapDelay / this.tempo);

			// Since MP3s always contain a short amount of silence at the start, make sure to do the transition a bit later.
			this.lastAudioNode.stop(swapTime + crossfadeDuration);
			bufferSource.start(swapTime, swapDelay / startDurationDivisor + startDurationAdditionalOffset);

			this.lastAudioNode.disconnect();
			this.lastAudioNode.connect(gain2);

			gain1.gain.setValueAtTime(0, swapTime);
			gain1.gain.linearRampToValueAtTime(1, swapTime + crossfadeDuration);
			gain2.gain.setValueAtTime(1, swapTime);
			gain2.gain.linearRampToValueAtTime(0, swapTime + crossfadeDuration);
		}

		this.currentBufferEndTime = newBufferInfo.startTime + newBufferInfo.intendedDuration;
		this.lastBufferOffset = newBufferInfo.endOffset;
		this.lastAudioNode = bufferSource;

		if (newBufferInfo.eofReached) this.endOfDataReached = true;

		this.tryNextBufferingStep(); // Could be that we're already so close to the end of the current buffer that we need to queue the next one.
	}

	private async tick() {
		if (!this.isMp3 && this.entireAudioBuffer instanceof AudioBuffer && this.getContextCurrentTime() === this.entireAudioBuffer.duration) this.pause();
		if (!this.isMp3) return;
		if (!this.playing || this.isPaused()) return;
		if (this.endOfDataReached && this.getContextCurrentTime() === this.currentBufferEndTime) this.pause();
		if (this.suppressTick || this.endOfDataReached) return;

		await this.tryNextBufferingStep();
	}

	private async tryNextBufferingStep() {
		let swapTime = this.startTime + (this.currentBufferEndTime - this.offset) / this.tempo;
		let remaining = swapTime - audioContext.currentTime;

		if (remaining <= NEXT_SECTION_MARGIN) {
			this.suppressTick = true;
			await this.readyNextBufferSource(); // Load and ready the next buffer source
			this.suppressTick = false;
		}
	}

	private stopAudio() {
		if (this.currentMasterNode) {
			// Since this class uses Web Audio API scheduling, adn scheduled events cannot be cancelled, we simply kill this master node to stop the sound.
			this.currentMasterNode.disconnect();
			this.currentMasterNode = null;
			this.currentMasterNodeId++;
		}

		removeTickingTask(this.tickingTask);
	}

	stop() {
		if (!this.playing) return;
		this.playing = false;

		this.stopAudio();
		this.pausedTime = null;
		this.lastCurrentTimeValue = -Infinity;
	}

	pause() {
		if (this.isPaused() || !this.playing) return;

		this.pausedTime = this.getContextCurrentTime();
		this.stopAudio();
	}

	async unpause() {
		if (!this.isPaused()) {
			throw new Error("Can't unpause if it wasn't even paused in the first place. Sorry!");
		}

		await this.internalStart(this.pausedTime, false);
	}

	private clearBufferCache() {
		this.cachedAudioBuffers.length = 0;
		this.entireAudioBuffer = null;
		this.beginningSliceCache = null;
	}

	isPaused() {
		return this.pausedTime !== null;
	}

	isPlaying() {
		return this.playing;
	}

	private calculateCurrentTimeFromElapsedTime(elapsedTime: number) {
		if (this.isPaused()) return this.pausedTime;
		if (!this.playing) return 0;

		let cap: number;
		if (!this.timeCap) {
			cap = Infinity;
		} else if (this.isMp3) {
			cap = this.currentBufferEndTime;
		} else {
			cap = Infinity;
			if (this.entireAudioBuffer instanceof AudioBuffer) cap = this.entireAudioBuffer.duration;
		}

		return Math.min(this.offset + elapsedTime * this.tempo, cap);
	}

	getContextCurrentTime() {
		return this.calculateCurrentTimeFromElapsedTime(audioContext.currentTime - this.startTime);
	}

	getCurrentTime() {
		let now = performance.now();

		let performanceElapsedTime = (now - this.performanceStartTime) / 1000;
		let contextElapsedTime = audioContext.currentTime - this.startTime;
		let delta = performanceElapsedTime - contextElapsedTime;

		// make sure this time doesn't drift away from context time
		if (!isNaN(delta) && this.playing) {
			this.timingDeltas.push(delta);

			if (this.lastDeltaAdjustmentTime === null) {
				this.lastDeltaAdjustmentTime = now;
			} else if (now - this.lastDeltaAdjustmentTime >= 250 && this.timingDeltas.length >= 10) {
				let avg = MathUtil.calculateMean(this.timingDeltas);
				this.performanceStartTime += avg * 1000;
				this.timingDeltas.length = 0;
	
				this.lastDeltaAdjustmentTime = now;
			}
		}

		let output = this.calculateCurrentTimeFromElapsedTime(performanceElapsedTime);

		// This comparison is made so that we can guarantee a monotonically increasing currentTime. In reality, the value might hop back a few milliseconds, but to the outside world this is unexpected behavior and therefore should be avoided.
		if (output > this.lastCurrentTimeValue) {
			this.lastCurrentTimeValue = output;
			return output;
		} else {
			return this.lastCurrentTimeValue;
		}
	}

	enableTimeCap() {
		this.timeCap = true;
	}

	disableTimeCap() {
		this.timeCap = false;
	}

	setMinimumBeginningSliceDuration(duration: number) {
		this.minimumBeginningSliceDuration = duration;
	}
}