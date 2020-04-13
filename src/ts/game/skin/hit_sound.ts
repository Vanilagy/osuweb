import { Point } from "../../util/point";
import { MathUtil } from "../../util/math_util";
import { TimingPoint } from "../../datamodel/beatmap";
import { VirtualFile } from "../../file_system/virtual_file";
import { VirtualDirectory } from "../../file_system/virtual_directory";
import { charIsDigit, promiseAllSettled } from "../../util/misc_util";
import { soundEffectsNode, audioContext } from "../../audio/audio";
import { PLAYFIELD_DIMENSIONS } from "../../util/constants";
import { AudioBufferPlayer } from "../../audio/audio_buffer_player";
import { EMPTY_AUDIO_BUFFER } from "../../util/audio_util";

const HIT_SOUND_PAN_DIVISOR = 800; // How many osu!pixels from the center of the screen one has to move for the hit sound to be fully on either the left or right audio channel

export enum HitSoundType {
    NormalHitNormal,
    NormalHitWhistle,
    NormalHitFinish,
    NormalHitClap,
    NormalSliderSlide,
    NormalSliderWhistle,
    NormalSliderTick,

    SoftHitNormal,
    SoftHitWhistle,
    SoftHitFinish,
    SoftHitClap,
    SoftSliderSlide,
    SoftSliderWhistle,
    SoftSliderTick,

    DrumHitNormal,
    DrumHitWhistle,
    DrumHitFinish,
    DrumHitClap,
    DrumSliderSlide,
    DrumSliderWhistle,
    DrumSliderTick
}

export enum AdditionType {
	Normal = 0,
	Whistle = 1,
	Finish = 2,
	Clap = 3
}

export let hitSoundFilenames: Map<HitSoundType, string> = new Map();
// normal
hitSoundFilenames.set(HitSoundType.NormalHitNormal, "normal-hitnormal");
hitSoundFilenames.set(HitSoundType.NormalHitWhistle, "normal-hitwhistle");
hitSoundFilenames.set(HitSoundType.NormalHitFinish, "normal-hitfinish");
hitSoundFilenames.set(HitSoundType.NormalHitClap, "normal-hitclap");
hitSoundFilenames.set(HitSoundType.NormalSliderSlide, "normal-sliderslide");
hitSoundFilenames.set(HitSoundType.NormalSliderWhistle, "normal-sliderwhistle");
hitSoundFilenames.set(HitSoundType.NormalSliderTick, "normal-slidertick");
// soft
hitSoundFilenames.set(HitSoundType.SoftHitNormal, "soft-hitnormal");
hitSoundFilenames.set(HitSoundType.SoftHitWhistle, "soft-hitwhistle");
hitSoundFilenames.set(HitSoundType.SoftHitFinish, "soft-hitfinish");
hitSoundFilenames.set(HitSoundType.SoftHitClap, "soft-hitclap");
hitSoundFilenames.set(HitSoundType.SoftSliderSlide, "soft-sliderslide");
hitSoundFilenames.set(HitSoundType.SoftSliderWhistle, "soft-sliderwhistle");
hitSoundFilenames.set(HitSoundType.SoftSliderTick, "soft-slidertick");
// drum
hitSoundFilenames.set(HitSoundType.DrumHitNormal, "drum-hitnormal");
hitSoundFilenames.set(HitSoundType.DrumHitWhistle, "drum-hitwhistle");
hitSoundFilenames.set(HitSoundType.DrumHitFinish, "drum-hitfinish");
hitSoundFilenames.set(HitSoundType.DrumHitClap, "drum-hitclap");
hitSoundFilenames.set(HitSoundType.DrumSliderSlide, "drum-sliderslide");
hitSoundFilenames.set(HitSoundType.DrumSliderWhistle, "drum-sliderwhistle");
hitSoundFilenames.set(HitSoundType.DrumSliderTick, "drum-slidertick");

export function hitSoundTypeToAdditionType(type: HitSoundType) {
	let num = type % 7;

	if (num === 0) return AdditionType.Normal;
	if (num === 1) return AdditionType.Whistle;
	if (num === 2) return AdditionType.Finish;
	if (num === 3) return AdditionType.Clap;

	return null;
}

export interface HitSoundInfo {
    base: HitSoundType,
    additions?: HitSoundType[],
    volume: number,
    sampleIndex?: number,
	position?: Point,
	timingPoint: TimingPoint
}

export function getHitSoundTypesFromSampleSetAndBitfield(sampleSet: number, bitfield: number) {
    let types: HitSoundType[] = [];

    if ((bitfield & 1) !== 0) {
        if (sampleSet === 1) types.push(HitSoundType.NormalHitNormal);
        else if (sampleSet === 2) types.push(HitSoundType.SoftHitNormal);
        else if (sampleSet === 3) types.push(HitSoundType.DrumHitNormal);
    }

    if ((bitfield & 2) !== 0) {
        if (sampleSet === 1) types.push(HitSoundType.NormalHitWhistle);
        else if (sampleSet === 2) types.push(HitSoundType.SoftHitWhistle);
        else if (sampleSet === 3) types.push(HitSoundType.DrumHitWhistle);
    }

    if ((bitfield & 4) !== 0) {
        if (sampleSet === 1) types.push(HitSoundType.NormalHitFinish);
        else if (sampleSet === 2) types.push(HitSoundType.SoftHitFinish);
        else if (sampleSet === 3) types.push(HitSoundType.DrumHitFinish);
    }
    
    if ((bitfield & 8) !== 0) {
        if (sampleSet === 1) types.push(HitSoundType.NormalHitClap);
        else if (sampleSet === 2) types.push(HitSoundType.SoftHitClap);
        else if (sampleSet === 3) types.push(HitSoundType.DrumHitClap);
    }

    return types;
}

export function getTickHitSoundTypeFromSampleSet(sampleSet: number) {
    if (sampleSet === 1) return HitSoundType.NormalSliderTick;
    else if (sampleSet === 2) return HitSoundType.SoftSliderTick;
    else if (sampleSet === 3) return HitSoundType.DrumSliderTick;
}

export function getSliderSlideTypesFromSampleSet(sampleSet: number, bitfield: number) {
    let types: HitSoundType[] = [];

    bitfield |= 1; // Normal sound is always played

    if ((bitfield & 1) !== 0) {
        if (sampleSet === 1) types.push(HitSoundType.NormalSliderSlide);
        else if (sampleSet === 2) types.push(HitSoundType.SoftSliderSlide);
        else if (sampleSet === 3) types.push(HitSoundType.DrumSliderSlide);
    }
    if ((bitfield & 2) !== 0) {
        if (sampleSet === 1) types.push(HitSoundType.NormalSliderWhistle);
        else if (sampleSet === 2) types.push(HitSoundType.SoftSliderWhistle);
        else if (sampleSet === 3) types.push(HitSoundType.DrumSliderWhistle);
    }
    // Only normal and whistle are supported, so ignore finish and clap.

    return types;
}

export function determineSampleSet(sampleSet: number, timingPoint: TimingPoint) {
    return MathUtil.clamp(sampleSet || timingPoint.sampleSet || timingPoint.beatmap.sampleSet, 1, 3);
}

export function determineVolume(volume: number, timingPoint: TimingPoint) {
    return MathUtil.clamp(volume || timingPoint.volume, 5, 10000); // TODO: How correct is this clamp? Eeeeeeh
}

export function determineSampleIndex(sampleIndex: number, timingPoint: TimingPoint) {
    return sampleIndex || timingPoint.sampleIndex || 1;
}

export function generateHitSoundInfo(hitSound: number, baseSet: number, additionSet: number, volume: number, sampleIndex: number, timingPoint: TimingPoint, position?: Point) {
    baseSet = determineSampleSet(baseSet, timingPoint);
    additionSet = determineSampleSet(additionSet || baseSet, timingPoint); // "Today, additionSet inherits from sampleSet. Otherwise, it inherits from the timing point."
    volume = determineVolume(volume, timingPoint);
    sampleIndex = determineSampleIndex(sampleIndex, timingPoint);

    let baseType = getHitSoundTypesFromSampleSetAndBitfield(baseSet, 1)[0]; // "The normal sound is always played, so bit 0 is irrelevant today."
    let additionTypes = getHitSoundTypesFromSampleSetAndBitfield(additionSet, hitSound & ~1);

    let info: HitSoundInfo = {
        base: baseType,
        additions: additionTypes,
        volume: volume,
        sampleIndex: sampleIndex,
		position: position,
		timingPoint: timingPoint
	};
    
    return info;
}

export class HitSound {
    private files: Map<number, VirtualFile>;
    private audioBuffers: Map<number, AudioBuffer>;

    constructor() {
        this.files = new Map();
        this.audioBuffers = new Map();
	}

	isEmpty() {
		return this.files.size === 0;
    }

    async ready() {
        let audioBufferPromises: Promise<AudioBuffer>[] = [];

        for (let [key, file] of this.files) {
            let arrayBuffer = await file.readAsArrayBuffer();
            audioBufferPromises.push(audioContext.decodeAudioData(arrayBuffer));
        }

        let audioBuffers = await promiseAllSettled(audioBufferPromises);
        for (let [key, file] of this.files) {
            let elem = audioBuffers.shift();

            if (elem.status === "fulfilled") {
                this.audioBuffers.set(key, elem.value);
            } else {
				this.audioBuffers.set(key, EMPTY_AUDIO_BUFFER);
                // Audio wasn't able to be decoded. Add an empty buffer.
            }
        }
    }

    getPlayer(volume: number, index = 1, pan = 0, playbackRate = 1.0) {
        let buffer = this.audioBuffers.get(index);
        if (!buffer) buffer = this.audioBuffers.get(1); // Default to the standard one. YES IT'S NOT 0 FOR A REASON.
		if (!buffer) return null;

        let player = new AudioBufferPlayer(soundEffectsNode);
        player.loadAudioBuffer(buffer);
        player.setVolume(volume/100);
		player.setPan(pan);
		player.setPlaybackRate(playbackRate);

        return player;
    }

    play(volume: number, index?: number, pan?: number, playbackRate?: number) {
        let player = this.getPlayer(volume, index, pan, playbackRate);
        if (player) player.start();
	}

	clone() {
		let clone = new HitSound();

		this.files.forEach((file, key) => clone.files.set(key, file));
		this.audioBuffers.forEach((buffer, key) => clone.audioBuffers.set(key, buffer));

		return clone;
	}
	
	/** Creates a clone and copies all files and buffers of the passed hit sound into the clone. */
	joinWith(otherHitSound: HitSound) {
		let clone = this.clone();

		otherHitSound.files.forEach((file, key) => clone.files.set(key, file));
		otherHitSound.audioBuffers.forEach((buffer, key) => clone.audioBuffers.set(key, buffer));

		return clone;
	}

	static initFromFilename(directory: VirtualDirectory, filename: string) {
		let hitSound = new HitSound();

		directory.forEachFile((file) => {
            if (!file.name.startsWith(filename)) return;

            let rawName = file.getNameWithoutExtension();
            let endIndex = rawName.length;

            while (endIndex > 0) {
                let char = rawName.charAt(endIndex - 1);
                if (charIsDigit(char)) endIndex--;
                else break;
            }

            let indexString = rawName.slice(endIndex);
            let index = 1;
            if (indexString) {
                index = Number(indexString);
            }

            hitSound.files.set(index, file);
		});
		
		return hitSound;
	}
}

export function calculatePanFromOsuCoordinates(position: Point) {
    if (!position) return 0.0;

    let x = position.x - PLAYFIELD_DIMENSIONS.width/2;
    return MathUtil.clamp(x/HIT_SOUND_PAN_DIVISOR, -1.0, 1.0);
}