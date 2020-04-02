import { currentWindowDimensions, REFERENCE_SCREEN_HEIGHT } from "../../visuals/ui";
import { InteractionGroup, InteractionRegistration } from "../../input/interactivity";
import { Interpolator } from "../../util/interpolation";
import { EaseType, MathUtil } from "../../util/math_util";
import { colorToHexNumber } from "../../util/graphics_util";
import { THEME_COLORS } from "../../util/constants";
import { GameplayController } from "../../game/gameplay_controller";
import { Button, ButtonPivot } from "../components/button";
import { KeyCode } from "../../input/input";

const BUTTON_WIDTH = 336;
const BUTTON_HEIGHT = 52;

export enum PauseScreenMode {
	Paused,
	Failed
}

export class PauseScreen {
	public controller: GameplayController;
	public container: PIXI.Container;
	public interactionGroup: InteractionGroup;
	public scalingFactor: number;

	private currentMode: PauseScreenMode = PauseScreenMode.Paused;
	private background: PIXI.Sprite;
	private centerContainer: PIXI.Container;
	private heading: PIXI.Text;
	
	private continueButton: Button;
	private retryButton: Button;
	private quitButton: Button;
	private buttons: Button[];

	private fadeInterpolator: Interpolator;

    constructor(controller: GameplayController) {
		this.controller = controller;
		this.container = new PIXI.Container();
		
		this.background = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.background.tint = 0x000000;
		this.background.alpha = 0.9;
		this.container.addChild(this.background);

		this.centerContainer = new PIXI.Container();
		this.container.addChild(this.centerContainer);

		this.heading = new PIXI.Text("");
		this.heading.style = {
			fontFamily: 'Exo2-Regular',
			fill: 0xffffff,
			dropShadow: true,
			dropShadowDistance: 1,
			dropShadowBlur: 0
		};
		this.centerContainer.addChild(this.heading);

		this.continueButton = new Button(BUTTON_WIDTH, BUTTON_HEIGHT, 17, ButtonPivot.Center, "continue", colorToHexNumber(THEME_COLORS.PrimaryBlue));
		this.retryButton = new Button(BUTTON_WIDTH, BUTTON_HEIGHT, 17, ButtonPivot.Center, "retry", colorToHexNumber(THEME_COLORS.PrimaryYellow));
		this.quitButton = new Button(BUTTON_WIDTH, BUTTON_HEIGHT, 17, ButtonPivot.Center, "quit", colorToHexNumber(THEME_COLORS.PrimaryPink));
		this.buttons = [this.continueButton, this.retryButton, this.quitButton];
		for (let button of this.buttons) this.centerContainer.addChild(button.container);

		this.interactionGroup = new InteractionGroup();
		let backgroundRegistration = new InteractionRegistration(this.background);
		backgroundRegistration.enableEmptyListeners();
		this.interactionGroup.add(backgroundRegistration);
		this.continueButton.setupInteraction(this.interactionGroup, () => {
			this.controller.unpause();
		});
		this.retryButton.setupInteraction(this.interactionGroup, () => {
			this.controller.restart();
		});
		this.quitButton.setupInteraction(this.interactionGroup, () => {
			this.controller.endPlay();
		});

		this.fadeInterpolator = new Interpolator({
			duration: 220,
			reverseDuration: 100,
			ease: EaseType.EaseOutCubic,
			beginReversed: true,
			defaultToFinished: true
		});

		this.reset();
	}

	private updateHeadingText(str: string) {
		this.heading.text = str;
		this.heading.pivot.x = Math.floor(this.heading.width / 2);
	}

    show(mode: PauseScreenMode) {
		if (this.interactionGroup.enabled) return;

		this.currentMode = mode;
		if (this.currentMode === PauseScreenMode.Paused) {
			this.updateHeadingText('paused');
			this.continueButton.container.visible = true;
			this.continueButton.enable();
		} else if (this.currentMode === PauseScreenMode.Failed) {
			this.updateHeadingText('failed');
			this.continueButton.container.visible = false;
			this.continueButton.disable();
		}

		this.fadeInterpolator.setReversedState(false, performance.now());
		this.interactionGroup.enable();
    }

    hide() {
		this.fadeInterpolator.setReversedState(true, performance.now());
		this.interactionGroup.disable();
	}

	shown() {
		return this.interactionGroup.enabled;
	}

	reset() {
		this.hide();
		this.fadeInterpolator.end();
	}
	
	resize() {
		this.scalingFactor = currentWindowDimensions.height / REFERENCE_SCREEN_HEIGHT;

		this.background.width = currentWindowDimensions.width;
		this.background.height = currentWindowDimensions.height;

		this.centerContainer.x = Math.floor(currentWindowDimensions.width / 2);
		this.centerContainer.y = Math.floor(currentWindowDimensions.height / 2);

		this.heading.style.fontSize = Math.floor(36 * this.scalingFactor);
		this.heading.y = Math.floor(-170 * this.scalingFactor);
		this.heading.pivot.x = Math.floor(this.heading.width / 2);

		for (let b of this.buttons) b.resize(this.scalingFactor);
	}

	update(now: number) {
		let scalingFactor = this.scalingFactor;

		let fadeCompletion = this.fadeInterpolator.getCurrentValue(now);
		this.container.alpha = fadeCompletion;
		this.container.visible = this.container.alpha !== 0;

		if (!this.container.visible) return;

		this.heading.x = -7 * (1 - fadeCompletion) * scalingFactor;
		if (fadeCompletion === 1) this.heading.x = Math.floor(this.heading.x);

		for (let i = 0; i < this.buttons.length; i++) {
			let button = this.buttons[i];

			button.update(now);
			button.container.y = (-32 + 80 * i - MathUtil.lerp(10 + 15*i, 0, fadeCompletion)) * scalingFactor;
			if (fadeCompletion === 1) button.container.y = Math.floor(button.container.y);
		}
	}
}