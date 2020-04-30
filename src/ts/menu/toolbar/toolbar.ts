import { currentWindowDimensions, REFERENCE_SCREEN_HEIGHT } from "../../visuals/ui";
import { ToolbarEntry } from "./toolbar_entry";
import { InteractionGroup } from "../../input/interactivity";
import { ToolbarButton } from "./toolbar_button";
import { svgToTexture } from "../../util/pixi_util";
import { FolderSelector } from "../import/folder_selector";

export const TOOLBAR_HEIGHT = 40;

export class Toolbar {
	public container: PIXI.Container;
	public scalingFactor: number;
	public interactionGroup: InteractionGroup;
	private background: PIXI.Sprite;

	private entries: ToolbarEntry[] = [];

	private folderSelector: FolderSelector;
	
	constructor() {
		this.container = new PIXI.Container();
		this.interactionGroup = new InteractionGroup();

		this.background = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.background.tint = 0x151515;
		this.background.alpha = 0.8;
		this.container.addChild(this.background);

		let plusTexture = svgToTexture(document.querySelector('#svg-plus'), true);
		let button = new ToolbarButton(this, plusTexture);
		this.container.addChild(button.container);

		this.entries.push(button);

		this.folderSelector = new FolderSelector();
		this.folderSelector.container.position.set(200, 200);
		this.container.addChild(this.folderSelector.container);

		this.resize();
	}

	resize() {
		this.scalingFactor = currentWindowDimensions.height / REFERENCE_SCREEN_HEIGHT;

		this.background.width = currentWindowDimensions.width;
		this.background.height = Math.floor(TOOLBAR_HEIGHT * this.scalingFactor);

		for (let e of this.entries) e.resize();
	}

	update(now: number) {
		for (let e of this.entries) e.update(now);
	}
}