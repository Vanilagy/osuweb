import { SettingsElement } from "./settings_element";
import { SettingsPanel, SETTINGS_PANEL_WIDTH, SETTINGS_PANEL_PADDING } from "./settings_panel";
import { colorToHexNumber } from "../../util/graphics_util";

export class HorizontalLine extends SettingsElement {
	private background: PIXI.Sprite;

	constructor(parent: SettingsPanel) {
		super(parent);

		this.background = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.background.tint = colorToHexNumber({r: 50, g: 50, b: 50});
		this.container.addChild(this.background);
	}

	resize() {
		this.background.width = Math.floor((SETTINGS_PANEL_WIDTH - SETTINGS_PANEL_PADDING*2) * this.parent.scalingFactor);
		this.background.height = 1;
	}

	update() {}

	getHeight() {
		return this.background.height;
	}

	getTopMargin() {
		return 4 * this.parent.scalingFactor;
	}

	getBottomMargin() {
		return 10 * this.parent.scalingFactor;
	}
}