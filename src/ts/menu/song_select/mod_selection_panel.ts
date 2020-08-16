import { Mod, modIncompatibilities } from "../../datamodel/mods";
import { ModIcon } from "../components/mod_icon";
import { THEME_COLORS } from "../../util/constants";
import { SongSelect } from "./song_select";
import {  InterpolatedValueChanger } from "../../util/interpolation";
import { EaseType } from "../../util/math_util";
import { ModHelper } from "../../game/mods/mod_helper";
import { KeyCode } from "../../input/input";
import { PopupFrame } from "../components/popup_frame";

const PANEL_WIDTH = 620;
const PANEL_HEIGHT = 396;

const structure = [
	{
		header: 'difficulty reduction',
		mods: [
			[Mod.Easy],
			[Mod.NoFail],
			[Mod.HalfTime, Mod.Daycore]
		]
	},
	{
		header: 'difficulty increase',
		mods: [
			[Mod.HardRock],
			[Mod.SuddenDeath, Mod.Perfect],
			[Mod.DoubleTime, Mod.Nightcore],
			[Mod.Hidden],
			[Mod.Flashlight]
		]
	},
	{
		header: 'special',
		mods: [
			[Mod.Relax],
			[Mod.Autopilot],
			[Mod.SpunOut],
			[Mod.Auto, Mod.Cinema]
		]
	}
];

export class ModSelectionPanel extends PopupFrame {
	public songSelect: SongSelect;

	private scoreMultiplierNumber: PIXI.Text;
	private scoreMultiplierText: PIXI.Text;

	private sectionHeaders: PIXI.Text[] = [];
	private modIcons: ModIcon[][] = [];

	private scoreMultiplierInterpolator: InterpolatedValueChanger;

	constructor(songSelect: SongSelect) {
		super({
			width: PANEL_WIDTH,
			height: PANEL_HEIGHT,
			headerText: "mods",
			descriptionText: "",
			enableCloseButton: false,
			buttons: [{
				label: 'done',
				color: THEME_COLORS.PrimaryBlue,
				onclick: () => this.hide()
			},
			{
				label: 'reset',
				color: THEME_COLORS.SecondaryActionGray,
				onclick: () => this.deselectAll()
			}]
		});

		this.songSelect = songSelect;

		this.scoreMultiplierNumber = new PIXI.Text("1.00x");
		this.scoreMultiplierNumber.style = {
			fontFamily: 'Exo2-Regular',
			fill: 0xffffff
		};
		this.scoreMultiplierNumber.anchor.set(1.0, 0.0);
		this.scoreMultiplierText = new PIXI.Text("score multiplier: ");
		this.scoreMultiplierText.anchor.set(1.0, 0.0);
		this.centerContainer.addChild(this.scoreMultiplierNumber, this.scoreMultiplierText);

		// Build up the mod selection from the structure object above
		for (let section of structure) {
			let header = new PIXI.Text(section.header);
			header.style = {
				fontFamily: 'Exo2-LightItalic',
				fill: 0xffffff
			};
			this.centerContainer.addChild(header);

			this.sectionHeaders.push(header);

			let icons: ModIcon[] = [];
			for (let mod of section.mods) {
				let icon = new ModIcon();
				icon.enableLabel();
				icon.enableInteraction(this.interactionGroup, mod);
				this.centerContainer.addChild(icon.container);

				icons.push(icon);

				icon.addListener('clicked', () => {
					this.doModCancellation(icon);
					this.onModsChange();
				});
			}
			this.modIcons.push(icons);
		}

		this.scoreMultiplierInterpolator = new InterpolatedValueChanger({
			initial: 1.0,
			duration: 200,
			ease: EaseType.EaseOutCubic
		});

		// ENTER -> close
		this.backgroundRegistration.addListener('keyDown', (e) => {
			if (e.keyCode === KeyCode.Enter) this.hide();
		});
		this.backgroundRegistration.addKeybindListener('toggleModSelect', 'down', () => {
			this.hide();
		});

		this.hide();
	}

	// Deselect other mods so that combos like DTHT become impossible
	private doModCancellation(reference: ModIcon) {
		let referenceMod = reference.getCurrentlySelectedMod();

		for (let icon of this.modIcons.flat()) {
			if (icon === reference) continue;
			let selectedMod = icon.getCurrentlySelectedMod();

			for (let group of modIncompatibilities) {
				if (group.includes(referenceMod) && group.includes(selectedMod)) {
					icon.deselect();
					break;
				}
			}
		}
	}

	private onModsChange() {
		let mods = this.getSelectedMods();
		let multiplier = ModHelper.calculateModMultiplier(mods);

		// Update score multiplier
		this.scoreMultiplierInterpolator.setGoal(multiplier, performance.now());

		// Highlight the mod selection button accordingly to show that mods are selected/not selected
		let modSelectionButton = this.songSelect.sideControlPanel.modSelectionButton;
		if (mods.size === 0) modSelectionButton.unhighlight();
		else modSelectionButton.highlight();
	}

	getSelectedMods() {
		let set = new Set<Mod>();

		for (let icon of this.modIcons.flat()) {
			let selected = icon.getCurrentlySelectedMod();
			if (selected !== null) set.add(selected);
		}

		return set;
	}

	deselectAll() {
		for (let icon of this.modIcons.flat()) {
			icon.deselect();
		}

		this.onModsChange();
	}

	resize() {
		super.resize();

		this.scoreMultiplierNumber.style.fontSize = Math.floor(13 * this.scalingFactor);
		this.scoreMultiplierText.style = this.scoreMultiplierNumber.style;
		this.updateScoreMultiplierPositioning();

		for (let i = 0; i < this.sectionHeaders.length; i++) {
			let sectionHeader = this.sectionHeaders[i];

			sectionHeader.style.fontSize = Math.floor(14.5 * this.scalingFactor);
			sectionHeader.y = Math.floor((77 + i*102) * this.scalingFactor);

			let icons = this.modIcons[i];
			for (let j = 0; j < icons.length; j++) {
				let icon = icons[j];

				icon.resize(42 * this.scalingFactor, 2);
				icon.container.y = sectionHeader.y + Math.floor(27 * this.scalingFactor);
			}
		}
	}

	private updateScoreMultiplierPositioning() {
		this.scoreMultiplierNumber.y = Math.floor(this.header.y * 1.2);
		this.scoreMultiplierNumber.x = Math.floor((PANEL_WIDTH - 38) * this.scalingFactor);
		this.scoreMultiplierText.y = this.scoreMultiplierNumber.y;
		this.scoreMultiplierText.x = Math.floor(this.scoreMultiplierNumber.x - this.scoreMultiplierNumber.width);
	}

	update(now: number) {
		if (!super.update(now)) return false;

		let fadeInCompletion = this.fadeInInterpolator.getCurrentValue(now);
		let leftMargin = this.getLeftMargin();

		for (let a of this.modIcons) {
			for (let m of a) {
				m.update(now);
			}
		}

		for (let i = 0; i < this.sectionHeaders.length; i++) {
			let sectionHeader = this.sectionHeaders[i];
			let nudge = (1 - fadeInCompletion) * (-15) * (3-i) * this.scalingFactor;
			sectionHeader.x = Math.floor(leftMargin + nudge);

			let icons = this.modIcons[i];
			for (let j = 0; j < icons.length; j++) {
				let icon = icons[j];
				icon.container.x = sectionHeader.x + Math.floor(j * 81 * this.scalingFactor);
			}
		}

		let currentScoreMultiplier = this.scoreMultiplierInterpolator.getCurrentValue(now);
		let scoreMultiplierString = currentScoreMultiplier.toFixed(2) + 'x';
		if (this.scoreMultiplierNumber.text !== scoreMultiplierString) {
			this.scoreMultiplierNumber.text = scoreMultiplierString;
			this.updateScoreMultiplierPositioning();
		}

		if (currentScoreMultiplier > 1) {
			this.scoreMultiplierNumber.tint = 0x5FCA56; // green
		} else if (currentScoreMultiplier < 1) {
			this.scoreMultiplierNumber.tint = 0xCA5D56; // red
		} else {
			this.scoreMultiplierNumber.tint = 0xffffff; // white
		}
	}

	hide() {
		this.interactionGroup.disable();
		this.fadeInInterpolator.setReversedState(true, performance.now());
	}

	show() {
		this.interactionGroup.enable();
		this.fadeInInterpolator.setReversedState(false, performance.now());
	}

	triggerClose() {
		this.hide();
	}
}