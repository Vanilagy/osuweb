/** Can be any key code (the string, not the number), or MB(n) for the nth mouse button, or WheelUp/WheelDown. Additionally, modifiers Shift, Ctrl, Meta and Alt can be added infront (in that order alone!) to narrow the description. */
type KeyDescription = string;

interface KeybindDescription {
	displayName: string,
	count: number,
	default: KeyDescription[]
}

const buildKeybinds = <T extends Record<string, KeybindDescription>>(keybinds: T) => keybinds;
const keybindDescriptionExact = buildKeybinds({
	"gameButtonA": {
		displayName: "Left button",
		count: 2,
		default: ["KeyZ", "MB0"]
	},
	"gameButtonB": {
		displayName: "Left button",
		count: 2,
		default: ["KeyX", "MB2"]
	},
	"smoke": {
		displayName: "Smoke",
		count: 1,
		default: ["KeyC"]
	},
	"restartPlay": {
		displayName: "Restart",
		count: 1,
		default: ["Ctrl KeyR"]
	}
});
const keybindDescription: Record<keyof typeof keybindDescriptionExact, KeybindDescription> = keybindDescriptionExact;

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