import { ExtendedBeatmapData, BasicBeatmapData } from "../../util/beatmap_util";
import { Interpolator } from "../../util/interpolation";
import { BitmapQuality } from "../../util/image_util";
import { createPolygonTexture, createLinearGradientTexture } from "../../util/pixi_util";
import { EaseType } from "../../util/math_util";
import { VirtualFile } from "../../file_system/virtual_file";
import { ImageCrossfader } from "./image_crossfader";
import { shallowObjectClone } from "../../util/misc_util";
import { Beatmap } from "../../datamodel/beatmap/beatmap";

const LEFT_PADDING = 18;

export class BeatmapHeaderPanel {
	public container: PIXI.Container;

	private width: number;
	private height: number;
	private doSlant: boolean;

	private mask: PIXI.Sprite;
	private darkening: PIXI.Sprite;

	private imageCrossfader: ImageCrossfader;

	private titleText: PIXI.Text;
	private artistText: PIXI.Text;
	private mapperTextPrefix: PIXI.Text; // Need to have two separate text thingies because they have different styling, and PIXI isn't flexible enough
	private mapperText: PIXI.Text;
	private difficultyText: PIXI.Text;

	private slideInInterpolator: Interpolator;

	constructor(width: number, height: number, doSlant: boolean, hasShadow: boolean) {
		this.container = new PIXI.Container();
		
		this.width = width;
		this.height = height;
		this.doSlant = doSlant;

		this.mask = new PIXI.Sprite();
		this.container.addChild(this.mask);
		this.container.mask = this.mask;

		if (hasShadow) {
			let shadowFilter = new PIXI.filters.DropShadowFilter({
				rotation: 45,
				alpha: 0.25,
				quality: 10,
				pixelSize: 0.1,
			});

			this.container.filters = [shadowFilter];
		}

		this.imageCrossfader = new ImageCrossfader();
		this.imageCrossfader.setScaleBehavior(1.07, 1.0);
		this.imageCrossfader.setEase(EaseType.EaseOutCubic);
		this.container.addChild(this.imageCrossfader.container);

		this.darkening = new PIXI.Sprite();
		this.container.addChild(this.darkening);

		this.titleText = new PIXI.Text('');
		this.container.addChild(this.titleText);
		this.artistText = new PIXI.Text('');
		this.container.addChild(this.artistText);
		this.mapperTextPrefix = new PIXI.Text('');
		this.container.addChild(this.mapperTextPrefix);
		this.mapperText = new PIXI.Text('');
		this.container.addChild(this.mapperText);
		this.difficultyText = new PIXI.Text('');
		this.difficultyText.anchor.set(1.0, 0.0);
		this.container.addChild(this.difficultyText);

		this.titleText.style = {
			fontFamily: 'Exo2-Regular',
			fill: 0xffffff,
			fontStyle: 'italic',
			dropShadow: true,
			dropShadowDistance: 1,
			dropShadowBlur: 0
		};
		this.artistText.style = shallowObjectClone(this.titleText.style);
		this.mapperTextPrefix.style = shallowObjectClone(this.titleText.style);
		this.mapperTextPrefix.style.fontFamily = 'Exo2-Light';
		this.mapperText.style = shallowObjectClone(this.titleText.style);
		this.mapperText.style.fontFamily = 'Exo2-Bold';
		this.difficultyText.style = shallowObjectClone(this.titleText.style);

		this.slideInInterpolator = new Interpolator({
			duration: 500,
			ease: EaseType.EaseOutCubic,
			defaultToFinished: true
		});
	}

	async loadImage(imageFile: VirtualFile, doAnimation = true) {
		await this.imageCrossfader.loadImage(imageFile, BitmapQuality.Medium, doAnimation);
	}

	updateText(beatmap: Beatmap | ExtendedBeatmapData | BasicBeatmapData, showDifficulty: boolean, beginAnimation: boolean) {
		this.titleText.text = beatmap.title + ' ';
		this.artistText.text = beatmap.artist + ' ';
		this.mapperTextPrefix.text = 'Mapped by ';
		this.mapperText.text = beatmap.creator + ' ';
		this.difficultyText.text = showDifficulty? beatmap.version + ' ' : '';

		this.positionMapperText();

		if (beginAnimation) this.slideInInterpolator.start(performance.now());
	}

	private positionMapperText() {
		this.mapperText.x = Math.floor(this.mapperTextPrefix.x + this.mapperTextPrefix.width);
		this.mapperText.y = Math.floor(this.mapperTextPrefix.y - (this.mapperText.height - this.mapperTextPrefix.height) / 2);
	}

	private getSlantWidth() {
		return this.doSlant? this.height/5 : 0;
	}

	private createMaskTexture(scalingFactor: number) {
		let slantWidth = this.getSlantWidth();

		return createPolygonTexture(this.width + slantWidth, this.height,
			[new PIXI.Point(0, 0), new PIXI.Point(slantWidth, this.height), new PIXI.Point(this.width + slantWidth, this.height), new PIXI.Point(this.width, 0)],
		scalingFactor);
	}

	private createGradientTexture(scalingFactor: number) {
		let slantWidth = this.getSlantWidth();

		return createLinearGradientTexture(this.width + slantWidth, this.height, new PIXI.Point(0, this.height+1), new PIXI.Point(0, 0), [[0, 'rgba(0,0,0,0.40)'], [100 / this.height, 'rgba(0,0,0,0)']], scalingFactor);
	}

	resize(scalingFactor: number) {
		this.mask.texture.destroy(true);
		this.darkening.texture.destroy(true);

		this.mask.texture = this.createMaskTexture(scalingFactor);
		this.darkening.texture = this.createGradientTexture(scalingFactor);

		this.imageCrossfader.resize(this.mask.width, this.mask.height);

		let slantWidth = this.getSlantWidth();

		this.titleText.style.fontSize = Math.floor(22 * scalingFactor);
		this.titleText.position.set((slantWidth + LEFT_PADDING) * scalingFactor, (this.height - 80) * scalingFactor);
		this.titleText.x = Math.floor(this.titleText.x);
		this.titleText.y = Math.floor(this.titleText.y);

		this.artistText.style.fontSize = Math.floor(14 * scalingFactor);
		this.artistText.position.set((slantWidth + LEFT_PADDING) * scalingFactor, (this.height - 57) * scalingFactor);
		this.artistText.x = Math.floor(this.artistText.x);
		this.artistText.y = Math.floor(this.artistText.y);

		this.mapperTextPrefix.style.fontSize = Math.floor(12 * scalingFactor);
		this.mapperTextPrefix.position.set((slantWidth + LEFT_PADDING) * scalingFactor, (this.height - 27) * scalingFactor);
		this.mapperTextPrefix.x = Math.floor(this.mapperTextPrefix.x);
		this.mapperTextPrefix.y = Math.floor(this.mapperTextPrefix.y);

		this.mapperText.style.fontSize = Math.floor(12 * scalingFactor);
		this.positionMapperText();

		this.difficultyText.style.fontSize = Math.floor(12 * scalingFactor);
		this.difficultyText.position.set((this.width + slantWidth - 20) * scalingFactor, (this.height - 27) * scalingFactor);
		this.difficultyText.x = Math.floor(this.difficultyText.x);
		this.difficultyText.y = Math.floor(this.difficultyText.y);

		if (this.container.filters) {
			let shadowFilter = this.container.filters[0] as PIXI.filters.DropShadowFilter;

			shadowFilter.blur = 8 * scalingFactor;
			shadowFilter.distance = 4 * scalingFactor;
		}
	}

	update(now: number, scalingFactor: number) {
		let fadeInValue = this.slideInInterpolator.getCurrentValue(now);

		this.difficultyText.alpha = fadeInValue;

		this.titleText.pivot.x = -(1 - fadeInValue) * 10 * scalingFactor;
		this.artistText.pivot.x = this.titleText.pivot.x * 0.666;
		this.mapperText.pivot.x = this.mapperTextPrefix.pivot.x = this.titleText.pivot.x * 0.333;

		this.imageCrossfader.update(now);
	}
}