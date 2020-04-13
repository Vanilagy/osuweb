import { VirtualFile } from "../file_system/virtual_file";

export abstract class AudioPlayer {
	protected destination: AudioNode;

	constructor(desination: AudioNode) {
		this.destination = desination;
	}

	/** Loads the sound from a file. */
	abstract loadFile(file: VirtualFile): Promise<any>;
	/** Loads the sound from an arraybuffer. */
	abstract loadBuffer(buffer: ArrayBuffer): Promise<any>;
	/** Loads the sound from an URL. */
	abstract loadUrl(url: string): Promise<any>;
	/** Returns true if there is no audio stored/loaded. */
	abstract isEmpty(): boolean;

	/**
	 * Starts the audio playback.
	 * @param offset If positive, the audio will start that many seconds in. If negative, the absolute value of the offset describes the time until the audio starts playing.
	 */
	abstract start(offset?: number): void;
	/** Stops the audio playback. */
	abstract stop(): void;
	/** Returns true if the audio is currently playing. */
	abstract isPlaying(): boolean;
	/** Pauses the audio playback. */
	abstract pause(): void;
	/** Unpauses the audio playback. */
	abstract unpause(): void;
	/** Returns true if the audio is currently paused. */
	abstract isPaused(): boolean;
	
	/**
	 * Sets the volume of the player.
	 * @param volume The volume
	 */
	abstract setVolume(volume: number): void;
	/**
	 * Sets the stereo pan of the player.
	 * @param newPan The pan
	 */
	abstract setPan(newPan: number): void;
	/**
	 * Sets the looping state of the player.
	 * @param state Whether the audio should loop
	 */
	abstract setLoopState(state: boolean): void;
	/**
	 * Sets the playback rate of the player.
	 * @param playbackRate The playback rate
	 */
	abstract setPlaybackRate(playbackRate: number): void;

	abstract getVolume(): number;
	abstract getPan(): number;
	abstract getLoopState(): boolean;
	abstract getPlaybackRate(): number;

	/** Returns the current time of audio playback. */
	abstract getCurrentTime(): number;
	abstract getDuration(): number;
	/** Returns true if the loaded audio is shorter than 10 milliseconds. */
	isReallyShort() {
		return this.getDuration() < 0.01; // Audio this short sucks for looping
	}

	/** Clones this player with all the audio information and settings, but doesn't clone its current playback state. */
	abstract clone(): AudioPlayer;
}