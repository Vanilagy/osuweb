import { Mod } from "../../game/mods/mods";
import { createPolygonTexture } from "../../util/pixi_util";

const MOD_ICON_REFERENCE_HEIGHT = 100;

export class ModIcon {
	public container: PIXI.Container;

	private background: PIXI.Sprite;
	private text: PIXI.Text;

	constructor(mod: Mod) {
		this.container = new PIXI.Container();

		this.background = new PIXI.Sprite();
		this.background.tint = 0xff0000;
		this.container.addChild(this.background);

		this.text = new PIXI.Text(mod);
		this.container.addChild(this.text);
	}

	resize(height: number) {
		let scalingFactor = height / MOD_ICON_REFERENCE_HEIGHT;
		let slantWidth = height/5;

		this.background.texture = createPolygonTexture(MOD_ICON_REFERENCE_HEIGHT + slantWidth, MOD_ICON_REFERENCE_HEIGHT, [
			new PIXI.Point(0, 0), new PIXI.Point(MOD_ICON_REFERENCE_HEIGHT, 0), new PIXI.Point(MOD_ICON_REFERENCE_HEIGHT + slantWidth, MOD_ICON_REFERENCE_HEIGHT), new PIXI.Point(slantWidth, MOD_ICON_REFERENCE_HEIGHT)
		], scalingFactor, 0, false, 20);

		this.text.style = {
			fontFamily: 'FredokaOne-Regular',
			fill: 0xffffff,
			fontSize: Math.floor(50 * scalingFactor),
		};
		this.text.pivot.x = Math.floor(this.text.width/2 * 1.03);
		this.text.pivot.y = Math.floor(this.text.height/2);
		this.text.x = Math.floor((MOD_ICON_REFERENCE_HEIGHT + slantWidth) / 2 * scalingFactor);
		this.text.y = Math.floor(MOD_ICON_REFERENCE_HEIGHT / 2 * scalingFactor);
	}
}