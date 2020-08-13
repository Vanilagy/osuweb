import { InteractionGroup } from "../../input/interactivity";

/** Represents a general element that can be tiled vertically. */
export abstract class VerticalLayoutElement <T> {
	public container: PIXI.Container;
	public interactionGroup: InteractionGroup;
	public identifier: string = null;
	protected parent: T;

	constructor(parent: T) {
		this.parent = parent;
		this.container = new PIXI.Container();
		this.interactionGroup = new InteractionGroup();

		this.enable();
	}

	abstract resize(): void;
	abstract update(now: number): void;

	abstract getTopMargin(now: number): number;
	abstract getHeight(now: number): number;
	abstract getBottomMargin(now: number): number;

	enable() {
		this.interactionGroup.enable();
	}

	disable() {
		this.interactionGroup.disable();
	}
}