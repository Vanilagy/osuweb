import { InteractionRegistration, fullscreenHitRec } from "./interactivity";
import { globalState } from "../global_state";
import { changeSettingAndUpdateSettingsPanel } from "../menu/settings/settings";

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
		});
	}
}