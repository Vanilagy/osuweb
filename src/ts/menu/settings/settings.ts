import { settingsDescription } from "./settings_description";

type Settings = {
	[P in keyof typeof settingsDescription]: (typeof settingsDescription)[P]["default"]
}
export type SettingName = keyof Settings;

function generateDefaultSettings() {
	let settings = {} as Settings;

	for (let key in settingsDescription) {
		let typedKey = key as keyof typeof settingsDescription;
		settings[typedKey] = settingsDescription[typedKey].default; // Set it to the default value
		settingsDescription[typedKey].onChange(settings[typedKey]); // Immediately execution the change function to make sure the setting takes effect
	}

	return settings;
}

export const settings: Settings = generateDefaultSettings();