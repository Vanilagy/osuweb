import { Mp3Util } from "../util/audio_util";
import { audioContext, mediaAudioNode } from "./audio";
import { addTickingTask, removeTickingTask } from "../util/ticker";
import { VirtualFile } from "../file_system/virtual_file";

const SECTION_LENGTH = 5.0; // In seconds
const NEXT_SECTION_MARGIN = 2.0; // How many seconds before the end of the current section the next section should start being prepared

export class HighAccuracyMediaPlayer {
	private data: ArrayBuffer;
	private dataView: DataView;
	private fileHeader: ArrayBuffer;

	private destination: AudioNode;
	private currentMasterNode: AudioNode = null;
	private lastAudioNode: AudioBufferSourceNode = null;

	private started = false; // doesn't imply 'playing', as the buffer could still be decoding
	private playing = false;
	private startTime: number;
	private pausedTime: number = null;
	private currentBufferEndTime: number = 0.0;
	private lastBufferOffset: number;
	private suppressTick = false;
	private endOfDataReached = false;

	private lastSampledContextTime: number = null;
	private lastContextTimeSamplingTime: number = null;
	private lastCurrentTimeValue: number = -Infinity;
	
	private tickingTask = () => { this.tick(); };

	constructor(destination: AudioNode) {
		this.destination = destination;
	}

	loadBuffer(data: ArrayBuffer) {
		if (this.started) this.stop();

		this.data = data;
		this.dataView = new DataView(this.data);

		// TODO: Handle more files
		if (!Mp3Util.isId3Tag(this.dataView, 0)) throw new Error("Non-MP3 files are not handled yet!");

		// Get the file header. This will be appended to the start of every audio buffer slice.
		let fileHeaderByteLength = Mp3Util.getFileHeaderByteLength(this.dataView, 0);
		this.fileHeader = this.data.slice(0, fileHeaderByteLength);

		Mp3Util.isXingFrame(this.dataView, fileHeaderByteLength);
	}

	async loadFromVirtualFile(file: VirtualFile) {
		let arrayBuffer = await file.readAsArrayBuffer();
		this.loadBuffer(arrayBuffer);
	}

	async start(offset = 0) {
		audioContext.resume()

		if (this.started) {
			this.stop();
		}

		// Seek for the right frame to begin playback from
		let frameHeaderIndex = Mp3Util.getFrameHeaderIndexAtTime(this.dataView, this.fileHeader.byteLength, Math.max(offset, 0));

		this.currentMasterNode = audioContext.createGain();
		this.currentMasterNode.connect(this.destination);
		this.lastAudioNode = null;

		this.started = true;
		this.pausedTime = null;
		this.endOfDataReached = false;
		this.lastBufferOffset = frameHeaderIndex.offset;
		this.currentBufferEndTime = frameHeaderIndex.exactTime;

		await this.readyNextBufferSource(offset - frameHeaderIndex.exactTime);

		addTickingTask(this.tickingTask);

		// Can happen if 'offset' is outside of the song's length
		if (frameHeaderIndex.eofReached) this.startTime = audioContext.currentTime;
		this.startTime -= offset;
		if (frameHeaderIndex.eofReached) this.pause();

		this.playing = true;
	}

	stop() {
		if (!this.started) return;
		this.started = false;

		// Since this class uses Web Audio API scheduling, adn scheduled events cannot be cancelled, we simply kill this master node to stop the sound.
		this.currentMasterNode.disconnect();
		this.currentMasterNode = null;
		this.pausedTime = null;
		this.playing = false;
		this.lastCurrentTimeValue = -Infinity;

		removeTickingTask(this.tickingTask);
	}

	pause() {
		if (this.pausedTime !== null) return;

		let currentTime = this.getContextCurrentTime();
		let lastCurrentTimeValue = this.lastCurrentTimeValue; // Remember this to set it back after stopping

		this.stop();

		this.pausedTime = currentTime;
		this.lastCurrentTimeValue = lastCurrentTimeValue;
	}

	async unpause() {
		if (this.pausedTime === null) {
			throw new Error("Can't unpause if it wasn't even paused in the first place. Sorry!");
		}

		await this.start(this.pausedTime);
	}

	isPaused() {
		return this.pausedTime !== null;
	}

	isPlaying() {
		return this.started && !this.isPaused();
	}

	private async readyNextBufferSource(offset?: number) {
		let frameHeaderIndex = Mp3Util.getFrameHeaderIndexAtTime(this.dataView, this.lastBufferOffset, SECTION_LENGTH);
		// Get the index to a frame a small amount of time later. This will give us a margin to blend over the two audio sources.
		let padddingIndex = Mp3Util.getFrameHeaderIndexAtTime(this.dataView, frameHeaderIndex.offset, 0.2);

		if (frameHeaderIndex.eofReached && frameHeaderIndex.exactTime === 0) {
			this.endOfDataReached = true;
			return;
		}

		// Construct the small MP3 snippet
		let buffer = new Uint8Array(this.fileHeader.byteLength + (padddingIndex.offset - this.lastBufferOffset));
		buffer.set(new Uint8Array(this.fileHeader), 0);
		buffer.set(new Uint8Array(this.data.slice(this.lastBufferOffset, padddingIndex.offset)), this.fileHeader.byteLength);

		let audioBuffer = await audioContext.decodeAudioData(buffer.buffer);
		if (!this.started) return; // Could be that .stop() has been called while decoding was going on

		let bufferSource = audioContext.createBufferSource();
		bufferSource.buffer = audioBuffer;
		bufferSource.connect(this.currentMasterNode);

		if (this.lastAudioNode === null) {
			let currentContextTime = audioContext.currentTime;

			bufferSource.start(currentContextTime - Math.min(offset, 0), Math.max(offset, 0));
			this.startTime = currentContextTime;
		} else {
			let swapTime = this.startTime + this.currentBufferEndTime;

			// Since MP3s always contain a short amount of silence at the start, make sure to do the transition a bit later.
			this.lastAudioNode.stop(swapTime + 0.1);
			bufferSource.start(swapTime + 0.1, 0.1);
		}

		this.currentBufferEndTime += frameHeaderIndex.exactTime;
		this.lastBufferOffset = frameHeaderIndex.offset;
		this.lastAudioNode = bufferSource;

		if (frameHeaderIndex.eofReached) this.endOfDataReached = true;
	}

	private async tick() {
		if (!this.started) return;
		if (this.endOfDataReached && this.getContextCurrentTime() === this.currentBufferEndTime) this.pause();
		if (this.suppressTick || this.endOfDataReached) return;

		let currentTime = audioContext.currentTime;
		let remaining = this.currentBufferEndTime - (currentTime - this.startTime);

		if (remaining <= NEXT_SECTION_MARGIN) {
			this.suppressTick = true;
			await this.readyNextBufferSource(); // Load and ready the next buffer source
			this.suppressTick = false;
		}
	}

	getContextCurrentTime() {
		if (this.pausedTime !== null) return this.pausedTime;
		if (!this.playing) return 0;
		return Math.min(audioContext.currentTime - this.startTime, this.currentBufferEndTime);
	}

	getCurrentTime() {
		let currentTime = this.getContextCurrentTime();
		let output: number;

		if (this.lastSampledContextTime !== currentTime) {
			this.lastSampledContextTime = currentTime;
			this.lastContextTimeSamplingTime = performance.now();

			output = currentTime;
		} else {
			if (this.pausedTime !== null || !this.playing) {
				output = this.lastSampledContextTime;
			} else {
				output = this.lastSampledContextTime + (performance.now() - this.lastContextTimeSamplingTime)/1000;
			}
		}

		output -= 0.004; // Shift by 4ms. Generally observed to be "feel" and sound more accurate. Will have to be observe more in the future.

		// This comparison is made so that we can guarantee a monotonically increasing currentTime. In reality, the value might hop back a few milliseconds, but to the outside world this is unexpected behavior and therefore should be avoided.
		if (output > this.lastCurrentTimeValue) {
			this.lastCurrentTimeValue = output;
			return output;
		} else {
			return this.lastCurrentTimeValue;
		}
	}
}

export let gameplayMediaPlayer = new HighAccuracyMediaPlayer(mediaAudioNode);