import { Color, hexNumberToColor } from "../util/graphics_util";

export enum Mod {
	// Difficulty reduction:
	Easy = "EZ",
	NoFail = "NF",
	HalfTime = "HT",
	Daycore = "DC",

	// Difficulty increase:
	HardRock = "HR",
	SuddenDeath = "SD",
	Perfect = "PF",
	DoubleTime = "DT",
	Nightcore = "NC",
	Hidden = "HD",
	Flashlight = "FL",

	// Special:
	Relax = "RX",
	Autopilot = "AP",
	SpunOut = "SO",
	Auto = "AT",
	Cinema = "CN"
}

export const modMultipliers = new Map<Mod, number>();
modMultipliers.set(Mod.Easy, 0.5);
modMultipliers.set(Mod.NoFail, 0.5);
modMultipliers.set(Mod.HalfTime, 0.3);
modMultipliers.set(Mod.Daycore, 0.3);
modMultipliers.set(Mod.HardRock, 1.06);
modMultipliers.set(Mod.SuddenDeath, 1.0);
modMultipliers.set(Mod.Perfect, 1.0);
modMultipliers.set(Mod.DoubleTime, 1.12);
modMultipliers.set(Mod.Nightcore, 1.12);
modMultipliers.set(Mod.Hidden, 1.06);
modMultipliers.set(Mod.Flashlight, 1.12);
modMultipliers.set(Mod.Relax, 0.0);
modMultipliers.set(Mod.Autopilot, 0.0);
modMultipliers.set(Mod.SpunOut, 0.9);
modMultipliers.set(Mod.Auto, 1.0);
modMultipliers.set(Mod.Cinema, 1.0);

const difficultyReductionColor = hexNumberToColor(0x5BC159);
const difficultyIncreaseColor = hexNumberToColor(0xe3c866);
const specialColor = hexNumberToColor(0x4d93d6);

export const modColors = new Map<Mod, Color>();
modColors.set(Mod.Easy, difficultyReductionColor);
modColors.set(Mod.NoFail, difficultyReductionColor);
modColors.set(Mod.HalfTime, difficultyReductionColor);
modColors.set(Mod.Daycore, difficultyReductionColor);
modColors.set(Mod.HardRock, difficultyIncreaseColor);
modColors.set(Mod.SuddenDeath, difficultyIncreaseColor);
modColors.set(Mod.Perfect, difficultyIncreaseColor);
modColors.set(Mod.DoubleTime, difficultyIncreaseColor);
modColors.set(Mod.Nightcore, difficultyIncreaseColor);
modColors.set(Mod.Hidden, difficultyIncreaseColor);
modColors.set(Mod.Flashlight, difficultyIncreaseColor);
modColors.set(Mod.Relax, specialColor);
modColors.set(Mod.Autopilot, specialColor);
modColors.set(Mod.SpunOut, specialColor);
modColors.set(Mod.Auto, specialColor);
modColors.set(Mod.Cinema, specialColor);

export const modOrder = new Map<Mod, number>();
modOrder.set(Mod.Easy, 0);
modOrder.set(Mod.NoFail, 1);
modOrder.set(Mod.HalfTime, 2);
modOrder.set(Mod.Daycore, 2);
modOrder.set(Mod.HardRock, 3);
modOrder.set(Mod.SuddenDeath, 4);
modOrder.set(Mod.Perfect, 4);
modOrder.set(Mod.DoubleTime, 5);
modOrder.set(Mod.Nightcore, 5);
modOrder.set(Mod.Hidden, 6);
modOrder.set(Mod.Flashlight, 7);
modOrder.set(Mod.Relax, -1);
modOrder.set(Mod.Autopilot, -2);
modOrder.set(Mod.SpunOut, -0.5);
modOrder.set(Mod.Auto, -10);
modOrder.set(Mod.Cinema, -10);

export function modComparator(a: Mod, b: Mod) {
	return modOrder.get(a) - modOrder.get(b);
}

export const modLongNames = new Map<Mod, string>();
modLongNames.set(Mod.Easy, 'Easy');
modLongNames.set(Mod.NoFail, 'No-Fail');
modLongNames.set(Mod.HalfTime, 'Half Time');
modLongNames.set(Mod.Daycore, 'Daycore');
modLongNames.set(Mod.HardRock, 'Hard Rock');
modLongNames.set(Mod.SuddenDeath, 'Sudden Death');
modLongNames.set(Mod.Perfect, 'Perfect');
modLongNames.set(Mod.DoubleTime, 'Double Time');
modLongNames.set(Mod.Nightcore, 'Nightcore');
modLongNames.set(Mod.Hidden, 'Hidden');
modLongNames.set(Mod.Flashlight, 'Flashlight');
modLongNames.set(Mod.Relax, 'Relax');
modLongNames.set(Mod.Autopilot, 'Autopilot');
modLongNames.set(Mod.SpunOut, 'Spun-Out');
modLongNames.set(Mod.Auto, 'Auto');
modLongNames.set(Mod.Cinema, 'Cinema');

// For each array, only one mod may be active at a time
export const modIncompatibilities = [
	[Mod.Easy, Mod.HardRock],
	[Mod.HalfTime, Mod.Daycore, Mod.DoubleTime, Mod.Nightcore],
	[Mod.Relax, Mod.Autopilot, Mod.Auto, Mod.Cinema],
	[Mod.Autopilot, Mod.SpunOut, Mod.Auto, Mod.Cinema]
];

export const RELAX_HIT_RELATIVE_TIME = -10; // When, relative to the perfect hit time of a circle, relax should hit the circle.