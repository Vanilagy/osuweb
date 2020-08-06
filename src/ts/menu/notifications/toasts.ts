import { Color, colorToHexNumber } from "../../util/graphics_util";
import { createPolygonTexture } from "../../util/pixi_util";
import { currentWindowDimensions, REFERENCE_SCREEN_HEIGHT } from "../../visuals/ui";
import { Interpolator } from "../../util/interpolation";
import { EaseType, MathUtil } from "../../util/math_util";

const TOAST_LONGEVITY = 1500;

export class ToastManager {
	public container: PIXI.Container;
	public scalingFactor: number = 1.0;
	private toasts: Toast[];

	constructor() {
		this.container = new PIXI.Container();
		this.toasts = [];

		this.resize();
	}

	resize() {
		this.scalingFactor = currentWindowDimensions.height / REFERENCE_SCREEN_HEIGHT;

		for (let t of this.toasts) {
			t.resize();
			this.positionToast(t);
		}
	}

	update(now: number) {
		for (let i = 0; i < this.toasts.length; i++) {
			let t = this.toasts[i];
			t.update(now);

			if (t.done) {
				// Remove the toast
				this.toasts.splice(i--, 1);
				this.container.removeChild(t.container);
			}
		}
	}

	private positionToast(toast: Toast) {
		toast.container.x = Math.floor(currentWindowDimensions.width / 2);
		toast.container.y = Math.floor(currentWindowDimensions.height * 0.8);
	}
	
	showToast(message: string, color: Color) {
		for (let t of this.toasts) t.hide();

		let toast = new Toast(this, message, color);

		this.container.addChild(toast.container);
		this.toasts.push(toast);

		toast.resize();
		this.positionToast(toast);
	}
}

class Toast {
	private manager: ToastManager;
	public container: PIXI.Container;

	private mask: PIXI.Sprite;
	private background: PIXI.Sprite;
	private topHighlight: PIXI.Sprite;
	private text: PIXI.Text;

	private fadeInInterpolator: Interpolator;
	private fadeOutInterpolator: Interpolator;
	private spawnTime: number;
	/** Whether or not this toast can be removed. */
	public done = false;

	constructor(manager: ToastManager, message: string, color: Color) {
		this.manager = manager;
		this.container = new PIXI.Container();

		this.mask = new PIXI.Sprite();
		this.container.mask = this.mask;
		this.container.addChild(this.mask);

		this.background = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.background.tint = 0x101010;
		this.background.alpha = 0.6;
		this.container.addChild(this.background);

		this.topHighlight = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.topHighlight.tint = colorToHexNumber(color);
		this.container.addChild(this.topHighlight);

		this.text = new PIXI.Text(message, {
			fontFamily: 'Exo2-Regular',
			fill: 0xffffff
		});
		this.text.alpha = 0.7;
		this.container.addChild(this.text);

		this.spawnTime = performance.now();

		this.fadeInInterpolator = new Interpolator({
			duration: 300,
			ease: EaseType.EaseOutQuint
		});
		this.fadeInInterpolator.start(this.spawnTime);

		this.fadeOutInterpolator = new Interpolator({
			duration: 500,
			ease: EaseType.EaseInOutCubic
		});
	}

	resize() {
		this.text.style.fontSize = Math.floor(12 * this.manager.scalingFactor);
		
		this.background.width = this.text.width + Math.floor(30 * this.manager.scalingFactor);
		this.background.height = Math.floor(20 * this.manager.scalingFactor);

		let slantWidth = this.background.height/5;
		this.mask.texture?.destroy(true);
		this.mask.texture = createPolygonTexture(this.background.width, this.background.height, [
			new PIXI.Point(0, 0), new PIXI.Point(this.background.width - slantWidth, 0), new PIXI.Point(this.background.width, this.background.height), new PIXI.Point(slantWidth, this.background.height)
		]);

		this.topHighlight.height = Math.ceil(0.5 * this.manager.scalingFactor);
		this.topHighlight.width = this.background.width;
		
		this.text.x = Math.floor((this.background.width - this.text.width) / 2);
		this.text.y = Math.floor(4 * this.manager.scalingFactor);

		this.container.pivot.x = Math.floor(this.container.width / 2);
	}

	update(now: number) {
		if (now - this.spawnTime >= TOAST_LONGEVITY) this.hide(); // Automatically hide the toast

		let fadeIn = this.fadeInInterpolator.getCurrentValue(now);
		let fadeOut = this.fadeOutInterpolator.getCurrentValue(now);
		if (fadeOut === 1) {
			this.done = true;
		}

		this.container.alpha = fadeIn * (1 - fadeOut);
		this.container.pivot.y = -(10 * this.manager.scalingFactor * (1 - fadeIn)) + (20 * this.manager.scalingFactor * fadeOut);
		this.container.scale.set(MathUtil.lerp(1, 0.8, fadeOut));
	}

	hide() {
		if (this.fadeOutInterpolator.isPlaying()) return;
		this.fadeOutInterpolator.start(performance.now());
	}
}