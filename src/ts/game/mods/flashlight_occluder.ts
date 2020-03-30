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
		let innerRadius = 0;
		
		let gradient = this.ctx.createRadialGradient(pos.x, pos.y, innerRadius, pos.x, pos.y, outerRadius);
		gradient.addColorStop(0, 'rgba(0,0,0,0.0)');
		gradient.addColorStop(0.75, 'rgba(0,0,0,0.1)');
		gradient.addColorStop(0.85, 'rgba(0,0,0,0.3)');
		gradient.addColorStop(0.90, 'rgba(0,0,0,0.5)');
		gradient.addColorStop(0.96, 'rgba(0,0,0,0.9)');
		gradient.addColorStop(1, 'rgba(0,0,0,1.0)');

		this.ctx.fillStyle = gradient;
		this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
		this.mainSprite.texture.update();

		this.darkeningSprite.visible = enableDarkening;
	}
}