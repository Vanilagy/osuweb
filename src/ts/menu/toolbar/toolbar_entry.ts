import { Toolbar, TOOLBAR_HEIGHT } from "./toolbar";
import { Interpolator } from "../../util/interpolation";
import { EaseType, MathUtil } from "../../util/math_util";
import { InteractionGroup, InteractionRegistration } from "../../input/interactivity";
import { EMPTY_FUNCTION } from "../../util/misc_util";

export class ToolbarEntry {
	public container: PIXI.Container;
	public parent: Toolbar;
	
	protected registration: InteractionRegistration;
	protected background: PIXI.Sprite;
	protected hoverInterpolator: Interpolator;

	constructor(parent: Toolbar) {
		this.parent = parent;
		this.container = new PIXI.Container();

		this.background = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.container.addChild(this.background);

		this.hoverInterpolator = new Interpolator({
			duration: 150,
			ease: EaseType.EaseOutCubic,
			reverseEase: EaseType.EaseInCubic,
			reverseDuration: 400,
			beginReversed: true,
			defaultToFinished: true
		});

		this.registration = new InteractionRegistration(this.container);
		this.registration.addButtonHandlers(
			EMPTY_FUNCTION,
			() => this.hoverInterpolator.setReversedState(false, performance.now()),
			() => this.hoverInterpolator.setReversedState(true, performance.now()),
			EMPTY_FUNCTION,
			EMPTY_FUNCTION
		);
		this.parent.interactionGroup.add(this.registration);
	}

	resize() {
		this.background.height = Math.floor(TOOLBAR_HEIGHT * this.parent.scalingFactor);
		this.background.width = Math.floor(TOOLBAR_HEIGHT * 1.5 * this.parent.scalingFactor);
	}

	update(now: number) {
		let hoverCompletion = this.hoverInterpolator.getCurrentValue(now);

		this.background.alpha = MathUtil.lerp(0, 0.15, hoverCompletion);
	}
}