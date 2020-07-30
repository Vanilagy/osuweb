import { RangeSliderOptions } from "../components/range_slider";
import { masterGain, mediaAudioNode, soundEffectsNode, audioContext } from "../../audio/audio";
import { AudioUtil } from "../../util/audio_util";
import { EMPTY_FUNCTION, toPercentageString } from "../../util/misc_util";
import { globalState } from "../../global_state";

export enum SettingType {
	Range,
	Checkbox,
	Selection
}

/** Represents a setting whose value spaces is a continuous set of values in an interval. */
export interface RangeSettingDescription {
	type: SettingType.Range,
	displayName: string,
	default: number,
	options: RangeSliderOptions
	onChange: (x: RangeSettingDescription["default"]) => void,
}

/** Represents an "on/off" setting */
export interface CheckboxSettingDescription {
	type: SettingType.Checkbox,
	displayName: string,
	default: boolean,
	onChange: (x: CheckboxSettingDescription["default"]) => void
}

/** Represents a setting which can only take on specific values from a list. */
export interface SelectionSettingDescription {
	type: SettingType.Selection,
	displayName: string,
	default: keyof SelectionSettingDescription["options"],
	options: Record<string, string>,
	onChange: (x: SelectionSettingDescription["default"]) => void
}

export type SettingDescription = RangeSettingDescription | CheckboxSettingDescription | SelectionSettingDescription;

const buildSettings = <T extends Record<string, SettingDescription>>(settings: T) => settings;
export const settingsDescriptionExact = buildSettings({
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
	},
	'ignoreBeatmapSkin': {
		type: SettingType.Checkbox,
		displayName: "Ignore beatmap skin",
		default: false,
		onChange: EMPTY_FUNCTION
	},
	'ignoreBeatmapHitSounds': {
		type: SettingType.Checkbox,
		displayName: "Ignore beatmap hit sounds",
		default: false,
		onChange: EMPTY_FUNCTION
	},
	'backgroundDim': {
		type: SettingType.Range,
		displayName: "Background dim",
		default: 0.85,
		options: {
			min: 0,
			max: 1,
			base: 0,
			tooltipFunction: x => toPercentageString(x, 0)
		},
		onChange: EMPTY_FUNCTION
	},
	'menuFpsLimit': {
		type: SettingType.Selection,
		displayName: "FPS limit in menus",
		options: {
			'#30': "30",
			'#60': "60",
			'#120': "120",
			'#144': "144",
			'#240': "240",
			'#360': "360",
			'uncapped': "Uncapped"
		},
		default: '#144',
		onChange: EMPTY_FUNCTION
	},
	'gameplayFpsLimit': {
		type: SettingType.Selection,
		displayName: "FPS limit in gameplay",
		options: {
			'#30': "30",
			'#60': "60",
			'#120': "120",
			'#144': "144",
			'#240': "240",
			'#360': "360",
			'uncapped': "Uncapped"
		},
		default: 'uncapped',
		onChange: EMPTY_FUNCTION
	},
	'showFpsMeter': {
		type: SettingType.Checkbox,
		displayName: "Show FPS meter",
		default: true,
		onChange: state => {
			if (state) globalState.fpsMeter?.show();
			else globalState.fpsMeter?.hide();
		}
	}
});

type S = typeof settingsDescriptionExact;
export const settingsDescription: {
	[K in keyof S]:
		S[K] extends RangeSettingDescription ? RangeSettingDescription :
		S[K] extends CheckboxSettingDescription ? CheckboxSettingDescription :
		SelectionSettingDescription
} = settingsDescriptionExact;