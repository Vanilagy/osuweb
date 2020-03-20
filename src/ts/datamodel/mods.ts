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

export const modColors = new Map<Mod, Color>();
modColors.set(Mod.Easy, hexNumberToColor(0x5BC159));
modColors.set(Mod.NoFail, hexNumberToColor(0x32308B));
modColors.set(Mod.HalfTime, hexNumberToColor(0x3E3E3E));
modColors.set(Mod.Daycore, hexNumberToColor(0x3E3E3E));
modColors.set(Mod.HardRock, hexNumberToColor(0xAE3636));
modColors.set(Mod.SuddenDeath, hexNumberToColor(0xB06941));
modColors.set(Mod.Perfect, hexNumberToColor(0xB06941));
modColors.set(Mod.DoubleTime, hexNumberToColor(0x894DC6));
modColors.set(Mod.Nightcore, hexNumberToColor(0x894DC6));
modColors.set(Mod.Hidden, hexNumberToColor(0xCFB34D));
modColors.set(Mod.Flashlight, hexNumberToColor(0x1F1F1F));
modColors.set(Mod.Relax, hexNumberToColor(0x3674AE));
modColors.set(Mod.Autopilot, hexNumberToColor(0x235B8E));
modColors.set(Mod.SpunOut, hexNumberToColor(0x892A41));
modColors.set(Mod.Auto, hexNumberToColor(0x2258A9));
modColors.set(Mod.Cinema, hexNumberToColor(0x2258A9));

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