import { InteractionGroup } from "../../input/interactivity";
import { SettingsPanel } from "./settings_panel";

export abstract class SettingsElement {
	public container: PIXI.Container;
	public interactionGroup: InteractionGroup;
	protected parent: SettingsPanel;

	constructor(parent: SettingsPanel) {
		this.parent = parent;
		this.container = new PIXI.Container();
		this.interactionGroup = new InteractionGroup();
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
}