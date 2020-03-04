import { TAU, MathUtil } from "../../util/math_util";

export class ProgressIndicator {
	public container: PIXI.Container;
	private ctx: CanvasRenderingContext2D;
	private diameter: number;
	private lastCompletion = 0;
	private lastIsPrelude = false;

	constructor(diameter: number) {
		this.changeDiameter(diameter);
	}

	changeDiameter(diameter: number) {
		this.diameter = MathUtil.floorToMultiple(diameter, 2);

		let sprite = new PIXI.Sprite();

		let canvas = document.createElement('canvas');
		canvas.setAttribute('width', String(Math.ceil(diameter)));
		canvas.setAttribute('height', String(Math.ceil(diameter)));
		let ctx = canvas.getContext('2d');
		this.ctx = ctx;

		let texture = PIXI.Texture.from(canvas);
		sprite.texture = texture;

		sprite.width = diameter;
		sprite.height = diameter;
		sprite.anchor.set(0.5, 0.5);

		this.container = sprite;

		this.draw(this.lastCompletion, this.lastIsPrelude);
	}

	draw(completion: number, isPrelude: boolean) {
		let ctx = this.ctx;

		ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

		let radius = this.diameter / 2;
		let lineWidth = 2;
		let startAngle = -Math.PI / 2; // "North"
		let endAngle = startAngle + TAU * completion;

		ctx.strokeStyle = '#9a999a';
		if (isPrelude) { // "Invert" the arc
			let temp = startAngle;
			startAngle = endAngle;
			endAngle = temp;

			ctx.strokeStyle = '#7ba632'; // Some green
		}

		ctx.lineWidth = radius - lineWidth / 2;
		ctx.beginPath();
		ctx.arc(radius, radius, radius/2, startAngle, endAngle);
		ctx.stroke();

		ctx.strokeStyle = '#ffffff';
		ctx.lineWidth = lineWidth;
		ctx.beginPath();
		ctx.arc(radius, radius, radius - lineWidth/2, 0, TAU);
		ctx.stroke();

		ctx.fillStyle = '#ffffff';
		ctx.beginPath();
		ctx.arc(radius, radius, radius / 10, 0, TAU);
		ctx.fill();

		let sprite = this.container as PIXI.Sprite;
		sprite.texture.update();

		this.lastCompletion = completion;
		this.lastIsPrelude = isPrelude;
	}
}