import { InteractionGroup, InteractionRegistration } from "../../input/interactivity";
import { InterpolatedValueChanger, Interpolator } from "../../util/interpolation";
import { EaseType, MathUtil } from "../../util/math_util";
import { EMPTY_FUNCTION } from "../../util/misc_util";
import { getCurrentMousePosition } from "../../input/input";
import { CustomEventEmitter } from "../../util/custom_event_emitter";
import { Dimensions, colorToHexNumber, lerpColors, Colors, Color } from "../../util/graphics_util";
import { createPolygonTexture } from "../../util/pixi_util";

/** Similar to range slider, but more primitive. Values range only from 0 to 1, and there is no thumb, only a track. */
export class ThumblessSlider extends CustomEventEmitter<{change: number, finish: number}> {
	public container: PIXI.Container;
	public interactionGroup: InteractionGroup;

	private dimensions: Dimensions;
	private slanted: boolean;

	private mask: PIXI.Sprite;
	private background: PIXI.Sprite;
	private slider: PIXI.Sprite;
	private registration: InteractionRegistration;
	private dragging = false;
	private lastScalingFactor: number = 1;

	private valueInterpolator: InterpolatedValueChanger;
	private hoverInterpolator: Interpolator;
	private pressdownInterpolator: Interpolator;

	private baseColor: Color;
	private interactionColor: Color;

	private leftLabel: PIXI.Text;
	private rightLabel: PIXI.Text;

	constructor(dimensions: Dimensions, slanted: boolean, backgroundColor: Color, baseColor: Color, interactionColor: Color) {
		super();

		this.container = new PIXI.Container();
		this.interactionGroup = new InteractionGroup();
		this.dimensions = dimensions;
		this.slanted = slanted;
		this.baseColor = baseColor;
		this.interactionColor = interactionColor;

		this.mask = new PIXI.Sprite();

		this.background = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.background.tint = colorToHexNumber(backgroundColor);
		this.background.alpha = backgroundColor.a ?? 0.8;
		this.background.mask = this.mask;
		
		this.slider = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.slider.mask = this.mask;

		this.leftLabel = new PIXI.Text("", {
			fontFamily: 'Exo2-Regular',
			fill: 0xffffff
		});
		this.rightLabel = new PIXI.Text("", {
			fontFamily: 'Exo2-Regular',
			fill: 0xffffff
		});
		this.leftLabel.alpha = this.rightLabel.alpha = 0.75;

		this.container.addChild(this.mask, this.background, this.slider, this.leftLabel, this.rightLabel);

		this.valueInterpolator = new InterpolatedValueChanger({
			initial: 0,
			duration: 150,
			ease: EaseType.EaseOutCubic
		});
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

		this.registration = new InteractionRegistration(this.background);
		this.interactionGroup.add(this.registration);
		
		this.registration.addButtonHandlers(
			EMPTY_FUNCTION,
			() => this.hoverInterpolator.setReversedState(false, performance.now()),
			() => this.hoverInterpolator.setReversedState(true, performance.now()),
			EMPTY_FUNCTION,
			EMPTY_FUNCTION
		);
		this.registration.makeDraggable(() => {
			this.pressdownInterpolator.setReversedState(false, performance.now());
			updateSliderPosition();
			this.dragging = true;
		}, () => {
			updateSliderPosition();
		}, () => {
			this.pressdownInterpolator.setReversedState(true, performance.now());
			this.emit('finish', this.valueInterpolator.getCurrentGoal());
			this.dragging = false;
		});

		const updateSliderPosition = () => {
			let mousePos = getCurrentMousePosition();
			let bounds = this.background.getBounds();

			let completion = MathUtil.clamp((mousePos.x - bounds.x) / bounds.width, 0, 1);
			this.setCompletion(completion, true, true);
			this.emit('change', completion);
		};
	}

	resize(scalingFactor: number) {
		this.lastScalingFactor = scalingFactor;

		let slantWidth = this.slanted? this.dimensions.height / 5 : 0;
		this.mask.texture = createPolygonTexture(this.dimensions.width + slantWidth, this.dimensions.height, [
			new PIXI.Point(0, 0), new PIXI.Point(this.dimensions.width, 0), new PIXI.Point(this.dimensions.width + slantWidth, this.dimensions.height), new PIXI.Point(slantWidth, this.dimensions.height)
		], scalingFactor, 0, false, 3);

		this.background.width = this.mask.width;
		this.background.height = this.mask.height;
		this.slider.height = this.mask.height;

		this.setLabels(this.leftLabel.text, this.rightLabel.text);
		this.leftLabel.y = this.rightLabel.y = -Math.floor(16 * scalingFactor);
	}

	setLabels(left: string, right: string) {
		this.leftLabel.text = left;
		this.rightLabel.text = right;

		this.leftLabel.style.fontSize = this.rightLabel.style.fontSize = Math.floor(10 * this.lastScalingFactor);

		this.rightLabel.x = this.background.width - this.rightLabel.width;
	}

	update(now: number) {
		let currentValue = this.valueInterpolator.getCurrentValue(now);
		this.slider.width = currentValue * this.mask.width;

		let hoverValue = this.hoverInterpolator.getCurrentValue(now);
		let pressdownValue = this.pressdownInterpolator.getCurrentValue(now);

		this.slider.tint = colorToHexNumber(lerpColors(this.baseColor, this.interactionColor, MathUtil.lerp(MathUtil.lerp(0.0, 0.5, hoverValue), 1.0, pressdownValue)));
	}

	setCompletion(val: number, instantly = false, force = false) {
		if (this.dragging && !force) return;

		if (this.valueInterpolator.getCurrentGoal() !== val) {
			// Smoothly interpolate to the new value
			if (!instantly) this.valueInterpolator.setGoal(val, performance.now());
			else this.valueInterpolator.reset(val);
		}
	}

	mouseInside() {
		return this.registration.mouseInside;
	}
}