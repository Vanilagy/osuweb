import { InteractionGroup, InteractionRegistration } from "../../input/interactivity";
import { createPolygonBorderTexture, createPolygonTexture } from "../../util/pixi_util";
import { Interpolator } from "../../util/interpolation";
import { EaseType, MathUtil } from "../../util/math_util";
import { EMPTY_FUNCTION } from "../../util/misc_util";
import { colorToHexNumber, lerpColors, Colors } from "../../util/graphics_util";
import { THEME_COLORS } from "../../util/constants";
import { CustomEventEmitter } from "../../util/custom_event_emitter";

const WIDTH = 26;
const HEIGHT = 16;

export class Checkbox extends CustomEventEmitter<{change: boolean}> {
	public container: PIXI.Container;
	public interactionGroup: InteractionGroup;
	private scalingFactor: number;

	private uncheckedElement: PIXI.Sprite; // The border around
	private checkedElement: PIXI.Sprite;

	private hoverInterpolator: Interpolator;
	private pressdownInterpolator: Interpolator;
	private highlightInterpolator: Interpolator;

	private checked: boolean = false;

	constructor() {
		super();

		this.container = new PIXI.Container();
		this.interactionGroup = new InteractionGroup();

		this.uncheckedElement = new PIXI.Sprite();
		this.checkedElement = new PIXI.Sprite();

		this.container.addChild(this.checkedElement, this.uncheckedElement);

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
		this.highlightInterpolator = new Interpolator({
			duration: 300,
			ease: EaseType.EaseOutCubic,
			reverseEase: EaseType.EaseInCubic,
			beginReversed: true,
			defaultToFinished: true
		});

		let registration = new InteractionRegistration(this.container);
		this.interactionGroup.add(registration);
		registration.addButtonHandlers(
			() => this.toggle(),
			() => this.hoverInterpolator.setReversedState(false, performance.now()),
			() => this.hoverInterpolator.setReversedState(true, performance.now()),
			() => this.pressdownInterpolator.setReversedState(false, performance.now()),
			() => this.pressdownInterpolator.setReversedState(true, performance.now())
		);
	}

	resize(scalingFactor: number) {
		this.scalingFactor = scalingFactor;

		let slantWidth = HEIGHT/5;
		let polygon = [new PIXI.Point(0, 0), new PIXI.Point(WIDTH, 0), new PIXI.Point(WIDTH + slantWidth, HEIGHT), new PIXI.Point(slantWidth, HEIGHT)];

		this.uncheckedElement.texture = createPolygonBorderTexture(WIDTH + slantWidth, HEIGHT, polygon, 2, this.scalingFactor, 0, false, 3);
		this.checkedElement.texture = createPolygonTexture(WIDTH + slantWidth, HEIGHT, polygon, this.scalingFactor, 0, false, 3);

		this.uncheckedElement.pivot.set(this.uncheckedElement.width/2, this.uncheckedElement.height/2);
		this.uncheckedElement.position.copyFrom(this.uncheckedElement.pivot);
		this.checkedElement.pivot.copyFrom(this.uncheckedElement.pivot);
		this.checkedElement.position.copyFrom(this.uncheckedElement.pivot);
	}

	update(now: number) {
		let hoverCompletion = this.hoverInterpolator.getCurrentValue(now);
		let pressdownCompletion = this.pressdownInterpolator.getCurrentValue(now);
		
		let tintBrightness = MathUtil.lerp(MathUtil.lerp(0, 0.3, hoverCompletion), 0.8, pressdownCompletion);
		this.uncheckedElement.tint = colorToHexNumber(lerpColors(THEME_COLORS.PrimaryViolet, Colors.White, tintBrightness));
		this.checkedElement.tint = this.uncheckedElement.tint;

		this.checkedElement.alpha = this.highlightInterpolator.getCurrentValue(now);

		this.uncheckedElement.scale.set(MathUtil.lerp(1.0, 1.15, pressdownCompletion));
		this.checkedElement.scale.copyFrom(this.uncheckedElement.scale);
	}

	toggle() {
		this.checked = !this.checked;

		this.highlightInterpolator.setReversedState(!this.checked, performance.now());

		this.emit('change', this.checked);
	}

	setState(state: boolean) {
		if (state === this.checked) return;
		this.toggle();
	}
}