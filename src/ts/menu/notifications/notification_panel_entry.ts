import { NotificationPanel, NOTIFICATION_PANEL_WIDTH, NOTIFICATION_PANEL_PADDING, NOTIFICATION_MARGIN } from "./notification_panel";
import { Interpolator } from "../../util/interpolation";
import { colorToHexNumber, Color } from "../../util/graphics_util";
import { THEME_COLORS } from "../../util/constants";
import { EaseType, MathUtil } from "../../util/math_util";
import { svgToTexture } from "../../util/pixi_util";
import { InteractionGroup, InteractionRegistration } from "../../input/interactivity";
import { EMPTY_FUNCTION } from "../../util/misc_util";

export const NOTIFICATION_PADDING = 7;

const plusTexture = svgToTexture(document.querySelector('#svg-plus'), true);

export abstract class NotificationPanelEntry {
	public container: PIXI.Container;
	public interactionGroup: InteractionGroup;
	protected parent: NotificationPanel;
	protected background: PIXI.Sprite;
	protected topHighlight: PIXI.Sprite;
	protected heading: PIXI.Text;
	protected closeButton: PIXI.Sprite;

	private closeButtonInterpolator: Interpolator;
	private fadeInInterpolator: Interpolator;
	/** If this is set to true, then this drawawble should be disposed. */
	public destroyable = false;

	constructor(parent: NotificationPanel, headingText: string, highlightColor: Color, allowManualClose: boolean) {
		this.parent = parent;
		this.container = new PIXI.Container();
		this.interactionGroup = new InteractionGroup();

		this.background = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.background.tint = 0x000000;
		this.background.alpha = 0.8;
		this.container.addChild(this.background);

		this.topHighlight = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.topHighlight.tint = colorToHexNumber(highlightColor);
		this.container.addChild(this.topHighlight);

		this.heading = new PIXI.Text(headingText);
		this.heading.style = {
			fontFamily: "Exo2-Regular",
			fill: 0xffffff
		};
		this.container.addChild(this.heading);

		if (allowManualClose) {
			// Show a close button
			this.closeButton = new PIXI.Sprite(plusTexture);
			this.closeButton.rotation = Math.PI/4;
			this.closeButton.anchor.set(0.5, 0.5);
			this.container.addChild(this.closeButton);

			let closeButtonRegistration = new InteractionRegistration(this.closeButton);
			this.interactionGroup.add(closeButtonRegistration);
			closeButtonRegistration.addButtonHandlers(
				() => this.close(),
				() => this.closeButtonInterpolator.setReversedState(false, performance.now()),
				() => this.closeButtonInterpolator.setReversedState(true, performance.now()),
				EMPTY_FUNCTION,
				EMPTY_FUNCTION
			);

			this.closeButtonInterpolator = new Interpolator({
				defaultToFinished: true,
				beginReversed: true,
				duration: 300,
				ease: EaseType.EaseOutCubic,
				reverseEase: EaseType.EaseInQuint
			});
		}

		this.fadeInInterpolator = new Interpolator({
			duration: 500,
			ease: EaseType.EaseOutElasticHalf,
			reverseEase: EaseType.EaseInCubic
		});
		this.fadeInInterpolator.start(performance.now());
	}

	protected abstract calculateRawHeight(): number;

	resize() {
		let height = this.calculateRawHeight();

		this.background.width = Math.floor((NOTIFICATION_PANEL_WIDTH - NOTIFICATION_PANEL_PADDING*2) * this.parent.scalingFactor);
		this.background.height = Math.floor(height * this.parent.scalingFactor);

		this.topHighlight.width = this.background.width;
		this.topHighlight.height = Math.ceil(1 * this.parent.scalingFactor);

		this.heading.style.fontSize = Math.floor(12 * this.parent.scalingFactor);
		this.heading.x = Math.floor(NOTIFICATION_PADDING * this.parent.scalingFactor);
		this.heading.y = this.topHighlight.height + Math.floor(NOTIFICATION_PADDING * this.parent.scalingFactor);

		if (this.closeButton) {
			let padding = 12 * this.parent.scalingFactor;
			
			this.closeButton.width = Math.floor(12 * this.parent.scalingFactor);
			this.closeButton.height = this.closeButton.width;
			this.closeButton.y = this.topHighlight.height + Math.floor(padding)
			this.closeButton.x = Math.floor(this.background.width - padding);
		}
	}

	update(now: number) {
		let fadeInCompletion = this.fadeInInterpolator.getCurrentValue(now);
		this.container.scale.y = fadeInCompletion;
		this.container.alpha = Math.min(1, fadeInCompletion);

		if (this.closeButton) this.closeButton.alpha = MathUtil.lerp(0.25, 0.75, this.closeButtonInterpolator.getCurrentValue(now));

		if (fadeInCompletion === 0 && this.fadeInInterpolator.isReversed()) {
			this.destroyable = true;
		}
	}

	close() {
		this.fadeInInterpolator.setReversedState(true, performance.now());
		this.fadeInInterpolator.start(performance.now());
		this.interactionGroup.disable();
	}

	getHeight(now: number) {
		return this.container.height;
	}

	getMargin(now: number) {
		return NOTIFICATION_MARGIN * this.parent.scalingFactor * this.fadeInInterpolator.getCurrentValue(now);
	}
}