import { SettingsElement } from "./settings_element";
import { SettingsPanel, SETTINGS_PANEL_WIDTH, SETTINGS_PANEL_PADDING } from "./settings_panel";
import { colorToHexNumber } from "../../util/graphics_util";
import { THEME_COLORS } from "../../util/constants";

export class TextElement extends SettingsElement {
	private text: PIXI.Text;
	private enabled: boolean;

	constructor(parent: SettingsPanel, text: string, identifier: string) {
		super(parent);

		this.container.filters = [];
		this.identifier = identifier;

		this.text = new PIXI.Text(text, {
			fontFamily: 'Exo2-Light',
			fill: colorToHexNumber(THEME_COLORS.AccentGold),
			wordWrap: true
		});
		this.container.addChild(this.text);
	}

	resize() {
		this.text.style.wordWrapWidth = Math.floor((SETTINGS_PANEL_WIDTH - SETTINGS_PANEL_PADDING*2) * this.parent.scalingFactor)
		this.text.style.fontSize = Math.floor(10 * this.parent.scalingFactor);
	}

	update() {}

	getHeight() {
		return this.enabled? this.container.height : 0;
	}

	getBottomMargin() {
		return this.enabled? 10 * this.parent.scalingFactor : 0;
	}

	enable() {
		this.container.visible = true;
		this.enabled = true;
	}
	
	disable() {
		this.container.visible = false;
		this.enabled = false;
	}
}