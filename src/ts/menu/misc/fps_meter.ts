import { currentWindowDimensions, REFERENCE_SCREEN_HEIGHT } from "../../visuals/ui";
import { getCurrentTargetFps } from "../../visuals/rendering";

export class FpsMeter {
	public container: PIXI.Container;

	private background: PIXI.Sprite;
	private text: PIXI.Text;

	private calculatedFps: number = null;
	private framesInTheLastSecond: number[] = [];

	private lastDisplayTime = -Infinity;

	constructor() {
		this.container = new PIXI.Container();
		this.container.alpha = 0.666;

		this.background = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.background.tint = 0x000000;

		this.text = new PIXI.Text('FPS: -', {
			fontFamily: 'Exo2-Regular',
			fill: 0xffffff
		});

		this.container.addChild(this.background, this.text);

		this.resize();
		this.hide();
	}

	resize() {
		let scalingFactor = currentWindowDimensions.height / REFERENCE_SCREEN_HEIGHT;

		this.background.width = Math.floor(50 * scalingFactor);
		this.background.height = Math.floor(15 * scalingFactor);

		this.text.style.fontSize = Math.floor(10 * scalingFactor);
		this.text.x = Math.floor(4 * scalingFactor);
		this.text.y = Math.floor(2 * scalingFactor);

		this.container.x = currentWindowDimensions.width - this.background.width;
		this.container.y = currentWindowDimensions.height - this.background.height;
	}

	update(now: number) {
		// Calculating the FPS works by keeping a list of times in which a frame was drawn, then removing everything but the most recent second worth of frames, and then counting those.

		while (now - this.framesInTheLastSecond[0] > 1000) this.framesInTheLastSecond.shift();
		this.framesInTheLastSecond.push(now);

		if (now - this.lastDisplayTime >= 1000 / 30) { // Only update the FPS counter at a specific interval for minimal impact on... FPS. lol
			this.displayFps(this.framesInTheLastSecond.length);
			this.lastDisplayTime = now;
		}
	}

	private displayFps(val: number) {
		let currentTarget = getCurrentTargetFps();
		if (Math.abs(currentTarget - val) < 2) val = currentTarget; // When really close the current FPS target, make it be the target exactly.

		this.text.text = "FPS: " + Math.floor(Math.max(1, val));
	}

	show() {
		this.container.visible = true;
		if (this.calculatedFps) this.displayFps(this.calculatedFps);
	}

	hide() {
		this.container.visible = false;
	}
}