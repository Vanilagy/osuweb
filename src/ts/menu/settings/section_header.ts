import { SettingsElement } from "./settings_element";
import { SettingsPanel } from "./settings_panel";

export class SectionHeader extends SettingsElement {
	private text: PIXI.Text;

	constructor(parent: SettingsPanel, title: string) {
		super(parent);

		this.text = new PIXI.Text(title.toUpperCase(), {
			fontFamily: 'Exo2-Bold',
			fill: 0xffffff
		});
		this.container.addChild(this.text);
	}

	resize() {
		this.text.style.fontSize = Math.floor(16 * this.parent.scalingFactor);
	}

	update() {}

	getTopMargin() {
		return 20 * this.parent.scalingFactor;
	}

	getHeight() {
		return this.container.height;
	}

	getBottomMargin() {
		return 25 * this.parent.scalingFactor;
	}
}