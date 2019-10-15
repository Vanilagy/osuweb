import { Point } from "../../util/point";
import { MathUtil } from "../../util/math_util";
import { TimingPoint } from "../../datamodel/beatmap";
import { VirtualFile } from "../../file_system/virtual_file";
import { VirtualDirectory } from "../../file_system/virtual_directory";
import { charIsDigit, promiseAllSettled } from "../../util/misc_util";
import { createAudioBuffer, soundEffectsNode } from "../../audio/audio";
import { SoundEmitter } from "../../audio/sound_emitter";
import { PLAYFIELD_DIMENSIONS } from "../../util/constants";

const HIT_SOUND_PAN_DIVISOR = 800; // How many osu!pixels from the center of the screen one has to move for the hit sound to be fully on either the left or right audio channel

export interface HitSoundInfo {
    base: HitSoundType,
    additions?: HitSoundType[],
    volume: number,
    index?: number,
    position?: Point
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

export function normSampleSet(sampleSet: number) {
    return MathUtil.clamp(sampleSet, 1, 3);
}

export function generateHitSoundInfo(hitSound: number, baseSet: number, additionSet: number, volume: number, index: number, timingPoint: TimingPoint, position?: Point) {
    baseSet = normSampleSet(baseSet || timingPoint.sampleSet || 1)
    additionSet = normSampleSet(additionSet || baseSet); // "Today, additionSet inherits from sampleSet. Otherwise, it inherits from the timing point."
    volume = volume || timingPoint.volume;
    index = index || timingPoint.sampleIndex || 1;

    let baseType = getHitSoundTypesFromSampleSetAndBitfield(baseSet, 1)[0]; // "The normal sound is always played, so bit 0 is irrelevant today."
    let additionTypes = getHitSoundTypesFromSampleSetAndBitfield(additionSet, hitSound & ~1);

    let info: HitSoundInfo = {
        base: baseType,
        additions: additionTypes,
        volume: volume,
        index: index,
        position: position
    };
    
    return info;
}

export class HitSound {
    private files: { [index: number]: VirtualFile };
    private audioBuffers: { [index: number]: AudioBuffer };

    constructor(directory: VirtualDirectory, fileName: string) {
        this.files = {};
        this.audioBuffers = {};

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

            this.files[index] = file;
        });
    }

    isEmpty() { // TODO. Eh. Is this fine?
        return Object.keys(this.files).length === 0;
    }

    async ready() {
        let audioBufferPromises: Promise<AudioBuffer>[] = [];

        for (let key in this.files) {
            let index = Number(key);
            let file = this.files[index];
            let arrayBuffer = await file.readAsArrayBuffer();

            audioBufferPromises.push(createAudioBuffer(arrayBuffer));

            /*
            try {
                let audioBuffer = await createAudioBuffer(arrayBuffer);

                this.audioBuffers[index] = audioBuffer;
            } catch(e) {
                // Audio wasn't able to be decoded. Add no emitter.
            }*/
        }

        let audioBuffers = await promiseAllSettled(audioBufferPromises);
        for (let key in this.files) {
            let index = Number(key);
            let elem = audioBuffers.shift();

            if (elem.status === "fulfilled") {
                this.audioBuffers[index] = elem.value;
            } else {
                // Audio wasn't able to be decoded. Add no emitter.
            }
        }
    }

    getEmitter(volume: number, index = 1, pan: number = 0) {
        let buffer = this.audioBuffers[index];
        if (!buffer) buffer = this.audioBuffers[1]; // Default to the standard one. YES IT'S NOT 0 FOR A REASON.
        if (!buffer) return null;

        // TODO: How correct is this? Eeeeeeh
        volume = MathUtil.clamp(volume, 5, 10000);

        let emitter = new SoundEmitter(soundEffectsNode);
        emitter.setBuffer(buffer);
        emitter.setVolume(volume/100);
        emitter.setPan(pan);

        return emitter;
    }

    play(volume: number, index = 1, pan: number = 0) {
        let emitter = this.getEmitter(volume, index, pan);
        if (emitter) emitter.start();
    }
}

export function calculatePanFromOsuCoordinates(position: Point) {
    if (!position) return 0.0;

    let x = position.x - PLAYFIELD_DIMENSIONS.width/2;
    return MathUtil.clamp(x/HIT_SOUND_PAN_DIVISOR, -1.0, 1.0);
}

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
    DrumSliderTick,

    SpinnerSpin,
    SpinnerBonus,

    ComboBreak
}

export let hitSoundFileNames: Map<HitSoundType, string> = new Map();
hitSoundFileNames.set(HitSoundType.NormalHitNormal, "normal-hitnormal");
hitSoundFileNames.set(HitSoundType.NormalHitWhistle, "normal-hitwhistle");
hitSoundFileNames.set(HitSoundType.NormalHitFinish, "normal-hitfinish");
hitSoundFileNames.set(HitSoundType.NormalHitClap, "normal-hitclap");
hitSoundFileNames.set(HitSoundType.NormalSliderSlide, "normal-sliderslide");
hitSoundFileNames.set(HitSoundType.NormalSliderWhistle, "normal-sliderwhistle");
hitSoundFileNames.set(HitSoundType.NormalSliderTick, "normal-slidertick");
//
hitSoundFileNames.set(HitSoundType.SoftHitNormal, "soft-hitnormal");
hitSoundFileNames.set(HitSoundType.SoftHitWhistle, "soft-hitwhistle");
hitSoundFileNames.set(HitSoundType.SoftHitFinish, "soft-hitfinish");
hitSoundFileNames.set(HitSoundType.SoftHitClap, "soft-hitclap");
hitSoundFileNames.set(HitSoundType.SoftSliderSlide, "soft-sliderslide");
hitSoundFileNames.set(HitSoundType.SoftSliderWhistle, "soft-sliderwhistle");
hitSoundFileNames.set(HitSoundType.SoftSliderTick, "soft-slidertick");
//
hitSoundFileNames.set(HitSoundType.DrumHitNormal, "drum-hitnormal");
hitSoundFileNames.set(HitSoundType.DrumHitWhistle, "drum-hitwhistle");
hitSoundFileNames.set(HitSoundType.DrumHitFinish, "drum-hitfinish");
hitSoundFileNames.set(HitSoundType.DrumHitClap, "drum-hitclap");
hitSoundFileNames.set(HitSoundType.DrumSliderSlide, "drum-sliderslide");
hitSoundFileNames.set(HitSoundType.DrumSliderWhistle, "drum-sliderwhistle");
hitSoundFileNames.set(HitSoundType.DrumSliderTick, "drum-slidertick");
//
hitSoundFileNames.set(HitSoundType.SpinnerSpin, "spinnerspin");
hitSoundFileNames.set(HitSoundType.SpinnerBonus, "spinnerbonus");
//
hitSoundFileNames.set(HitSoundType.ComboBreak, "combobreak");