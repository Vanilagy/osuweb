import { currentWindowDimensions, REFERENCE_SCREEN_HEIGHT } from "../../visuals/ui";
import { ToolbarEntry } from "./toolbar_entry";
import { InteractionGroup } from "../../input/interactivity";
import { ImportBeatmapsButton } from "../import/import_beatmaps_button";

export const TOOLBAR_HEIGHT = 40;

export class Toolbar {
	public container: PIXI.Container;
	public scalingFactor: number;
	public interactionGroup: InteractionGroup;
	public currentHeight: number = 0;

	private background: PIXI.Sprite;
	private entries: ToolbarEntry[] = [];
	
	constructor() {
		this.container = new PIXI.Container();
		this.interactionGroup = new InteractionGroup();

		this.background = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.background.tint = 0x131313;
		this.background.alpha = 0.90;
		this.container.addChild(this.background);

		let button = new ImportBeatmapsButton(this);
		this.container.addChild(button.container);

		this.entries.push(button);

		this.resize();
	}

	resize() {
		this.scalingFactor = currentWindowDimensions.height / REFERENCE_SCREEN_HEIGHT;

		this.currentHeight = Math.floor(TOOLBAR_HEIGHT * this.scalingFactor);

		this.background.width = currentWindowDimensions.width;
		this.background.height = this.currentHeight;

		for (let e of this.entries) e.resize();
	}

	update(now: number) {
		for (let e of this.entries) e.update(now);
	}
}