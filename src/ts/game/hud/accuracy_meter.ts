import { MathUtil, EaseType } from "../../util/math_util";
import { Hud } from "./hud";
import { createPolygonTexture } from "../../util/pixi_util";
import { InterpolatedValueChanger } from "../../util/interpolation";
import { ScoringValue } from "../../datamodel/scoring/score";

const BLUE_STRIP_COLOR = 0x38b8e8;
const GREEN_STRIP_COLOR = 0x57e11a;
const ORANGE_STRIP_COLOR = 0xd6ac52;
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
	private averagePointer: PIXI.Sprite;
	private averagePointerInterpolator: InterpolatedValueChanger;
	private width: number;
	private lineWidth: number;
	private height: number;
	private accuracyLines: PIXI.Graphics[];
	private accuracyLineSpawnTimes: WeakMap<PIXI.Graphics, number>;
	private accuracyLineInaccuracies: WeakMap<PIXI.Graphics, number>;
	private fadeOutStart: number = -Infinity;
	private alphaFilter: PIXI.filters.AlphaFilter; // We need to use an alpha filter here, because fading out without one looks weird due to the additive blend mode of the accuracy lines. Using the filter, everything fades out as if it were one.

	constructor(hud: Hud) {
		this.hud = hud;
		this.container = new PIXI.Container();
		this.base = new PIXI.Graphics();
		this.overlay = new PIXI.Container();
		this.averagePointer = new PIXI.Sprite();
		this.accuracyLines = [];
		this.accuracyLineSpawnTimes = new WeakMap();
		this.accuracyLineInaccuracies = new WeakMap();
		this.alphaFilter = new PIXI.filters.AlphaFilter();

		this.container.addChild(this.base);
		this.container.addChild(this.overlay);
		this.container.addChild(this.averagePointer);

		this.container.filters = [this.alphaFilter];

		this.averagePointerInterpolator = new InterpolatedValueChanger({
			initial: 0,
			duration: 700,
			ease: EaseType.EaseOutQuad
		});
	}

	init() {
		let { processedBeatmap } = this.hud.controller.currentPlay;

		this.time50 = processedBeatmap.difficulty.getHitDeltaForScoringValue(ScoringValue.Hit50);
		this.time100 = processedBeatmap.difficulty.getHitDeltaForScoringValue(ScoringValue.Hit100);
		this.time300 = processedBeatmap.difficulty.getHitDeltaForScoringValue(ScoringValue.Hit300);

		this.resize();
	}

	resize() {
		let { screenPixelRatio } = this.hud.controller.currentPlay;

		this.height = Math.round(20 * screenPixelRatio);
		this.width = MathUtil.floorToMultiple(this.time50 * screenPixelRatio * 1.6, 2);

		this.lineWidth = Math.floor(2.5 * screenPixelRatio);

		this.base.clear();

		// Black background
		this.base.beginFill(0x000000, 0.5);
		this.base.drawRect(0, 0, this.width, this.height);
		this.base.endFill();

		let stripY = Math.floor(this.height*2/5);
		let stripHeight = Math.ceil(this.height/5);

		// Orange strip
		this.base.beginFill(ORANGE_STRIP_COLOR, 1);
		this.base.drawRect(0, stripY, this.width, stripHeight);
		this.base.endFill();

		// Green strip
		let greenStripWidth = Math.ceil(this.time100/this.time50 * this.width);
		this.base.beginFill(GREEN_STRIP_COLOR, 1);
		this.base.drawRect(Math.floor(this.width/2 - greenStripWidth/2), stripY, greenStripWidth, stripHeight);
		this.base.endFill();

		// Blue strip
		let blueStripWidth = Math.ceil(this.time300/this.time50 * this.width);
		this.base.beginFill(BLUE_STRIP_COLOR, 1);
		this.base.drawRect(Math.floor(this.width/2 - blueStripWidth/2), stripY, blueStripWidth, stripHeight);
		this.base.endFill();

		// White middle line
		let lineWidth = this.lineWidth;
		this.base.beginFill(0xffffff);
		this.base.drawRect(Math.ceil(this.width/2 - lineWidth/2), 0, lineWidth, this.height);
		this.base.endFill();

		this.container.width = this.width;
		this.container.height = this.height;
		this.container.pivot.x = Math.floor(this.width / 2);
		this.container.pivot.y = this.height;

		// Reposition the lines
		for (let line of this.accuracyLines) {
			this.drawLine(line);
			this.positionLine(line, this.accuracyLineInaccuracies.get(line));
		}

		let averagePointerWidth = 10;
		let averagePointerHeight = averagePointerWidth * 0.5;
		this.averagePointer.texture = createPolygonTexture(averagePointerWidth, averagePointerHeight, [
			new PIXI.Point(0, 0), new PIXI.Point(averagePointerWidth, 0), new PIXI.Point(averagePointerWidth/2, averagePointerHeight)
		], screenPixelRatio);
		this.averagePointer.pivot.x = Math.floor(averagePointerWidth * screenPixelRatio - 1) / 2;
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
				line.destroy();
				this.overlay.removeChild(line);
				this.accuracyLines.splice(i, 1);
				i--;
			}
		}

		// Make sure the whole thing fades out after a few seconds of no new accuracy lines
		let fadeOutCompletion = (currentTime - this.fadeOutStart) / ACCURACY_METER_FADE_OUT_TIME;
		fadeOutCompletion = MathUtil.clamp(fadeOutCompletion, 0, 1);
		this.alphaFilter.alpha = 1 - fadeOutCompletion;

		let averagePointerPos = this.averagePointerInterpolator.getCurrentValue(currentTime);
		this.averagePointer.x = Math.floor((1 + averagePointerPos / this.time50) * this.width/2);
	}

	reset() {
		this.overlay.removeChildren();
		this.accuracyLines.length = 0;
		this.fadeOutStart = -Infinity;
		this.averagePointerInterpolator.reset(0);
	}

	addAccuracyLine(inaccuracy: number, currentTime: number) {
		let { processedBeatmap } = this.hud.controller.currentPlay;
		let adjustedTime = this.hud.controller.currentPlay.toPlaybackRateIndependentTime(currentTime);

		let scoringValue = processedBeatmap.difficulty.getScoringValueForHitDelta(Math.abs(inaccuracy));
		if (scoringValue === 0) return;

		let color = (() => {
			if (scoringValue === 300) return BLUE_STRIP_COLOR;
			else if (scoringValue === 100) return GREEN_STRIP_COLOR;
			return ORANGE_STRIP_COLOR;
		})();

		let line = new PIXI.Graphics();
		line.tint = color;
		line.blendMode = PIXI.BLEND_MODES.ADD;

		this.drawLine(line);
		this.positionLine(line, inaccuracy);

		this.overlay.addChild(line);
		this.accuracyLines.push(line);
		this.accuracyLineSpawnTimes.set(line, adjustedTime);
		this.accuracyLineInaccuracies.set(line, inaccuracy);

		this.fadeOutStart = adjustedTime + ACCURACY_METER_FADE_OUT_DELAY;

		let total = 0;
		for (let i = 0; i < this.accuracyLines.length; i++) {
			total += this.accuracyLineInaccuracies.get(this.accuracyLines[i]);
		}
		let averageInaccuracy = total / this.accuracyLines.length;
		this.averagePointerInterpolator.setGoal(averageInaccuracy, adjustedTime);
	}

	private drawLine(graphics: PIXI.Graphics) {
		graphics.clear();
		graphics.beginFill(0xffffff, 0.65);
		graphics.drawRect(0, 0, this.lineWidth, this.height);
		graphics.endFill();
		graphics.pivot.x = Math.floor(graphics.width / 2);
	}

	private positionLine(line: PIXI.Graphics, inaccuracy: number) {
		line.x = Math.floor((1 + inaccuracy / this.time50) * this.width/2);
	}

	fadeOutNow(currentTime: number) {
		if (this.fadeOutStart > currentTime) this.fadeOutStart = currentTime;
	}
}