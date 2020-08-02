/** Can be any key code (the string, not the number), or MB(n) for the nth mouse button, or WheelUp/WheelDown. Additionally, modifiers Shift, Ctrl, Meta and Alt can be added infront (in that order alone!) to narrow the description. */
export type KeyDescription = string;

interface KeybindDescription {
	displayName: string,
	count: number,
	default: KeyDescription[]
}

const buildKeybinds = <T extends Record<string, KeybindDescription>>(keybinds: T) => keybinds;
const keybindDescriptionExact = buildKeybinds({
	// osu!standard
	"gameButtonA": {
		displayName: "Left button",
		count: 2,
		default: ["KeyZ", "MB0"]
	},
	"gameButtonB": {
		displayName: "Right button",
		count: 2,
		default: ["KeyX", "MB2"]
	},
	"smoke": {
		displayName: "Smoke",
		count: 1,
		default: ["KeyC"]
	},

	// gameplay
	"restartPlay": {
		displayName: "Restart",
		count: 1,
		default: ["Ctrl KeyR"]
	},
	"skipBreak": {
		displayName: "Skip break",
		count: 1,
		default: ["Space"]
	},
	"pause": {
		displayName: "Pause",
		count: 1,
		default: ["Escape"]
	},
	"toggleMouseButtons": {
		displayName: "Enable/Disable mouse buttons",
		count: 1,
		default: ["F10"]
	},

	// audio
	"increaseVolume": {
		displayName: "Increase volume",
		count: 2,
		default: ["Alt WheelUp", "Alt ArrowUp"]
	},
	"decreaseVolume": {
		displayName: "Decrease volume",
		count: 2,
		default: ["Alt WheelDown", "Alt ArrowDown"]
	},
	"playPause": {
		displayName: "Play/Pause",
		count: 1,
		default: ["F3"]
	},

	// general
	"toggleSettings": {
		displayName: "Toggle settings panel",
		count: 1,
		default: ["Ctrl KeyO"]
	},
	"toggleNotifications": {
		displayName: "Toggle notification panel",
		count: 1,
		default: ["Ctrl KeyN"]
	},
	"toggleModSelect": {
		displayName: "Toggle mod select",
		count: 1,
		default: ["F1"]
	},
	"randomBeatmap": {
		displayName: "Select random beatmap",
		count: 1,
		default: ["F2"]
	},
	"playBeatmap": {
		displayName: "Play beatmap",
		count: 1,
		default: ["Enter"]
	},
	"playBeatmapAuto": {
		displayName: "Play beatmap with AT",
		count: 1,
		default: ["Ctrl Enter"]
	},
	"playBeatmapCinema": {
		displayName: "Play beatmap with CN",
		count: 1,
		default: ["Shift Ctrl Enter"]
	},
	"scrollCarouselUp": {
		displayName: "Scroll carousel up",
		count: 1,
		default: ["PageUp"]
	},
	"scrollCarouselDown": {
		displayName: "Scroll carousel down",
		count: 1,
		default: ["PageDown"]
	},
	"searchRemoveWord": {
		displayName: "Remove word in search",
		count: 1,
		default: ["Ctrl Backspace"]
	},
	"clearSearch": {
		displayName: "Clear search",
		count: 1,
		default: ["Escape"]
	},
});
export const keybindDescription: Record<keyof typeof keybindDescriptionExact, KeybindDescription> = keybindDescriptionExact;

export type KeybindName = keyof typeof keybindDescription;
export type Keybindings = Record<KeybindName, string[]>;

export function generateDefaultKeybindings() {
	let keybindings = {} as Keybindings;

	for (let key in keybindDescription) {
		let typedKey = key as KeybindName;
		keybindings[typedKey] = keybindDescription[typedKey].default.slice();
	}

	return keybindings;
}

export let keyLayoutMap = Promise.resolve(new Map() as Map<string, string>);
if ('keyboard' in navigator) {
	keyLayoutMap = (navigator as any).keyboard.getLayoutMap();
}