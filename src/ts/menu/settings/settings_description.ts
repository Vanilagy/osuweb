import { RangeSliderOptions } from "../components/range_slider";
import { masterGain, mediaAudioNode, soundEffectsNode, audioContext } from "../../audio/audio";
import { AudioUtil } from "../../util/audio_util";

export enum SettingType {
	Range
}

export interface RangeSettingDescription {
	type: SettingType.Range,
	displayName: string,
	default: number,
	options: RangeSliderOptions
	onChange: (x: number) => void,
}

export type SettingDescription = RangeSettingDescription;

const buildSettings = <T extends Record<string, SettingDescription>>(settings: T) => settings;
export const settingsDescription = buildSettings({
	'masterVolume': {
		type: SettingType.Range,
		displayName: "Master",
		default: 0.7,
		options: {
			min: 0,
			max: 1,
			base: 0,
			tooltipFunction: x => (x * 100).toFixed(0)
		},
		onChange: (x) => masterGain.gain.linearRampToValueAtTime(AudioUtil.rescaleGain(x), audioContext.currentTime + 0.05)
	},
	'musicVolume': {
		type: SettingType.Range,
		displayName: "Music",
		default: 1.0,
		options: {
			min: 0,
			max: 1,
			base: 0,
			tooltipFunction: x => (x * 100).toFixed(0)
		},
		onChange: (x) => mediaAudioNode.gain.linearRampToValueAtTime(AudioUtil.rescaleGain(x), audioContext.currentTime + 0.05)
	},
	'soundEffectsVolume': {
		type: SettingType.Range,
		displayName: "Sound effects",
		default: 1.0,
		options: {
			min: 0,
			max: 1,
			base: 0,
			tooltipFunction: x => (x * 100).toFixed(0)
		},
		onChange: (x) => soundEffectsNode.gain.linearRampToValueAtTime(AudioUtil.rescaleGain(x), audioContext.currentTime + 0.05)
	}
});