import { InterpolatedValueChanger } from "../../util/interpolation";
import { EaseType, MathUtil } from "../../util/math_util";
import { toPercentageString } from "../../util/misc_util";

export class ProgressBar {
	public container: PIXI.Container;
	private background: PIXI.Sprite;
	private bar: PIXI.Sprite;

	private width: number;
	private scalingFactor: number;
	private showPercentage: boolean = false;
	private showAbsoluteData: boolean = false;
	private showPaused: boolean = false;
	private absoluteData = {done: 0, total: 0};

	private percentageText: PIXI.Text;
	private absoluteDataText: PIXI.Text;
	
	private progressInterpolator: InterpolatedValueChanger;

	constructor(width: number) {
		this.container = new PIXI.Container();
		this.width = width;

		this.background = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.background.tint = 0x131313;
		this.container.addChild(this.background);

		this.bar = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.container.addChild(this.bar);

		this.percentageText = new PIXI.Text("");
		this.percentageText.style = {
			fontFamily: "Exo2-Light",
			fill: 0xffffff
		};
		this.percentageText.alpha = 0.75;
		this.container.addChild(this.percentageText);

		this.absoluteDataText = new PIXI.Text("");
		this.absoluteDataText.style = {
			fontFamily: "Exo2-Light",
			fill: 0xffffff
		};
		this.absoluteDataText.alpha = 0.75;
		this.absoluteDataText.anchor.set(1.0, 0.0);
		this.container.addChild(this.absoluteDataText);

		this.progressInterpolator = new InterpolatedValueChanger({
			initial: 0,
			duration: 150, 
			ease: EaseType.EaseOutQuad
		});
	}

	resize(scalingFactor: number) {
		this.scalingFactor = scalingFactor;

		this.background.width = Math.floor(this.width * this.scalingFactor);
		this.background.height = Math.ceil(1 * this.scalingFactor);
		this.bar.height = this.background.height;

		this.percentageText.style.fontSize = Math.floor(10 * this.scalingFactor);
		this.percentageText.y = Math.floor(-15 * this.scalingFactor);
		this.percentageText.x = 0;

		this.absoluteDataText.style.fontSize = Math.floor(10 * this.scalingFactor);
		this.absoluteDataText.y = Math.floor(-15 * this.scalingFactor);
		this.absoluteDataText.x = this.background.width;
	}

	setProgress(progress: number) {
		if (this.progressInterpolator.getCurrentGoal() !== progress) this.progressInterpolator.setGoal(progress, performance.now());
	}

	setAbsoluteData(done: number, total: number) {
		this.absoluteData.done = done;
		this.absoluteData.total = total;
	}

	setExtras(showPercentage: boolean, showAbsoluteData: boolean, showPaused: boolean) {
		this.showPercentage = showPercentage;
		this.showAbsoluteData = showAbsoluteData;
		this.showPaused = showPaused;
	}

	update(now: number) {
		let progress = this.progressInterpolator.getCurrentValue(now);

		this.bar.width = Math.floor(this.background.width * progress);

		if (this.showPercentage) {
			this.percentageText.visible = true;

			let text = toPercentageString(Math.floor(progress * 1000)/1000, 1);
			if (this.showPaused) text += " (paused)";

			this.percentageText.text = text;
		} else {
			this.percentageText.visible = false;
		}

		if (this.showAbsoluteData) {
			this.absoluteDataText.visible = true;
			this.absoluteDataText.text = this.absoluteData.done + ' / ' + this.absoluteData.total;
		} else {
			this.absoluteDataText.visible = false;
		}
	}
}