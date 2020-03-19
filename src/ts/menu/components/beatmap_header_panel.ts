import { Beatmap } from "../../datamodel/beatmap";
import { ExtendedBeatmapData } from "../../util/beatmap_util";
import { Interpolator } from "../../util/interpolation";
import { getBitmapFromImageFile, BitmapQuality } from "../../util/image_util";
import { fitSpriteIntoContainer, createPolygonTexture, createLinearGradientTexture } from "../../util/pixi_util";
import { EaseType, MathUtil } from "../../util/math_util";
import { VirtualFile } from "../../file_system/virtual_file";

const IMAGE_FADE_IN_TIME = 333;
const LEFT_PADDING = 18;

export class BeatmapHeaderPanel {
	public container: PIXI.Container;

	private width: number;
	private height: number;
	private doSlant: boolean;

	private mask: PIXI.Sprite;
	private darkening: PIXI.Sprite;

	private backgroundImageContainer: PIXI.Container;
	private markedForDeletionImages = new WeakSet<PIXI.Container>();
	private imageInterpolators = new WeakMap<PIXI.Container, Interpolator>();

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

		this.backgroundImageContainer = new PIXI.Container();
		let placeholderImage = new PIXI.Sprite(PIXI.Texture.WHITE);
		placeholderImage.tint = 0x000000;
		let lol = new PIXI.Container();
		lol.addChild(placeholderImage);
		this.backgroundImageContainer.addChild(lol);
		this.container.addChild(this.backgroundImageContainer);

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

		this.slideInInterpolator = new Interpolator({
			duration: 500,
			ease: EaseType.EaseOutCubic,
			defaultToFinished: true
		});
	}

	async loadImage(imageFile: VirtualFile) {
		if (!imageFile) return;

		let bitmap = await getBitmapFromImageFile(imageFile, BitmapQuality.Medium);
		let texture = PIXI.Texture.from(bitmap as any);

		let newSprite = new PIXI.Sprite(texture);
		fitSpriteIntoContainer(newSprite, this.mask.width, this.mask.height);

		let spriteContainer = new PIXI.Container();
		spriteContainer.addChild(newSprite);
		spriteContainer.pivot.set(this.mask.width / 2, this.mask.height / 2);
		spriteContainer.position.copyFrom(spriteContainer.pivot);

		for (let obj of this.backgroundImageContainer.children) {
			let container = obj as PIXI.Container;
			if (this.markedForDeletionImages.has(container)) continue;

			this.markedForDeletionImages.add(container);
			setTimeout(() => this.backgroundImageContainer.removeChild(container), IMAGE_FADE_IN_TIME);
		}

		this.backgroundImageContainer.addChild(spriteContainer);

		let interpolator = new Interpolator({
			duration: 333,
			ease: EaseType.EaseOutCubic
		});
		interpolator.start(performance.now());
		this.imageInterpolators.set(spriteContainer, interpolator);
	}

	updateText(beatmap: Beatmap | ExtendedBeatmapData, showDifficulty: boolean, beginAnimation: boolean) {
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
		this.mask.texture = this.createMaskTexture(scalingFactor);
		this.darkening.texture = this.createGradientTexture(scalingFactor);

		for (let obj of this.backgroundImageContainer.children) {
			let container = obj as PIXI.Container;
			let sprite = container.children[0] as PIXI.Sprite;

			fitSpriteIntoContainer(sprite, this.mask.width, this.mask.height);
			container.pivot.set(this.mask.width / 2, this.mask.height / 2);
			container.position.copyFrom(container.pivot);
		}

		let slantWidth = this.getSlantWidth();

		this.titleText.style = {
			fontFamily: 'Exo2-Regular',
			fill: 0xffffff,
			fontStyle: 'italic',
			fontSize: Math.floor(22 * scalingFactor),
			dropShadow: true,
			dropShadowDistance: 1,
			dropShadowBlur: 0
		};
		this.titleText.position.set((slantWidth + LEFT_PADDING) * scalingFactor, (this.height - 80) * scalingFactor);
		this.titleText.x = Math.floor(this.titleText.x);
		this.titleText.y = Math.floor(this.titleText.y);

		this.artistText.style = {
			fontFamily: 'Exo2-Regular',
			fill: 0xffffff,
			fontStyle: 'italic',
			fontSize: Math.floor(14 * scalingFactor),
			dropShadow: true,
			dropShadowDistance: 1,
			dropShadowBlur: 0
		};
		this.artistText.position.set((slantWidth + LEFT_PADDING) * scalingFactor, (this.height - 57) * scalingFactor);
		this.artistText.x = Math.floor(this.artistText.x);
		this.artistText.y = Math.floor(this.artistText.y);

		this.mapperTextPrefix.style = {
			fontFamily: 'Exo2-Light',
			fill: 0xffffff,
			fontStyle: 'italic',
			fontSize: Math.floor(12 * scalingFactor),
			dropShadow: true,
			dropShadowDistance: 1,
			dropShadowBlur: 0
		};
		this.mapperTextPrefix.position.set((slantWidth + LEFT_PADDING) * scalingFactor, (this.height - 27) * scalingFactor);
		this.mapperTextPrefix.x = Math.floor(this.mapperTextPrefix.x);
		this.mapperTextPrefix.y = Math.floor(this.mapperTextPrefix.y);

		this.mapperText.style = {
			fontFamily: 'Exo2-Bold',
			fill: 0xffffff,
			fontStyle: 'italic',
			fontSize: Math.floor(12 * scalingFactor),
			dropShadow: true,
			dropShadowDistance: 1,
			dropShadowBlur: 0
		};
		this.positionMapperText();

		this.difficultyText.style = {
			fontFamily: 'Exo2-Regular',
			fill: 0xffffff,
			fontStyle: 'italic',
			fontSize: Math.floor(12 * scalingFactor),
			dropShadow: true,
			dropShadowDistance: 1,
			dropShadowBlur: 0
		};
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

		for (let obj of this.backgroundImageContainer.children) {
			let container = obj as PIXI.Container;
			let interpolator = this.imageInterpolators.get(container);
			if (!interpolator) continue;

			let value = interpolator.getCurrentValue(now);

			container.alpha = value;
			container.scale.set(MathUtil.lerp(1.07, 1.0, value));
		}
	}
}