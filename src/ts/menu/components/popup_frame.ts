import { InteractionGroup, InteractionRegistration } from "../../input/interactivity";
import { Interpolator } from "../../util/interpolation";
import { EaseType, MathUtil } from "../../util/math_util";
import { KeyCode } from "../../input/input";
import { calculateRatioBasedScalingFactor, Color, colorToHexNumber } from "../../util/graphics_util";
import { currentWindowDimensions, REFERENCE_SCREEN_HEIGHT } from "../../visuals/ui";
import { createPolygonTexture, svgToTexture } from "../../util/pixi_util";
import { EMPTY_FUNCTION } from "../../util/misc_util";
import { Button, DEFAULT_BUTTON_WIDTH, DEFAULT_BUTTON_HEIGHT, ButtonPivot, DEFAULT_BUTTON_MARGIN } from "./button";

const LEFT_MARGIN = 22;
const TOP_MARGIN = 22;
const plusTexture = svgToTexture(document.querySelector('#svg-plus'), true);

export interface PopupFrameOptions {
	width: number,
	height: number,
	headerText: string,
	descriptionText: string,
	enableCloseButton: boolean,
	/** These buttons will be arranged right-to-left. */
	buttons: {
		label: string,
		color: Color,
		onclick: Function
	}[]
}

/** Represents a general popup frame with a black background and buttons whose content can be populated to do anything imaginable. */
export abstract class PopupFrame {
	public container: PIXI.Container;
	public interactionGroup: InteractionGroup;
	public scalingFactor: number = 1.0;
	protected options: PopupFrameOptions;

	protected background: PIXI.Sprite;
	protected backgroundRegistration: InteractionRegistration;
	protected centerContainer: PIXI.Container;
	protected mask: PIXI.Sprite;
	protected centerContainerBackground: PIXI.Sprite;

	/** A button in the top-right corner which closes the thing. */
	protected closeButton: PIXI.Sprite;
	protected header: PIXI.Text;
	/** Goes below the header. */
	protected description: PIXI.Text;
	protected buttons: Button[] = [];

	protected fadeInInterpolator: Interpolator;
	protected closeButtonInterpolator: Interpolator;

	constructor(options: PopupFrameOptions) {
		this.container = new PIXI.Container();
		this.interactionGroup = new InteractionGroup();
		this.options = options;

		this.background = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.background.tint = 0x000000;
		this.background.alpha = 0.8;
		this.container.addChild(this.background);
		let backgroundRegistration = new InteractionRegistration(this.background);
		backgroundRegistration.enableEmptyListeners();
		this.interactionGroup.add(backgroundRegistration);

		backgroundRegistration.addListener('keyDown', (e) => {
			if (e.keyCode === KeyCode.Escape) this.triggerClose();
		});
		this.backgroundRegistration = backgroundRegistration;

		this.centerContainer = new PIXI.Container();
		this.container.addChild(this.centerContainer);

		this.mask = new PIXI.Sprite();
		this.centerContainer.addChild(this.mask);

		this.centerContainerBackground = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.centerContainerBackground.tint = 0x080808;
		this.centerContainerBackground.alpha = 0.95;
		this.centerContainerBackground.mask = this.mask;
		this.centerContainer.addChild(this.centerContainerBackground);

		this.header = new PIXI.Text(this.options.headerText);
		this.header.style = {
			fontFamily: 'Exo2-BoldItalic',
			fill: 0xffffff
		};
		this.centerContainer.addChild(this.header);

		this.description = new PIXI.Text(this.options.descriptionText);
		this.description.style = {
			fontFamily: 'Exo2-RegularItalic',
			fill: 0xffffff,
			wordWrap: true
		};
		this.description.alpha = 0.75;
		this.centerContainer.addChild(this.description);

		this.closeButton = new PIXI.Sprite(plusTexture);
		this.closeButton.rotation = Math.PI/4;
		this.closeButton.anchor.set(0.5, 0.5);
		if (this.options.enableCloseButton) this.centerContainer.addChild(this.closeButton);

		let closeButtonRegistration = new InteractionRegistration(this.closeButton);
		if (!this.options.enableCloseButton) closeButtonRegistration.disable();
		this.interactionGroup.add(closeButtonRegistration);
		closeButtonRegistration.addButtonHandlers(
			() => this.triggerClose(),
			() => this.closeButtonInterpolator.setReversedState(false, performance.now()),
			() => this.closeButtonInterpolator.setReversedState(true, performance.now()),
			EMPTY_FUNCTION,
			EMPTY_FUNCTION
		);

		for (let b of this.options.buttons) {
			let button = new Button(DEFAULT_BUTTON_WIDTH, DEFAULT_BUTTON_HEIGHT, 15, ButtonPivot.TopRight, b.label, colorToHexNumber(b.color));

			this.centerContainer.addChild(button.container);
			button.setupInteraction(this.interactionGroup, () => b.onclick());
			this.buttons.push(button);
		}

		this.fadeInInterpolator = new Interpolator({
			defaultToFinished: true,
			beginReversed: true,
			duration: 400,
			ease: EaseType.EaseOutCubic,
			reverseEase: EaseType.EaseInCubic
		});
		this.closeButtonInterpolator = new Interpolator({
			defaultToFinished: true,
			beginReversed: true,
			duration: 300,
			ease: EaseType.EaseOutCubic,
			reverseEase: EaseType.EaseInCubic
		});
	}

	resize() {
		this.scalingFactor = calculateRatioBasedScalingFactor(currentWindowDimensions.width, currentWindowDimensions.height, 16/9, REFERENCE_SCREEN_HEIGHT);
		let slantWidth = this.options.height/5;

		this.background.width = currentWindowDimensions.width;
		this.background.height = currentWindowDimensions.height;

		this.mask.texture.destroy(true);
		this.mask.texture = createPolygonTexture(this.options.width + slantWidth, this.options.height, [
			new PIXI.Point(0, 0), new PIXI.Point(this.options.width, 0), new PIXI.Point(this.options.width + slantWidth, this.options.height), new PIXI.Point(slantWidth, this.options.height)
		], this.scalingFactor);
		this.centerContainerBackground.width = Math.ceil((this.options.width + slantWidth) * this.scalingFactor);
		this.centerContainerBackground.height = Math.ceil(this.options.height * this.scalingFactor);

		this.centerContainer.y = Math.floor(currentWindowDimensions.height / 2);
		this.centerContainer.pivot.x = Math.floor((this.options.width + slantWidth) * this.scalingFactor / 2);
		this.centerContainer.pivot.y = Math.floor(this.options.height * this.scalingFactor / 2);

		this.header.style.fontSize = Math.floor(22 * this.scalingFactor);
		this.header.y = Math.floor(TOP_MARGIN * this.scalingFactor);

		this.description.style.fontSize = Math.floor(12 * this.scalingFactor);
		this.description.style.wordWrapWidth = this.description.style.fontSize * 28;
		this.description.y = Math.floor((TOP_MARGIN + 35) * this.scalingFactor);

		this.closeButton.width = Math.floor(20 * this.scalingFactor);
		this.closeButton.height = this.closeButton.width;
		this.closeButton.x = Math.floor((this.options.width - 20) * this.scalingFactor);
		this.closeButton.y = Math.floor(20 * this.scalingFactor);

		for (let i = 0; i < this.buttons.length; i++) {
			let button = this.buttons[i];
			button.resize(this.scalingFactor);

			button.container.y = Math.floor((this.options.height + DEFAULT_BUTTON_MARGIN) * this.scalingFactor);
			button.container.x = Math.floor((this.options.width + slantWidth + DEFAULT_BUTTON_MARGIN/5 - i*(DEFAULT_BUTTON_WIDTH + DEFAULT_BUTTON_HEIGHT/10 + DEFAULT_BUTTON_MARGIN)) * this.scalingFactor);
		}
	}

	protected getLeftMargin() {
		return Math.floor((this.options.height/5 + LEFT_MARGIN) * this.scalingFactor);
	}

	update(now: number) {
		let fadeInCompletion = this.fadeInInterpolator.getCurrentValue(now);
		if (fadeInCompletion === 0) {
			this.container.visible = false;
			return false;
		}
		this.container.visible = true;

		this.container.alpha = fadeInCompletion;
		this.centerContainer.x = Math.floor(currentWindowDimensions.width / 2) - 40 * (1 - fadeInCompletion) * this.scalingFactor;

		let headerNudge = -40 * (1 - fadeInCompletion) * this.scalingFactor;
		this.description.x = this.header.x = this.getLeftMargin();
		this.header.x += headerNudge;
		this.description.x += headerNudge * 0.8;

		this.closeButton.alpha = MathUtil.lerp(0.25, 0.75, this.closeButtonInterpolator.getCurrentValue(now));

		for (let b of this.buttons) b.update(now);

		return true
	}

	hide() {
		this.interactionGroup.disable();
		this.fadeInInterpolator.setReversedState(true, performance.now());
	}

	show() {
		this.interactionGroup.enable();
		this.fadeInInterpolator.setReversedState(false, performance.now());
	}

	triggerClose() {
		this.hide();
	}
}