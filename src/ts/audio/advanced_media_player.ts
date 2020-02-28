import { Mp3Util } from "../util/audio_util";
import { audioContext, mediaAudioNode } from "./audio";
import { addTickingTask, removeTickingTask } from "../util/ticker";

const SECTION_LENGTH = 5.0; // In seconds
const NEXT_SECTION_MARGIN = 2.0; // How many seconds before the end of the current section the next section should start being prepared

export class AdvancedMediaPlayer {
	private data: ArrayBuffer;
	private dataView: DataView;
	private id3Tag: ArrayBuffer;

	private destination: AudioNode;
	private currentMasterNode: AudioNode = null;
	private lastAudioNode: AudioBufferSourceNode = null;

	private started = false;
	private startTime: number;
	private performanceNowStartTime: number;
	private lastCurrentTimeOutput = -Infinity;
	private pausedTime: number = null;
	private currentBufferEndTime: number = 0.0;
	private lastBufferOffset: number;
	private suppressTick = false;
	private endOfDataReached = false;
	
	private tickingTask = () => { this.tick(); };

	constructor(destination: AudioNode) {
		this.destination = destination;
	}

	loadBuffer(data: ArrayBuffer) {
		this.data = data;
		this.dataView = new DataView(this.data);

		// TODO: Handle more files
		if (!Mp3Util.isId3Tag(this.dataView)) throw new Error("Non-MP3 files are not handled yet!");

		// Get the ID3 header. This will be appended to the start of every audio buffer slice.
		let id3TagByteLength = Mp3Util.getId3TagByteLength(this.dataView);
		this.id3Tag = this.data.slice(0, id3TagByteLength);
	}

	async start(offset = 0.5) {
		if (this.started) {
			this.stop();
		}

		// Seek for the right frame to begin playback from
		let frameHeaderIndex = Mp3Util.getFrameHeaderIndexAtTime(this.dataView, this.id3Tag.byteLength, Math.max(offset, 0));

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

		this.performanceNowStartTime = performance.now() - (audioContext.currentTime - this.startTime)*1000;
	}

	stop() {
		if (!this.started) return;
		this.started = false;

		// Since this class uses Web Audio API scheduling, adn scheduled events cannot be cancelled, we simply kill this master node to stop the sound.
		this.currentMasterNode.disconnect();
		this.currentMasterNode = null;
		this.pausedTime = null;
		this.lastCurrentTimeOutput = -Infinity;

		removeTickingTask(this.tickingTask);
	}

	pause() {
		if (this.pausedTime !== null) return;

		let currentTime = this.getContextCurrentTime();
		let lastCurrentTimeOutput = this.lastCurrentTimeOutput;

		this.stop();

		this.pausedTime = currentTime;
		this.lastCurrentTimeOutput = lastCurrentTimeOutput;
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
		let buffer = new Uint8Array(this.id3Tag.byteLength + (padddingIndex.offset - this.lastBufferOffset));
		buffer.set(new Uint8Array(this.id3Tag), 0);
		buffer.set(new Uint8Array(this.data.slice(this.lastBufferOffset, padddingIndex.offset)), this.id3Tag.byteLength);

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
			let swapTime = this.currentBufferEndTime + this.startTime;

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
		if (this.endOfDataReached && this.getCurrentTime() === this.currentBufferEndTime) this.pause();
		if (this.suppressTick || this.endOfDataReached) return;

		let currentTime = audioContext.currentTime;
		let remaining = this.currentBufferEndTime - (currentTime - this.startTime);

		if (remaining <= NEXT_SECTION_MARGIN) {
			this.suppressTick = true;
			await this.readyNextBufferSource(); // Load and ready the next buffer source
			this.suppressTick = false;
		}
	}

	private getContextCurrentTime() {
		if (this.pausedTime !== null) return this.pausedTime;
		if (!this.started) return 0;
		return Math.min(audioContext.currentTime - this.startTime, this.currentBufferEndTime);
	}

	getCurrentTime() {
		let output: number;

		if (this.pausedTime !== null) output = this.pausedTime;
		else if (!this.started) output = 0;
		else output = Math.min((performance.now() - this.performanceNowStartTime) / 1000, this.currentBufferEndTime);

		// This here code guarantees that the current time is always monotonically increasing.
		if (output > this.lastCurrentTimeOutput) {
			this.lastCurrentTimeOutput = output;
			return output;
		} else {
			return this.lastCurrentTimeOutput;
		}
	}
}

/*

async function tester() {
	let request = await fetch('./assets/test_maps/NewspapersForMagicians/audio.mp3');
	let arrayBuffer = await request.arrayBuffer();

	let player = new AdvancedMediaPlayer(mediaAudioNode);
	player.loadBuffer(arrayBuffer);
	await player.start(50);

	setInterval(() => {
		console.log(player.getCurrentTime());
	}, 100);
}
window.addEventListener('mousedown', tester);

*/