import { Interpolator } from "../../util/interpolation";
import { EaseType, MathUtil } from "../../util/math_util";
import { createPolygonTexture } from "../../util/pixi_util";
import { InteractionGroup, InteractionRegistration } from "../../input/interactivity";

export const DEFAULT_BUTTON_WIDTH = 140;
export const DEFAULT_BUTTON_HEIGHT = 35;
export const DEFAULT_BUTTON_MARGIN = 8;

export enum ButtonPivot {
	TopLeft,
	Center,
	TopRight
}

export class Button {
	public container: PIXI.Container;
	private width: number;
	private height: number;
	private fontSize: number;
	private pivotSetting: ButtonPivot;
	public registration: InteractionRegistration;

	private mask: PIXI.Sprite;
	private background: PIXI.Sprite;
	private topHighlight: PIXI.Sprite;
	private label: PIXI.Text;
	private hoverInterpolator: Interpolator;
	private pressdownInterpolator: Interpolator;
	private lastScalingFactor: number;
	private lastBasePivot: PIXI.Point;

	constructor(width: number, height: number, fontSize: number, pivotSetting: ButtonPivot, label: string, highlightColor: number) {
		this.container = new PIXI.Container();
		this.width = width;
		this.height = height;
		this.fontSize = fontSize;
		this.pivotSetting = pivotSetting;

		this.mask = new PIXI.Sprite();
		this.container.addChild(this.mask);

		this.background = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.background.tint = 0x0F0F0F;
		this.background.alpha = 0.9;
		this.background.mask = this.mask;
		this.container.addChild(this.background);

		this.topHighlight = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.topHighlight.tint = highlightColor;
		this.topHighlight.mask = this.mask;
		this.container.addChild(this.topHighlight);

		this.label = new PIXI.Text(label);
		this.label.alpha = 0.8;
		this.label.style = {
			fontFamily: 'Exo2-LightItalic',
			fill: 0xffffff,
			dropShadow: true,
			dropShadowDistance: 1,
			dropShadowBlur: 0
		};
		this.container.addChild(this.label);

		this.hoverInterpolator = new Interpolator({
			duration: 150,
			ease: EaseType.EaseOutCubic,
			reverseEase: EaseType.EaseInCubic,
			reverseDuration: 400,
			beginReversed: true,
			defaultToFinished: true
		});
		this.pressdownInterpolator = new Interpolator({
			duration: 50,
			ease: EaseType.EaseOutCubic,
			reverseEase: EaseType.EaseInCubic,
			reverseDuration: 400,
			beginReversed: true,
			defaultToFinished: true
		});
	}

	setLabel(newLabel: string) {
		this.label.text = newLabel;
		this.resize(this.lastScalingFactor);
	}

	resize(scalingFactor: number) {
		this.lastScalingFactor = scalingFactor;
		let slantWidth = this.height/5;

		this.mask.texture.destroy(true);
		this.mask.texture = createPolygonTexture(this.width + slantWidth, this.height, [
			new PIXI.Point(0, 0), new PIXI.Point(this.width, 0), new PIXI.Point(this.width + slantWidth, this.height), new PIXI.Point(slantWidth, this.height)
		], scalingFactor);

		this.background.width = Math.floor((this.width + slantWidth) * scalingFactor);
		this.background.height = Math.floor(this.height * scalingFactor);

		this.topHighlight.width = this.background.width;
		this.topHighlight.height = Math.ceil(2 * scalingFactor);

		this.label.style.fontSize = Math.floor(this.fontSize * scalingFactor);
		this.label.pivot.x = Math.floor(this.label.width / 2);
		this.label.pivot.y = Math.floor(this.label.height / 2);
		this.label.x = Math.floor((this.width + slantWidth)/2 * scalingFactor);
		this.label.y = Math.floor(this.height/2 * scalingFactor);

		switch (this.pivotSetting) {
			case ButtonPivot.TopLeft: {
				this.container.pivot.x = 0;
				this.container.pivot.y = 0;
			}; break;
			case ButtonPivot.Center: {
				this.container.pivot.x = Math.floor(this.container.width/2);
				this.container.pivot.y = Math.floor(this.container.height/2);
			}; break;
			case ButtonPivot.TopRight: {
				this.container.pivot.x = Math.floor(this.width * scalingFactor);
				this.container.pivot.y = 0;
			}; break;
		}
		this.lastBasePivot = this.container.pivot.clone();
	}

	update(now: number) {
		let scalingFactor = this.lastScalingFactor;
		let hoverCompletion = this.hoverInterpolator.getCurrentValue(now);

		this.label.alpha = MathUtil.lerp(0.75, 1.0, hoverCompletion);

		let offset = 2 * scalingFactor * hoverCompletion;
		this.container.pivot.copyFrom(this.lastBasePivot);
		this.container.pivot.x += offset;
		this.container.pivot.y += offset;
		if (hoverCompletion % 1 === 0) {
			this.container.pivot.x = Math.ceil(this.container.pivot.x);
			this.container.pivot.y = Math.ceil(this.container.pivot.y);
		}

		let pressdownCompletion = this.pressdownInterpolator.getCurrentValue(now);
		this.background.tint = Math.floor(MathUtil.lerp(15, 6, pressdownCompletion)) * 0x10101;
	}

	setupInteraction(group: InteractionGroup, onclick: () => any) {
		this.registration = new InteractionRegistration(this.container);
		group.add(this.registration);

		this.registration.addButtonHandlers(
			onclick,
			() => this.hoverInterpolator.setReversedState(false, performance.now()),
			() => this.hoverInterpolator.setReversedState(true, performance.now()),
			() => this.pressdownInterpolator.setReversedState(false, performance.now()),
			() => this.pressdownInterpolator.setReversedState(true, performance.now())
		);
	}

	enable() {
		if (this.registration) this.registration.enable();
	}

	disable() {
		if (this.registration) this.registration.disable();
	}
}