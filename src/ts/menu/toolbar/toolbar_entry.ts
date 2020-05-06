import { Toolbar, TOOLBAR_HEIGHT } from "./toolbar";
import { Interpolator } from "../../util/interpolation";
import { EaseType, MathUtil } from "../../util/math_util";
import { InteractionGroup, InteractionRegistration } from "../../input/interactivity";

export class ToolbarEntry {
	public container: PIXI.Container;
	public parent: Toolbar;
	public interactionGroup: InteractionGroup;

	/** The container that contains the actual toolbar entry, and not some auxiliary popup/window that was opened from this entry. */
	public entryContainer: PIXI.Container;
	
	protected registration: InteractionRegistration;
	protected background: PIXI.Sprite;
	protected hoverInterpolator: Interpolator;
	protected pressdownInterpolator: Interpolator;

	constructor(parent: Toolbar) {
		this.parent = parent;
		this.container = new PIXI.Container();
		this.entryContainer = new PIXI.Container();
		this.container.addChild(this.entryContainer);

		this.background = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.entryContainer.addChild(this.background);

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

		this.interactionGroup = new InteractionGroup();
		this.registration = new InteractionRegistration(this.entryContainer);
		this.registration.addButtonHandlers(
			() => this.onClick(),
			() => this.hoverInterpolator.setReversedState(false, performance.now()),
			() => this.hoverInterpolator.setReversedState(true, performance.now()),
			() => this.pressdownInterpolator.setReversedState(false, performance.now()),
			() => this.pressdownInterpolator.setReversedState(true, performance.now())
		);
		this.interactionGroup.add(this.registration);

		this.parent.interactionGroup.add(this.interactionGroup);
	}

	onClick() {}

	resize() {
		this.background.height = Math.floor(TOOLBAR_HEIGHT * this.parent.scalingFactor);
		this.background.width = Math.floor(TOOLBAR_HEIGHT * 1.5 * this.parent.scalingFactor);
	}

	update(now: number) {
		let hoverCompletion = this.hoverInterpolator.getCurrentValue(now);
		let pressdownCompletion = this.pressdownInterpolator.getCurrentValue(now);

		let backgroundAlpha = MathUtil.lerp(MathUtil.lerp(0, 0.10, hoverCompletion), 0.15, pressdownCompletion);
		this.background.alpha = backgroundAlpha;
	}
}