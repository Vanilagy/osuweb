import { SettingsPanel } from "./settings_panel";
import { VerticalLayoutElement } from "../components/vertical_layout_element";

export abstract class SettingsElement extends VerticalLayoutElement<SettingsPanel>  {
	private alphaFilter: PIXI.filters.AlphaFilter;

	constructor(parent: SettingsPanel) {
		super(parent);

		this.alphaFilter = new PIXI.filters.AlphaFilter(0.333);
		this.container.filters = [this.alphaFilter];

		this.enable();
	}

	abstract resize(): void;
	abstract update(now: number): void;

	getTopMargin(now: number) {
		return 0;
	}

	getBottomMargin(now: number) {
		return 15 * this.parent.scalingFactor;
	}

	enable() {
		if (!this.alphaFilter) return; // A bit hacky lol

		this.alphaFilter.enabled = false;
		this.interactionGroup.enable();
	}

	disable() {
		this.alphaFilter.enabled = true;
		this.interactionGroup.disable();
	}

	refresh() {}
}