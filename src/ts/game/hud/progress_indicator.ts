import { TAU, MathUtil } from "../../util/math_util";

export class ProgressIndicator {
	public container: PIXI.Container;
	private ctx: CanvasRenderingContext2D;
	private diameter: number;
	private lastCompletion = 0;
	private lastIsPrelude = false;

	constructor(diameter: number) {
		this.container = new PIXI.Container();
		this.changeDiameter(diameter);
	}

	changeDiameter(diameter: number) {
		this.diameter = MathUtil.floorToMultiple(diameter, 2);

		let sprite = new PIXI.Sprite();

		let canvas = document.createElement('canvas');
		canvas.setAttribute('width', String(Math.ceil(this.diameter)));
		canvas.setAttribute('height', String(Math.ceil(this.diameter)));
		let ctx = canvas.getContext('2d');
		this.ctx = ctx;

		let texture = PIXI.Texture.from(canvas);
		sprite.texture = texture;

		sprite.width = this.diameter;
		sprite.height = this.diameter;
		sprite.anchor.set(0.5, 0.5);

		this.container.removeChildren();
		this.container.addChild(sprite);

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

			ctx.strokeStyle = '#9CBB3C'; // Some green
		}

		ctx.lineWidth = radius - lineWidth / 2;
		ctx.beginPath();
		ctx.arc(radius, radius, radius/2, startAngle, endAngle);
		ctx.stroke();

		ctx.strokeStyle = '#ffffff';
		ctx.lineWidth = lineWidth;
		ctx.beginPath();
		ctx.arc(radius, radius, Math.max(radius - lineWidth/2, 0), 0, TAU);
		ctx.stroke();

		ctx.fillStyle = '#ffffff';
		ctx.beginPath();
		ctx.arc(radius, radius, radius / 10, 0, TAU);
		ctx.fill();

		let sprite = this.container.children[0] as PIXI.Sprite;
		sprite.texture.update();

		this.lastCompletion = completion;
		this.lastIsPrelude = isPrelude;
	}
}