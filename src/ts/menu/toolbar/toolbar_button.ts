import { ToolbarEntry } from "./toolbar_entry";
import { Toolbar } from "./toolbar";
import { MathUtil } from "../../util/math_util";

export class ToolbarButton extends ToolbarEntry {
	private texture: PIXI.Texture;
	private icon: PIXI.Sprite;

	constructor(parent: Toolbar, iconTexture: PIXI.Texture) {
		super(parent);

		this.texture = iconTexture;

		this.icon = new PIXI.Sprite(this.texture);
		this.icon.anchor.set(0.5, 0.5);
		this.entryContainer.addChild(this.icon);
	}

	resize() {
		super.resize();

		this.icon.width = MathUtil.floorToMultiple(20 * this.parent.scalingFactor, 2);
		this.icon.height = this.icon.width;

		this.icon.x = Math.floor(this.background.width/2);
		this.icon.y = Math.floor(this.background.height/2);
	}
}