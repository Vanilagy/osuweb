import { RangeSliderOptions } from "../components/range_slider";
import { masterGain, mediaAudioNode, soundEffectsNode, audioContext } from "../../audio/audio";
import { AudioUtil } from "../../util/audio_util";
import { toPercentageString } from "../../util/misc_util";
import { globalState } from "../../global_state";
import { setMouseSensitivity } from "../../input/input";
import { NotificationType } from "../notifications/notification";

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
	options: RangeSliderOptions,
	onChange?: (x: RangeSettingDescription["default"]) => void,
	/** Called when the range slider is releaased. */
	onFinish?: (x: RangeSettingDescription["default"]) => void,
}

/** Represents an "on/off" setting */
export interface CheckboxSettingDescription {
	type: SettingType.Checkbox,
	displayName: string,
	default: boolean,
	onChange?: (x: CheckboxSettingDescription["default"]) => void
}

/** Represents a setting which can only take on specific values from a list. */
export interface SelectionSettingDescription {
	type: SettingType.Selection,
	displayName: string,
	default: keyof SelectionSettingDescription["options"],
	options: Record<string, string>,
	onChange?: (x: SelectionSettingDescription["default"]) => void
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
	'backgroundAudioBehavior': {
		type: SettingType.Selection,
		displayName: "Audio behavior when tab in background",
		options: {
			'none': "Keep at full volume",
			'quiet': "Quiet",
			'mute': "Mute"
		},
		default: 'quiet'
	},
	'ignoreBeatmapSkin': {
		type: SettingType.Checkbox,
		displayName: "Ignore beatmap skin",
		default: false
	},
	'ignoreBeatmapHitSounds': {
		type: SettingType.Checkbox,
		displayName: "Ignore beatmap hit sounds",
		default: false
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
		}
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
		default: '#144'
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
		default: 'uncapped'
	},
	'showFpsMeter': {
		type: SettingType.Checkbox,
		displayName: "Show FPS meter",
		default: true,
		onChange: state => {
			if (state) globalState.fpsMeter?.show();
			else globalState.fpsMeter?.hide();
		}
	},
	'reduceFpsWhenBlurred': {
		type: SettingType.Checkbox,
		displayName: "Reduce FPS when page is unfocused",
		default: true
	},
	'snakingSliders': {
		type: SettingType.Checkbox,
		displayName: "Snaking sliders",
		default: true
	},
	'enableVideo': {
		type: SettingType.Checkbox,
		displayName: "Show background video",
		default: true
	},
	'enableStoryboard': {
		type: SettingType.Checkbox,
		displayName: "Show storyboard",
		default: true
	},
	'showKeyOverlay': {
		type: SettingType.Checkbox,
		displayName: "Show key overlay",
		default: true
	},
	'showApproachCircleOnFirstHiddenObject': {
		type: SettingType.Checkbox,
		displayName: "Show approach circle on first hidden object",
		default: true
	},
	'useSoftwareCursor': {
		type: SettingType.Checkbox,
		displayName: "Use software cursor",
		default: false,
		onChange: (val) => {
			globalState.cursor.refresh();

			if (val && globalState.settings['mouseInputMode'] === 'raw') {
				document.documentElement.requestPointerLock();
				showRawInputModeWarning();
			} else {
				document.exitPointerLock();
			}

			if (val) {
				globalState.settingsPanel.enableElement('mouseSensitivity');
				globalState.settingsPanel.enableElement('mouseInputMode');
			} else {
				// These settings have no effect with a hardware cursor, so disable them.
				globalState.settingsPanel.disableElement('mouseSensitivity');
				globalState.settingsPanel.disableElement('mouseInputMode'); 
			}
		}
	},
	/** The main idea here is that tablet and mouse users have different needs for input. For mouse, raw input is very important, and absolutely positioning not really a factor. For a tablet, it's crucial that the same physical location map to the same location in-game. */
	'mouseInputMode': {
		type: SettingType.Selection,
		displayName: "Mouse input mode",
		default: 'absolute',
		options: {
			'absolute': "Absolute",
			'raw': "Raw"
		},
		onChange: (setting) => {
			if (!globalState.settings['useSoftwareCursor']) return;

			if (setting === 'absolute') document.exitPointerLock();
			else if (setting === 'raw') {
				document.documentElement.requestPointerLock();
				showRawInputModeWarning();
			}

			updateLowSensitivityWarning();
		}
	},
	'mouseSensitivity': {
		type: SettingType.Range,
		displayName: "Mouse sensitivity factor",
		default: 1.0,
		options: {
			min: 0.4,
			max: 6,
			base: 1,
			tooltipFunction: x => 'x' + x.toFixed(2)
		},
		onFinish: (x) => {
			setMouseSensitivity(x);
			updateLowSensitivityWarning();
		}
	},
	'disableMouseButtonsDuringGameplay': {
		type: SettingType.Checkbox,
		displayName: "Disable mouse buttons during gameplay",
		default: false
	},
	'audioOffset': {
		type: SettingType.Range,
		displayName: "Audio offset",
		default: 0,
		options: {
			min: -300,
			max: 300,
			base: 0,
			tooltipFunction: x => (x > 0? '+' : '') + x.toFixed(0) + ' ms'
		}
	},
	'cursorSize': {
		type: SettingType.Range,
		displayName: "Cursor size",
		default: 1,
		options: {
			min: 0.1,
			max: 2,
			base: 0.1,
			tooltipFunction: x => 'x' + x.toFixed(2)
		},
		onChange: (x) => {
			globalState.cursor.refresh();
		}
	},
	'automaticallyStoreSingleBeatmapSetImports': {
		type: SettingType.Checkbox,
		displayName: "Automatically store single-beatmap set imports",
		default: true
	},
	'retryFailedImportsOnFolderReopen': {
		type: SettingType.Checkbox,
		displayName: "Retry failed imports on folder reopen",
		default: false
	}
});

type S = typeof settingsDescriptionExact;
export const settingsDescription: {
	[K in keyof S]:
		S[K] extends RangeSettingDescription ? RangeSettingDescription :
		S[K] extends CheckboxSettingDescription ? CheckboxSettingDescription :
		SelectionSettingDescription
} = settingsDescriptionExact;

function showRawInputModeWarning() {
	globalState.notificationPanel.showNotification("Raw mouse input activated", "To exit, move the cursor to the side and press ESC.", NotificationType.Warning);
}

function updateLowSensitivityWarning() {
	if (globalState.settings['mouseSensitivity'] < 1.0 && globalState.settings['mouseInputMode'] !== 'raw') {
		globalState.settingsPanel.enableElement('lowSensitivityWarning');
	} else {
		globalState.settingsPanel.disableElement('lowSensitivityWarning');
	}
}