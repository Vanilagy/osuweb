import { InteractionGroup } from "../../input/interactivity";
import { SettingsPanel } from "./settings_panel";

export abstract class SettingsElement {
	public container: PIXI.Container;
	public interactionGroup: InteractionGroup;
	public identifier: string = null;
	protected parent: SettingsPanel;
	private alphaFilter: PIXI.filters.AlphaFilter;

	constructor(parent: SettingsPanel) {
		this.parent = parent;
		this.container = new PIXI.Container();
		this.interactionGroup = new InteractionGroup();

		this.alphaFilter = new PIXI.filters.AlphaFilter(0.333);
		this.container.filters = [this.alphaFilter];

		this.enable();
	}

	abstract resize(): void;
	abstract update(now: number): void;

	getTopMargin(now: number) {
		return 0;
	}

	abstract getHeight(now: number): number;

	getBottomMargin(now: number) {
		return 15 * this.parent.scalingFactor;
	}

	enable() {
		this.alphaFilter.enabled = false;
		this.interactionGroup.enable();
	}

	disable() {
		this.alphaFilter.enabled = true;
		this.interactionGroup.disable();
	}
}