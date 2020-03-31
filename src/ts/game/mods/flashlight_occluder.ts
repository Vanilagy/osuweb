import { currentWindowDimensions } from "../../visuals/ui";
import { Point } from "../../util/point";
import { MathUtil, EaseType } from "../../util/math_util";

export class FlashlightOccluder {
	public container: PIXI.Container;
	private canvas: HTMLCanvasElement;
	private ctx: CanvasRenderingContext2D;
	private mainSprite: PIXI.Sprite;
	private darkeningSprite: PIXI.Sprite;

	constructor() {
		this.container = new PIXI.Container();

		this.canvas = document.createElement('canvas');
		this.ctx = this.canvas.getContext('2d');

		this.mainSprite = new PIXI.Sprite(PIXI.Texture.from(this.canvas));
		this.darkeningSprite = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.darkeningSprite.tint = 0x000000;
		this.darkeningSprite.visible = false;
		this.darkeningSprite.alpha = 0.8;

		this.container.addChild(this.mainSprite, this.darkeningSprite);

		this.hide();
	}
	
	show() {
		this.container.visible = true;
	}

	hide() {
		this.container.visible = false;
	}

	resize() {
		this.canvas.setAttribute('width', currentWindowDimensions.width.toString());
		this.canvas.setAttribute('height', currentWindowDimensions.height.toString());

		this.darkeningSprite.width = currentWindowDimensions.width;
		this.darkeningSprite.height = currentWindowDimensions.height;
	}

	update(pos: Point, scalingFactor: number, breakiness: number, enableDarkening: boolean) {
		if (!this.container.visible) return;

		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

		let outerRadius = MathUtil.lerp(275, 550, MathUtil.ease(EaseType.EaseInOutQuad, breakiness)) * scalingFactor;
		let innerRadius = outerRadius * 0.666;
		
		let gradient = this.ctx.createRadialGradient(pos.x, pos.y, innerRadius, pos.x, pos.y, outerRadius);
		// Draw an eased gradient progress (natively setting only color stops will result in a harsh cut-off due to its linearity)
		for (let i = 0; i <= 25; i++) {
			let completion = i / 25;
			let alpha = MathUtil.ease(EaseType.EaseInOutQuad, completion);

			gradient.addColorStop(completion, `rgba(0,0,0,${alpha})`);
		}

		this.ctx.fillStyle = gradient;
		this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
		this.mainSprite.texture.update();

		this.darkeningSprite.visible = enableDarkening;
	}
}