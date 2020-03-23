import { Hud } from "./hud";
import { AnimatedOsuSprite } from "../skin/animated_sprite";
import { InteractionRegistration } from "../../input/interactivity";
import { Interpolator } from "../../util/interpolation";
import { MathUtil, EaseType } from "../../util/math_util";
import { currentWindowDimensions } from "../../visuals/ui";

export const SKIP_BUTTON_MIN_BREAK_LENGTH = 5000;
export const SKIP_BUTTON_END_TIME = 2000;
export const SKIP_BUTTON_FADE_TIME = 333;

export class SkipButton {
	public hud: Hud;
	public container: PIXI.Container;

	private flash: PIXI.Sprite;
	private spriteContainer: PIXI.Container;

	private registration: InteractionRegistration;
	private animator: AnimatedOsuSprite;
	private currentVisibility: number = 0.0;
	private hoverInterpolator: Interpolator;
	private flashInterpolator: Interpolator;

	constructor(hud: Hud) {
		this.hud = hud;
		this.container = new PIXI.Container();

		// Whenever the skip button is triggered, overlay this flash sprite over everything. That'll add to the effect that we've actually *skipped* to somewhere.
		this.flash = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.flash.tint = 0x000000;
		this.spriteContainer = new PIXI.Container();
		this.container.addChild(this.flash, this.spriteContainer);

		this.hoverInterpolator = new Interpolator({
			duration: 125,
			beginReversed: true,
			defaultToFinished: true
		});
		this.flashInterpolator = new Interpolator({
			duration: 350,
			defaultToFinished: true,
			ease: EaseType.EaseOutQuad
		});

		this.registration = new InteractionRegistration(this.spriteContainer);
		this.hud.interactionGroup.add(this.registration);

		this.registration.addListener('mouseEnter', () => {
			this.hoverInterpolator.setReversedState(false, performance.now());
		});
		this.registration.addListener('mouseLeave', () => {
			this.hoverInterpolator.setReversedState(true, performance.now());
		});
		this.registration.addListener('mouseDown', () => this.trigger());
	}

	init() {
		let { skin, screenPixelRatio } = this.hud.controller.currentPlay;

		this.spriteContainer.removeChildren();

		let osuTexture = skin.textures["playSkip"];
		this.animator = new AnimatedOsuSprite(osuTexture, screenPixelRatio);
		this.animator.setFps(skin.config.general.animationFramerate);
		this.animator.play(0);
		
		this.animator.sprite.anchor.set(1.0, 1.0);
		this.spriteContainer.addChild(this.animator.sprite);
	}

	setVisibility(visibility: number) {
		this.currentVisibility = visibility;

		if (visibility === 0) this.registration.disable();
		else this.registration.enable();
	}

	resize() {
		this.spriteContainer.x = currentWindowDimensions.width;
		this.spriteContainer.y = currentWindowDimensions.height;

		this.flash.width = currentWindowDimensions.width;
		this.flash.height = currentWindowDimensions.height;
	}

	update(currentTime: number) {
		this.animator.update(currentTime);

		let hoverCompletion = this.hoverInterpolator.getCurrentValue(performance.now());
		this.spriteContainer.alpha = MathUtil.lerp(0, 0.5 + hoverCompletion * 0.2, this.currentVisibility);

		let flashCompletion = this.flashInterpolator.getCurrentValue(performance.now());
		this.flash.alpha = MathUtil.lerp(0.8, 0, flashCompletion);
	}

	trigger() {
		if (this.currentVisibility === 0) return;

		this.hud.controller.currentPlay.skipBreak();
		this.flashInterpolator.start(performance.now());
	}
}