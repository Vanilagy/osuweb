import { VirtualFile } from "../../file_system/virtual_file";
import { getBitmapFromImageFile, BitmapQuality } from "../../util/image_util";
import { fitSpriteIntoContainer } from "../../util/pixi_util";
import { NO_IMAGE_TINT } from "../../util/constants";
import { Interpolator } from "../../util/interpolation";
import { EaseType, MathUtil } from "../../util/math_util";

const DEFAULT_FADE_IN_TIME = 333;

/** A little helper class that's good for displaying images and transitioning between them. */
export class ImageCrossfader {
	public container: PIXI.Container;

	private width: number;
	private height: number;
	private fadeInTime: number = DEFAULT_FADE_IN_TIME;
	private ease: EaseType = EaseType.EaseInOutQuad;
	private scaleStart = 1.0;
	private scaleEnd = 1.0;

	private markedForDeletion = new WeakSet<PIXI.Container>();
	private interpolators = new WeakMap<PIXI.Container, Interpolator>();
	private currentAwaitId = 0;

	constructor() {
		this.container = new PIXI.Container();
	}

	setFadeInTime(time: number) {
		this.fadeInTime = time;
	}

	setEase(ease: EaseType) {
		this.ease = ease;
	}

	setScaleBehavior(start: number, end: number) {
		this.scaleStart = start;
		this.scaleEnd = end;
	}

	async loadImage(imageFile: VirtualFile, quality: BitmapQuality, doAnimation = true) {
		let texture: PIXI.Texture;
		if (imageFile) {
			let lastId = ++this.currentAwaitId;

			let bitmap = await getBitmapFromImageFile(imageFile, quality);
			texture = PIXI.Texture.from(bitmap as any);

			// If the id has changed, that means this method was called again during decoding.
			if (lastId !== this.currentAwaitId) return;
		} else {
			texture = PIXI.Texture.WHITE;
		}

		let newSprite = new PIXI.Sprite(texture);
		fitSpriteIntoContainer(newSprite, this.width, this.height);
		if (!imageFile) newSprite.tint = NO_IMAGE_TINT;

		let spriteContainer = new PIXI.Container();
		spriteContainer.addChild(newSprite);
		spriteContainer.pivot.set(this.width / 2, this.height / 2);
		spriteContainer.position.copyFrom(spriteContainer.pivot);

		for (let obj of this.container.children) {
			let otherContainer = obj as PIXI.Container;
			if (this.markedForDeletion.has(otherContainer)) continue;
			this.markedForDeletion.add(otherContainer);

			if (doAnimation) {
				setTimeout(() => this.container.removeChild(otherContainer), this.fadeInTime);
			} else {
				this.container.removeChild(otherContainer);
			}
		}

		this.container.addChild(spriteContainer);

		let interpolator = new Interpolator({
			duration: this.fadeInTime,
			ease: this.ease
		});
		interpolator.start(performance.now());
		this.interpolators.set(spriteContainer, interpolator);

		if (!doAnimation) interpolator.end();
	}

	resize(width: number, height: number) {
		this.width = width;
		this.height = height;

		for (let obj of this.container.children) {
			let spriteContainer = obj as PIXI.Container;
			let sprite = spriteContainer.children[0] as PIXI.Sprite;

			fitSpriteIntoContainer(sprite, this.width, this.height);
			spriteContainer.pivot.set(this.width / 2, this.height / 2);
			spriteContainer.position.copyFrom(spriteContainer.pivot);
		}
	}

	update(now: number) {
		for (let obj of this.container.children) {
			let spriteContainer = obj as PIXI.Container;
			let interpolator = this.interpolators.get(spriteContainer);
			if (!interpolator) continue;

			let value = interpolator.getCurrentValue(now);

			spriteContainer.alpha = value;
			spriteContainer.scale.set(MathUtil.lerp(this.scaleStart, this.scaleEnd, value));
		}
	}
}