import { Point } from "../../util/point";
import { MathUtil } from "../../util/math_util";
import { TimingPoint } from "../../datamodel/beatmap";
import { VirtualFile } from "../../file_system/virtual_file";
import { VirtualDirectory } from "../../file_system/virtual_directory";
import { charIsDigit, promiseAllSettled } from "../../util/misc_util";
import { soundEffectsNode, audioContext } from "../../audio/audio";
import { SoundEmitter } from "../../audio/sound_emitter";
import { PLAYFIELD_DIMENSIONS } from "../../util/constants";

const HIT_SOUND_PAN_DIVISOR = 800; // How many osu!pixels from the center of the screen one has to move for the hit sound to be fully on either the left or right audio channel

export interface HitSoundInfo {
    base: OsuSoundType,
    additions?: OsuSoundType[],
    volume: number,
    sampleIndex?: number,
    position?: Point
}

export function getHitSoundTypesFromSampleSetAndBitfield(sampleSet: number, bitfield: number) {
    let types: OsuSoundType[] = [];

    if ((bitfield & 1) !== 0) {
        if (sampleSet === 1) types.push(OsuSoundType.NormalHitNormal);
        else if (sampleSet === 2) types.push(OsuSoundType.SoftHitNormal);
        else if (sampleSet === 3) types.push(OsuSoundType.DrumHitNormal);
    }

    if ((bitfield & 2) !== 0) {
        if (sampleSet === 1) types.push(OsuSoundType.NormalHitWhistle);
        else if (sampleSet === 2) types.push(OsuSoundType.SoftHitWhistle);
        else if (sampleSet === 3) types.push(OsuSoundType.DrumHitWhistle);
    }

    if ((bitfield & 4) !== 0) {
        if (sampleSet === 1) types.push(OsuSoundType.NormalHitFinish);
        else if (sampleSet === 2) types.push(OsuSoundType.SoftHitFinish);
        else if (sampleSet === 3) types.push(OsuSoundType.DrumHitFinish);
    }
    
    if ((bitfield & 8) !== 0) {
        if (sampleSet === 1) types.push(OsuSoundType.NormalHitClap);
        else if (sampleSet === 2) types.push(OsuSoundType.SoftHitClap);
        else if (sampleSet === 3) types.push(OsuSoundType.DrumHitClap);
    }

    return types;
}

export function getTickHitSoundTypeFromSampleSet(sampleSet: number) {
    if (sampleSet === 1) return OsuSoundType.NormalSliderTick;
    else if (sampleSet === 2) return OsuSoundType.SoftSliderTick;
    else if (sampleSet === 3) return OsuSoundType.DrumSliderTick;
}

export function getSliderSlideTypesFromSampleSet(sampleSet: number, bitfield: number) {
    let types: OsuSoundType[] = [];

    bitfield |= 1; // Normal sound is always played

    if ((bitfield & 1) !== 0) {
        if (sampleSet === 1) types.push(OsuSoundType.NormalSliderSlide);
        else if (sampleSet === 2) types.push(OsuSoundType.SoftSliderSlide);
        else if (sampleSet === 3) types.push(OsuSoundType.DrumSliderSlide);
    }
    if ((bitfield & 2) !== 0) {
        if (sampleSet === 1) types.push(OsuSoundType.NormalSliderWhistle);
        else if (sampleSet === 2) types.push(OsuSoundType.SoftSliderWhistle);
        else if (sampleSet === 3) types.push(OsuSoundType.DrumSliderWhistle);
    }
    // Only normal and whistle are supported, so ignore finish and clap.

    return types;
}

export function determineSampleSet(sampleSet: number, timingPoint: TimingPoint) {
    return MathUtil.clamp(sampleSet || timingPoint.sampleSet || timingPoint.beatmap.sampleSet, 1, 3);
}

export function determineVolume(volume: number, timingPoint: TimingPoint) {
    return volume || timingPoint.volume;
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
        position: position
	};
    
    return info;
}

export class OsuSound {
    private files: Map<number, VirtualFile>;
    private audioBuffers: Map<number, AudioBuffer>;

    constructor(directory: VirtualDirectory, fileName: string) {
        this.files = new Map();
        this.audioBuffers = new Map();

        directory.forEachFile((file) => {
            if (!file.name.startsWith(fileName)) return;

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

            this.files.set(index, file);
        });
    }

	isEmpty() { // TODO. Eh. Is this fine?
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
                // Audio wasn't able to be decoded. Add no emitter.
            }
        }
    }

    getEmitter(volume: number, index = 1, pan = 0, playbackRate = 1.0) {
        let buffer = this.audioBuffers.get(index);
        if (!buffer) buffer = this.audioBuffers.get(1); // Default to the standard one. YES IT'S NOT 0 FOR A REASON.
		if (!buffer) return null;

        // TODO: How correct is this? Eeeeeeh
        volume = MathUtil.clamp(volume, 5, 10000);

        let emitter = new SoundEmitter(soundEffectsNode);
        emitter.setBuffer(buffer);
        emitter.setVolume(volume/100);
		emitter.setPan(pan);
		emitter.setPlaybackRate(playbackRate);

        return emitter;
    }

    play(volume: number, index?: number, pan?: number, playbackRate?: number) {
        let emitter = this.getEmitter(volume, index, pan, playbackRate);
        if (emitter) emitter.start();
    }
}

export function calculatePanFromOsuCoordinates(position: Point) {
    if (!position) return 0.0;

    let x = position.x - PLAYFIELD_DIMENSIONS.width/2;
    return MathUtil.clamp(x/HIT_SOUND_PAN_DIVISOR, -1.0, 1.0);
}

export enum OsuSoundType {
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
    DrumSliderTick,

    SpinnerSpin,
    SpinnerBonus,

    ComboBreak,

    SectionPass,
    SectionFail
}

export let osuSoundFileNames: Map<OsuSoundType, string> = new Map();
osuSoundFileNames.set(OsuSoundType.NormalHitNormal, "normal-hitnormal");
osuSoundFileNames.set(OsuSoundType.NormalHitWhistle, "normal-hitwhistle");
osuSoundFileNames.set(OsuSoundType.NormalHitFinish, "normal-hitfinish");
osuSoundFileNames.set(OsuSoundType.NormalHitClap, "normal-hitclap");
osuSoundFileNames.set(OsuSoundType.NormalSliderSlide, "normal-sliderslide");
osuSoundFileNames.set(OsuSoundType.NormalSliderWhistle, "normal-sliderwhistle");
osuSoundFileNames.set(OsuSoundType.NormalSliderTick, "normal-slidertick");
//
osuSoundFileNames.set(OsuSoundType.SoftHitNormal, "soft-hitnormal");
osuSoundFileNames.set(OsuSoundType.SoftHitWhistle, "soft-hitwhistle");
osuSoundFileNames.set(OsuSoundType.SoftHitFinish, "soft-hitfinish");
osuSoundFileNames.set(OsuSoundType.SoftHitClap, "soft-hitclap");
osuSoundFileNames.set(OsuSoundType.SoftSliderSlide, "soft-sliderslide");
osuSoundFileNames.set(OsuSoundType.SoftSliderWhistle, "soft-sliderwhistle");
osuSoundFileNames.set(OsuSoundType.SoftSliderTick, "soft-slidertick");
//
osuSoundFileNames.set(OsuSoundType.DrumHitNormal, "drum-hitnormal");
osuSoundFileNames.set(OsuSoundType.DrumHitWhistle, "drum-hitwhistle");
osuSoundFileNames.set(OsuSoundType.DrumHitFinish, "drum-hitfinish");
osuSoundFileNames.set(OsuSoundType.DrumHitClap, "drum-hitclap");
osuSoundFileNames.set(OsuSoundType.DrumSliderSlide, "drum-sliderslide");
osuSoundFileNames.set(OsuSoundType.DrumSliderWhistle, "drum-sliderwhistle");
osuSoundFileNames.set(OsuSoundType.DrumSliderTick, "drum-slidertick");
//
osuSoundFileNames.set(OsuSoundType.SpinnerSpin, "spinnerspin");
osuSoundFileNames.set(OsuSoundType.SpinnerBonus, "spinnerbonus");
//
osuSoundFileNames.set(OsuSoundType.ComboBreak, "combobreak");
//
osuSoundFileNames.set(OsuSoundType.SectionPass, "sectionpass");
osuSoundFileNames.set(OsuSoundType.SectionFail, "sectionfail");