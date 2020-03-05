import { MathUtil, EaseType } from "../../util/math_util";
import { currentWindowDimensions } from "../../visuals/ui";
import { Hud } from "./hud";

const ACCURACY_METER_HEIGHT_FACTOR = 0.02;
const ACCURACY_LINE_LIFETIME = 10000; // In ms
const ACCURACY_METER_FADE_OUT_DELAY = 4000; // In ms
const ACCURACY_METER_FADE_OUT_TIME = 1000; // In ms

export class AccuracyMeter {
	public hud: Hud;
	public container: PIXI.Container;

	private time50: number; // If you don't know what it means, just look where it's assigned.
	private time100: number;
	private time300: number;

	private base: PIXI.Graphics;
	private overlay: PIXI.Container;
	private width: number;
	private lineWidth: number;
	private height: number;
	private accuracyLines: PIXI.Graphics[];
	private accuracyLineSpawnTimes: WeakMap<PIXI.Graphics, number>;
	private fadeOutStart: number = -Infinity;
	private alphaFilter: PIXI.filters.AlphaFilter; // We need to use an alpha filter here, because fading out without one looks weird due to the additive blend mode of the accuracy lines. Using the filter, everything fades out as if it were one.

	constructor(hud: Hud) {
		this.hud = hud;
		this.container = new PIXI.Container();
		this.base = new PIXI.Graphics();
		this.overlay = new PIXI.Container();
		this.accuracyLines = [];
		this.accuracyLineSpawnTimes = new WeakMap();
		this.alphaFilter = new PIXI.filters.AlphaFilter();

		this.container.addChild(this.base);
		this.container.addChild(this.overlay);

		this.container.filters = [this.alphaFilter];
	}

	init() {
		let { processedBeatmap } = this.hud.controller.currentPlay;

		this.time50 = processedBeatmap.difficulty.getHitDeltaForJudgement(50);
		this.time100 = processedBeatmap.difficulty.getHitDeltaForJudgement(100);
		this.time300 = processedBeatmap.difficulty.getHitDeltaForJudgement(300);

		this.resize();
	}

	resize() {
		this.height = Math.max(15, Math.round(currentWindowDimensions.height * ACCURACY_METER_HEIGHT_FACTOR / 5) * 5);
		let widthScale = this.height * 0.04;
		this.width = Math.round(this.time50*2 * widthScale / 2) * 2;

		//this.lineWidth = Math.floor(this.height/5 / 2) * 2;
		this.lineWidth = 2;

		this.base.clear();

		// Black background
		this.base.beginFill(0x000000, 0.5);
		this.base.drawRect(0, 0, this.width, this.height);
		this.base.endFill();

		// Orange strip
		this.base.beginFill(0xd6ac52, 1);
		this.base.drawRect(0, this.height*2/5, this.width, this.height/5);
		this.base.endFill();

		// Green strip
		let greenStripWidth = Math.ceil(this.time100*2 * widthScale);
		this.base.beginFill(0x57e11a, 1);
		this.base.drawRect(Math.floor(this.width/2 - greenStripWidth/2), this.height*2/5, greenStripWidth, this.height/5);
		this.base.endFill();

		// Blue strip
		let blueStripWidth = Math.ceil(this.time300*2 * widthScale);
		this.base.beginFill(0x38b8e8, 1);
		this.base.drawRect(Math.floor(this.width/2 - blueStripWidth/2), this.height*2/5, blueStripWidth, this.height/5);
		this.base.endFill();

		// White middle line
		let lineWidth = this.lineWidth;
		this.base.beginFill(0xFFFFFF);
		this.base.drawRect(this.width/2 - lineWidth/2, 0, lineWidth, this.height);
		this.base.endFill();

		this.container.width = this.width;
		this.container.height = this.height;
	}
	
	update(currentTime: number) {
		for (let i = 0; i < this.accuracyLines.length; i++) {
			let line = this.accuracyLines[i];

			let spawnTime = this.accuracyLineSpawnTimes.get(line);
			let completion = (currentTime - spawnTime) / ACCURACY_LINE_LIFETIME;
			completion = MathUtil.clamp(completion, 0, 1);
			completion = MathUtil.ease(EaseType.EaseInQuad, completion);
			let alpha = 1 - completion;

			line.alpha = alpha;

			// Remove the line once it's invisible
			if (alpha === 0) {
				this.overlay.removeChild(line);
				this.accuracyLines.splice(i, 1);
				i--;
			}
		}

		// Make sure the whole thing fades out after a few seconds of no new accuracy lines
		let fadeOutCompletion = (currentTime - this.fadeOutStart) / ACCURACY_METER_FADE_OUT_TIME;
		fadeOutCompletion = MathUtil.clamp(fadeOutCompletion, 0, 1);
		this.alphaFilter.alpha = 1 - fadeOutCompletion;
	}

	addAccuracyLine(inaccuracy: number, currentTime: number) {
		let { processedBeatmap } = this.hud.controller.currentPlay;

		let judgement = processedBeatmap.difficulty.getJudgementForHitDelta(Math.abs(inaccuracy));
		if (judgement === 0) return;

		let color = (() => {
			if (judgement === 300) return 0x38b8e8;
			else if (judgement === 100) return 0x57e11a;
			return 0xd6ac52;
		})();

		let line = new PIXI.Graphics();
		line.beginFill(color, 0.65);
		line.drawRect(0, 0, this.lineWidth, this.height);
		line.endFill();
		line.blendMode = PIXI.BLEND_MODES.ADD;

		line.pivot.x = line.width/2;
		line.x = this.width/2 + (inaccuracy / this.time50) * this.width/2;

		this.overlay.addChild(line);
		this.accuracyLines.push(line);
		this.accuracyLineSpawnTimes.set(line, currentTime);

		this.fadeOutStart = currentTime + ACCURACY_METER_FADE_OUT_DELAY;
	}

	fadeOutNow(currentTime: number) {
		if (this.fadeOutStart > currentTime) this.fadeOutStart = currentTime;
	}
}