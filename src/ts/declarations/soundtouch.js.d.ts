declare class PitchShifter {
	constructor(audioCtx: AudioContext | OfflineAudioContext, audioBuffer: AudioBuffer, bufferSize: number);

	public tempo: number;
	public pitch: number;

	public connect(node: AudioNode): void;
	public disconnect(): void;
}