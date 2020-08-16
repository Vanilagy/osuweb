import { InteractionRegistration, fullscreenHitRec, KeybindEventData } from "./interactivity";
import { globalState } from "../global_state";
import { changeSettingAndUpdateSettingsPanel } from "../menu/settings/settings";
import { settingsDescription } from "../menu/settings/settings_description";
import { THEME_COLORS } from "../util/constants";
import { MathUtil } from "../util/math_util";

export class GlobalInputListener {
	public registration: InteractionRegistration;

	constructor() {
		this.registration = new InteractionRegistration(fullscreenHitRec);

		this.registration.addKeybindListener('toggleSettings', 'down', () => {
			if (globalState.gameplayController.currentPlay) return;
			globalState.settingsPanel.toggle();
		});
		this.registration.addKeybindListener('toggleNotifications', 'down', () => {
			if (globalState.gameplayController.currentPlay) return;
			globalState.notificationPanel.toggle();
		});
		this.registration.addKeybindListener('toggleMouseButtons', 'down', () => {
			changeSettingAndUpdateSettingsPanel('disableMouseButtonsDuringGameplay', !globalState.settings['disableMouseButtonsDuringGameplay']);
			globalState.toastManager.showToast(globalState.settings['disableMouseButtonsDuringGameplay']? "Mouse buttons disabled during gameplay." : "Mouse buttons enabled during gameplay.", THEME_COLORS.PrimaryViolet);
		});
		this.registration.addKeybindListener('increaseVolume', 'down', () => {
			globalState.volumeController.nudgeValue(true);
		});
		this.registration.addKeybindListener('decreaseVolume', 'down', () => {
			globalState.volumeController.nudgeValue(false);
		});
		this.registration.addKeybindListener('playPause', 'down', () => {
			if (globalState.gameplayController.currentPlay) return;
			globalState.musicPlayer.playPause();

			globalState.toastManager.showToast(globalState.musicPlayer.player.isPaused()? "Pause" : "Play", THEME_COLORS.PrimaryBlue);
		});
		this.registration.addKeybindListener('audioOffsetAdd', 'down', (e) => {
			nudgeAudioOffset(1, e);
		});
		this.registration.addKeybindListener('audioOffsetSubtract', 'down', (e) => {
			nudgeAudioOffset(-1, e);
		});
	}
}

function nudgeAudioOffset(direction: number, e: KeybindEventData) {
	if (globalState.gameplayController.currentPlay && globalState.gameplayController.currentPlay.paused) {
		// The user could change offset by a great amount while paused, and then will either skip tons of time when unpausing or be frozen for some time. We avoid this by simply only allowing changes to happen during gameplay!
		globalState.toastManager.showToast("Cannot adjust audio offset while paused.", THEME_COLORS.JudgementMiss);
		return;
	}

	let stepSize = ((e.keyIndex === 0)? 5 : 1) * direction; // The first key changes by 5, the second by 1
	let newValue = MathUtil.clamp(globalState.settings['audioOffset'] + stepSize, settingsDescription['audioOffset'].options.min, settingsDescription['audioOffset'].options.max);
	if (newValue === globalState.settings['audioOffset']) return; // Nothing's changed

	changeSettingAndUpdateSettingsPanel('audioOffset', newValue);
	let roundedValue = Number(newValue.toFixed(0));
	globalState.toastManager.showToast(`Audio offset changed to ${((roundedValue > 0)? '+' : '') + roundedValue} ms.`, THEME_COLORS.PrimaryViolet);
}