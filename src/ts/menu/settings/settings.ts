import { settingsDescription, SettingType } from "./settings_description";
import { globalState } from "../../global_state";

export type Settings = {
	[P in keyof typeof settingsDescription]: (typeof settingsDescription)[P]["default"]
}
export type SettingName = keyof Settings;

export async function loadSettings() {
	let storedSettings = await globalState.database.keyValueStore.get('settings');
	if (storedSettings) return storedSettings;

	let settings = {} as Settings;

	for (let key in settingsDescription) {
		let typedKey = key as keyof typeof settingsDescription;

		// Yo these 'any' type assertions are stupid, but it's quite hard to get TypeScript to understand that the argument type of onChange is not 'never'.
		(settings[typedKey] as any) = settingsDescription[typedKey].default; // Set it to the default value
	}

	await globalState.database.keyValueStore.set('settings', settings);
	return settings;
}

export function applySettings() {
	for (let key in settingsDescription) {
		let typedKey = key as keyof typeof settingsDescription;

		let untyped = settingsDescription[typedKey] as any; // 'Cause I know what I'm doing better than TypeScript.
		if (untyped.onChange) untyped.onChange(globalState.settings[typedKey]); // Immediately execution the change function to make sure the setting takes effect
		if (untyped.onFinish) untyped.onFinish(globalState.settings[typedKey]); // Immediately execution the finish function to make sure the setting takes effect
	}
}

export function changeSetting<T extends SettingName>(setting: T, value: Settings[T]) {
	globalState.settings[setting] = value;
	let untypedDescription = settingsDescription[setting] as any;
	untypedDescription.onChange?.(value);
	untypedDescription.onFinish?.(value);

	globalState.database.keyValueStore.set('settings', globalState.settings);
}

export function changeSettingAndUpdateSettingsPanel<T extends SettingName>(setting: T, value: Settings[T]) {
	changeSetting(setting, value);
	globalState.settingsPanel.refreshElement(setting);
}