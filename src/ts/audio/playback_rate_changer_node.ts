import { audioContext } from "./audio";

export class PlaybackRateChangerNode {
	private node: ScriptProcessorNode;
	private stored: number[][]; // One for each channel
	private currentIndex: number;
	/** The current playback rate. Must be <= 1.0! We can't see the future. */
	public playbackRate: number = 1.0;

	constructor() {
		this.reset();

		this.node = audioContext.createScriptProcessor(512);
		this.node.onaudioprocess = (e) => {
			let { inputBuffer, outputBuffer } = e;

			let channelCount = Math.min(2, inputBuffer.numberOfChannels);

			for (let i = 0; i < channelCount; i++) {
				let inputChannel = inputBuffer.getChannelData(i);
				let outputChannel = outputBuffer.getChannelData(i);
				let storedChannel = this.stored[i];

				for (let j = 0; j < inputChannel.length; j++) storedChannel.push(inputChannel[j]);

				for (let j = 0; j < outputBuffer.length; j++) {
					// Do simple linear resampling
					let otherIndex = this.currentIndex + j * this.playbackRate;
					let completion = otherIndex % 1;
					let otherSampleLow = storedChannel[Math.floor(otherIndex)];
					let otherSampleHigh = storedChannel[Math.ceil(otherIndex)];
					
					let val = (1-completion)*otherSampleLow + completion*otherSampleHigh;
					outputChannel[j] = val;
				}
			}

			this.currentIndex += inputBuffer.length * this.playbackRate;
		};
	}

	connect(node: AudioNode) {
		this.node.connect(node);
	}
	
	disconnect() {
		this.node.disconnect();
	}

	reset() {
		this.stored = [[], []];
		this.currentIndex = 0;
	}

	getNode() {
		return this.node;
	}
}