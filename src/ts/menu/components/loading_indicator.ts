import { MathUtil, EaseType } from "../../util/math_util";

export class LoadingIndicator {
	public container: PIXI.Container;

	public width: number;
	private background: PIXI.Sprite;
	private loadingBar: PIXI.Sprite;
	private startTime: number = null;
	private scalingFactor: number = 1;

	constructor(width: number) {
		this.container = new PIXI.Container();
		this.width = width;

		this.background = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.background.alpha = 0;
		this.container.addChild(this.background);

		this.loadingBar = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.container.addChild(this.loadingBar);
	}

	resize(scalingFactor: number) {
		this.scalingFactor = scalingFactor;

		this.background.width = this.loadingBar.width = Math.floor(this.width * scalingFactor);
		this.background.height = this.loadingBar.height = Math.ceil(1 * scalingFactor);
	}

	update(now: number) {
		let elapsed: number;
		if (this.startTime) {
			elapsed = now - this.startTime;
		} else {
			elapsed = 0;
		}

		let totalCompletion = elapsed / 450;
		let n = Math.floor(totalCompletion);
		let completion = MathUtil.mirror(totalCompletion);
		
		let leftCompletion: number;
		let rightCompletion: number;
		let easeType = EaseType.EaseInOutCubic;

		// Based on the current n, we need to scale the completions differently so that one side is always "ahead" of the other
		if (n % 2 === 0) {
			leftCompletion = MathUtil.ease(easeType, completion);
			rightCompletion = MathUtil.ease(easeType, MathUtil.clamp(completion * 1.3, 0, 1));
		} else {
			leftCompletion = MathUtil.ease(easeType, 1 - MathUtil.clamp((1 - completion) * 1.3, 0, 1));
			rightCompletion = MathUtil.ease(easeType, completion);
		}

		this.loadingBar.x = leftCompletion * this.width * this.scalingFactor;
		this.loadingBar.width = (rightCompletion - leftCompletion) * this.width * this.scalingFactor;
	}

	start() {
		this.startTime = performance.now();
	}
}