import { settingsDescription } from "./settings_description";

export type Settings = {
	[P in keyof typeof settingsDescription]: (typeof settingsDescription)[P]["default"]
}
export type SettingName = keyof Settings;

export function generateDefaultSettings() {
	let settings = {} as Settings;

	for (let key in settingsDescription) {
		let typedKey = key as keyof typeof settingsDescription;

		// Yo these 'any' type assertions are stupid, but it's quite hard to get TypeScript to understand that the argument type of onChange is not 'never'.
		(settings[typedKey] as any) = settingsDescription[typedKey].default; // Set it to the default value
		(settingsDescription[typedKey].onChange as any)(settingsDescription[typedKey].default); // Immediately execution the change function to make sure the setting takes effect
	}

	return settings;
}