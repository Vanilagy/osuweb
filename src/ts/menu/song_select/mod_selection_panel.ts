import { InteractionGroup, InteractionRegistration } from "../../input/interactivity";
import { calculateRatioBasedScalingFactor, colorToHexNumber } from "../../util/graphics_util";
import { currentWindowDimensions, REFERENCE_SCREEN_HEIGHT } from "../../visuals/ui";
import { createPolygonTexture } from "../../util/pixi_util";
import { Mod, modIncompatibilities } from "../../datamodel/mods";
import { ModIcon } from "../components/mod_icon";
import { Button, ButtonPivot, DEFAULT_BUTTON_WIDTH, DEFAULT_BUTTON_HEIGHT, DEFAULT_BUTTON_MARGIN } from "../components/button";
import { THEME_COLORS } from "../../util/constants";
import { SongSelect } from "./song_select";
import { Interpolator, InterpolatedValueChanger } from "../../util/interpolation";
import { EaseType } from "../../util/math_util";
import { ModHelper } from "../../game/mods/mod_helper";
import { KeyCode } from "../../input/input";

const PANEL_WIDTH = 620;
const PANEL_HEIGHT = 396;
const LEFT_MARGIN = 110;
const TOP_MARGIN = 22;

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

export class ModSelectionPanel {
	public songSelect: SongSelect;
	public container: PIXI.Container;
	public interactionGroup: InteractionGroup;
	private scalingFactor: number = 1.0;

	private background: PIXI.Sprite;
	private centerContainer: PIXI.Container;
	private mask: PIXI.Sprite;
	private centerContainerBackground: PIXI.Sprite;

	private header: PIXI.Text;
	private scoreMultiplierNumber: PIXI.Text;
	private scoreMultiplierText: PIXI.Text;

	private sectionHeaders: PIXI.Text[] = [];
	private modIcons: ModIcon[][] = [];

	private buttons: Button[];

	private fadeInInterpolator: Interpolator;
	private scoreMultiplierInterpolator: InterpolatedValueChanger;

	constructor(songSelect: SongSelect) {
		this.songSelect = songSelect;
		this.container = new PIXI.Container();
		this.interactionGroup = new InteractionGroup();
		this.interactionGroup.setZIndex(10);

		this.background = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.background.tint = 0x000000;
		this.background.alpha = 0.8;
		this.container.addChild(this.background);
		let backgroundRegistration = new InteractionRegistration(this.background);
		backgroundRegistration.enableEmptyListeners();
		this.interactionGroup.add(backgroundRegistration);

		this.centerContainer = new PIXI.Container();
		this.container.addChild(this.centerContainer);

		this.mask = new PIXI.Sprite();
		this.centerContainer.addChild(this.mask);

		this.centerContainerBackground = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.centerContainerBackground.tint = 0x000000;
		this.centerContainerBackground.alpha = 0.8;
		this.centerContainerBackground.mask = this.mask;
		this.centerContainer.addChild(this.centerContainerBackground);

		this.header = new PIXI.Text("mods");
		this.header.style = {
			fontFamily: 'Exo2-BoldItalic',
			fill: 0xffffff
		};
		this.centerContainer.addChild(this.header);

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

		let doneButton = new Button(DEFAULT_BUTTON_WIDTH, DEFAULT_BUTTON_HEIGHT, 15, ButtonPivot.TopRight, 'done', colorToHexNumber(THEME_COLORS.PrimaryBlue));
		let resetButton = new Button(DEFAULT_BUTTON_WIDTH, DEFAULT_BUTTON_HEIGHT, 15, ButtonPivot.TopRight, 'reset', colorToHexNumber(THEME_COLORS.SecondaryActionGray));
		this.buttons = [doneButton, resetButton];
		for (let b of this.buttons) this.centerContainer.addChild(b.container);

		doneButton.setupInteraction(this.interactionGroup, () => this.hide());
		resetButton.setupInteraction(this.interactionGroup, () => this.deselectAll());

		this.fadeInInterpolator = new Interpolator({
			defaultToFinished: true,
			beginReversed: true,
			duration: 400,
			ease: EaseType.EaseOutCubic,
			reverseEase: EaseType.EaseInCubic
		});
		this.scoreMultiplierInterpolator = new InterpolatedValueChanger({
			initial: 1.0,
			duration: 200,
			ease: EaseType.EaseOutCubic
		});

		// ESC -> close
		backgroundRegistration.addListener('keyDown', (e) => {
			if (e.keyCode === KeyCode.Escape || e.keyCode === KeyCode.Enter) this.hide();
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
		this.scalingFactor = calculateRatioBasedScalingFactor(currentWindowDimensions.width, currentWindowDimensions.height, 16/9, REFERENCE_SCREEN_HEIGHT);
		let slantWidth = PANEL_HEIGHT/5;

		this.background.width = currentWindowDimensions.width;
		this.background.height = currentWindowDimensions.height;

		this.mask.texture = createPolygonTexture(PANEL_WIDTH + slantWidth, PANEL_HEIGHT, [
			new PIXI.Point(0, 0), new PIXI.Point(PANEL_WIDTH, 0), new PIXI.Point(PANEL_WIDTH + slantWidth, PANEL_HEIGHT), new PIXI.Point(slantWidth, PANEL_HEIGHT)
		], this.scalingFactor);
		this.centerContainerBackground.width = Math.ceil((PANEL_WIDTH + slantWidth) * this.scalingFactor);
		this.centerContainerBackground.height = Math.ceil(PANEL_HEIGHT * this.scalingFactor);

		this.centerContainer.y = Math.floor(currentWindowDimensions.height / 2);
		this.centerContainer.pivot.x = Math.floor((PANEL_WIDTH + slantWidth) * this.scalingFactor / 2);
		this.centerContainer.pivot.y = Math.floor((PANEL_HEIGHT + DEFAULT_BUTTON_MARGIN + DEFAULT_BUTTON_HEIGHT) * this.scalingFactor / 2);

		this.header.style.fontSize = Math.floor(22 * this.scalingFactor);
		this.header.y = Math.floor(TOP_MARGIN * this.scalingFactor);

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

				icon.resize(42 * this.scalingFactor);
				icon.container.y = sectionHeader.y + Math.floor(27 * this.scalingFactor);
			}
		}

		for (let i = 0; i < this.buttons.length; i++) {
			let button = this.buttons[i];
			button.resize(this.scalingFactor);

			button.container.y = Math.floor((PANEL_HEIGHT + DEFAULT_BUTTON_MARGIN) * this.scalingFactor);
			button.container.x = Math.floor((PANEL_WIDTH + slantWidth + DEFAULT_BUTTON_MARGIN/5 - i*(DEFAULT_BUTTON_WIDTH + DEFAULT_BUTTON_HEIGHT/10 + DEFAULT_BUTTON_MARGIN)) * this.scalingFactor);
		}
	}

	private updateScoreMultiplierPositioning() {
		this.scoreMultiplierNumber.y = Math.floor(this.header.y * 1.2);
		this.scoreMultiplierNumber.x = Math.floor((PANEL_WIDTH - 38) * this.scalingFactor);
		this.scoreMultiplierText.y = this.scoreMultiplierNumber.y;
		this.scoreMultiplierText.x = Math.floor(this.scoreMultiplierNumber.x - this.scoreMultiplierNumber.width);
	}

	update(now: number) {
		let fadeInCompletion = this.fadeInInterpolator.getCurrentValue(now);
		if (fadeInCompletion === 0) {
			this.container.visible = false;
			return;
		}
		this.container.visible = true;

		this.container.alpha = fadeInCompletion;
		this.centerContainer.x = Math.floor(currentWindowDimensions.width / 2) - 40 * (1 - fadeInCompletion) * this.scalingFactor;

		this.header.x = Math.floor(LEFT_MARGIN * this.scalingFactor) + (-50) * (1 - fadeInCompletion) * this.scalingFactor;

		for (let a of this.modIcons) {
			for (let m of a) {
				m.update(now);
			}
		}

		for (let b of this.buttons) b.update(now);

		for (let i = 0; i < this.sectionHeaders.length; i++) {
			let sectionHeader = this.sectionHeaders[i];
			let nudge = (1 - fadeInCompletion) * (-15) * (3-i) * this.scalingFactor;
			sectionHeader.x = Math.floor(LEFT_MARGIN * this.scalingFactor) + nudge;

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
		this.songSelect.searchBar.interactionGroup.enable();
		this.songSelect.keyInteraction.enable();
	}

	show() {
		this.interactionGroup.enable();
		this.fadeInInterpolator.setReversedState(false, performance.now());
		this.songSelect.searchBar.interactionGroup.disable();
		this.songSelect.keyInteraction.disable();
	}
}