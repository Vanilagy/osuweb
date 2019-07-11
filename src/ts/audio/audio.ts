import { MathUtil } from "../util/math_util";
import { fetchAsArrayBuffer } from "../util/network_util";

const DEFAULT_MASTER_GAIN_VALUME = 0.05;
const MEDIA_NUDGE_INTERVAL = 333; // In ms
const OBSERVED_AUDIO_MEDIA_OFFSET = 12; // In ms. Seemed like the HTMLAudioElement.currentTime was a few AHEAD of the actual sound being heard, causing the visuals to be shifted forwards in time. By subtracting these milliseconds from the returned currentTime, we compensate for that and further synchronize the visuals and gameplay with the audio.

export let audioContext = new AudioContext();

let masterGain = audioContext.createGain();
masterGain.gain.value = DEFAULT_MASTER_GAIN_VALUME;
masterGain.connect(audioContext.destination);

interface SoundEmitterOptions {
    buffer?: AudioBuffer,
    volume?: number,
    playbackRate?: number
}

export function getAudioBuffer(arrayBuffer: ArrayBuffer) {
    return new Promise<AudioBuffer>((resolve) => {
        audioContext.decodeAudioData(arrayBuffer, (audioBuffer) => resolve(audioBuffer));
    });
}

export class SoundEmitter {
    private volume: number = 1; // !???!
    private playbackRate: number = 1;
    private sourceNode: AudioBufferSourceNode = null;
    private gainNode: GainNode;
    private audioStartTime: number = null;
    private buffer: AudioBuffer = null;
    private offset: number = 0;

    constructor(options: SoundEmitterOptions = {}) {
        if (options.buffer) this.setBuffer(options.buffer);
        if (options.volume) this.volume = options.volume;
        if (options.playbackRate) this.playbackRate = options.playbackRate;

        this.gainNode = audioContext.createGain();
        this.setVolume(this.volume);

        this.gainNode.connect(masterGain);
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
    }

    getCurrentTime() {
        if (this.audioStartTime === null) return 0;
        return (audioContext.currentTime - this.audioStartTime + this.offset) * this.playbackRate;
    }
}

export class MediaPlayer {
    private audioElement: HTMLAudioElement = null;
    private audioNode: MediaElementAudioSourceNode = null;
    private currentUrl: string = null;
    private startTime: number = null;
    private timingDeltas: number[] = [];
    private lastNudgeTime: number = null;
    private offset: number;
    private playing: boolean = false;
    private timeout: any; // any 'cause it, for some reason, doesn't work with 'number'
    private pausedTime: number = null;
    private volume: number = 1;
    private gainNode: GainNode;

    constructor() {
        this.gainNode = audioContext.createGain();
        this.setVolume(this.volume);

        this.gainNode.connect(masterGain);
    }

    setVolume(newVolume: number) {
        this.volume = newVolume;
        this.gainNode.gain.value = this.volume;
    }

    private resetAudioElement() {
        if (this.audioNode) {
            this.audioNode.disconnect();
        }

        this.audioElement = new Audio();
        this.audioNode = audioContext.createMediaElementSource(this.audioElement);
        this.audioNode.connect(this.gainNode);
        this.timingDeltas.length = 0;
        this.lastNudgeTime = null;
        this.pausedTime = null;
        this.startTime = null;
    }

    loadBuffer(buffer: ArrayBuffer) {
        let url = URL.createObjectURL(new Blob([buffer]));
        return this.loadUrl(url);
    }

    loadUrl(url: string) {
        return new Promise((resolve) => {
            if (this.currentUrl) URL.revokeObjectURL(this.currentUrl);
            this.currentUrl = url;

            this.resetAudioElement();
            this.audioElement.src = url;

            // Fires once the browser thinks it can play the whole file without buffering
            this.audioElement.addEventListener('canplaythrough', () => {
                resolve();
            });
        });
    }

    // Offset in seconds: Positive = Start the sound at that time, Negative = Start in the song in -offset seconds
    start(offset: number = 0) {
        if (!this.audioElement) {
            console.error("Cannot start MediaPlayer as it has no media to play.");
            return;
        }

        this.offset = offset;
        this.startTime = performance.now();
        this.pausedTime = null;

        if (this.offset >= 0) {
            this.audioElement.currentTime = this.offset;
            this.audioElement.play();
        } else {
            // Any inaccuracies in this timeout (+-2ms) will be ironed out by the nudging algorithm in getCurrentTime
            this.timeout = setTimeout(() => {
                this.audioElement.play();
            }, this.offset * -1 * 1000);
        }

        this.playing = true;
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

    getCurrentTime() {
        if (this.startTime === null) return 0;
        if (this.pausedTime !== null) return this.pausedTime;

        let now = performance.now();
        let offsetMs = this.offset * 1000;

        let calculated = now - this.startTime + offsetMs;
        let actual = this.audioElement.currentTime * 1000;

        // Only do this if the audio element has started playing, which, when its currentTime is 0, is likely not the case.
        if (actual > 0) {
            let delta = calculated - actual;
            this.timingDeltas.push(delta);

            // Keep the calculated time as close as possible to the ACTUAL time of the audio. The reason we don't use HTMLAudioElement.currentTime for getting the current time directly, is that it tends to fluctuate +-5ms. We avoid that fluctuation by using performance.now(), but that requires us to perform this synchronization:

            if (this.lastNudgeTime === null) this.lastNudgeTime = now;
            if (now - this.lastNudgeTime >= MEDIA_NUDGE_INTERVAL) {
                let average = MathUtil.getAvgInArray(this.timingDeltas); // Average of last deltas
                if (Math.abs(average) >= 5) console.warn("High average media playback delta: " + average + "ms - Nudging offset...");
                this.startTime += average / 2; // Nudge closer towards zero

                this.timingDeltas.length = 0;
                this.lastNudgeTime = now;
            }
        }

        return (calculated - OBSERVED_AUDIO_MEDIA_OFFSET) / 1000; // return in seconds
    }

    isPlaying() {
        return this.playing;
    }

    isPaused() {
        return !this.isPlaying() && this.pausedTime !== undefined;
    }
}

export let mainMusicMediaPlayer = new MediaPlayer();

export let normalHitSoundEffect = new SoundEmitter();
normalHitSoundEffect.setVolume(0.25);

async function initHitSound() {
    let buffer = await fetchAsArrayBuffer('./assets/sound/normal-hitnormal.wav');
    normalHitSoundEffect.setBuffer(await getAudioBuffer(buffer));    
}
initHitSound();