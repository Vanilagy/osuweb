import { currentWindowDimensions, REFERENCE_SCREEN_HEIGHT } from "../../visuals/ui";
import { InteractionGroup, InteractionRegistration } from "../../input/interactivity";
import { Interpolator } from "../../util/interpolation";
import { EaseType, MathUtil } from "../../util/math_util";
import { colorToHexNumber, lerpColors, Colors } from "../../util/graphics_util";
import { THEME_COLORS, PLAYFIELD_DIMENSIONS } from "../../util/constants";
import { GameplayController } from "../../game/gameplay_controller";
import { Button, ButtonPivot } from "../components/button";
import { Mod } from "../../datamodel/mods";
import { Point, pointDistance } from "../../util/point";
import { GAME_KEYS } from "../../input/gameplay_input_listener";
import { getCurrentMousePosition } from "../../input/input";
import { globalState } from "../../global_state";
import { SkinSoundType } from "../../game/skin/skin";

const BUTTON_WIDTH = 336;
const BUTTON_HEIGHT = 52;
const REQUIRED_CURSOR_ALIGNMENT_PROXIMITY = 20; // In osupixels

export enum PauseScreenMode {
	Paused,
	PausedReplay,
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
	private buttonsGroup: InteractionGroup;

	private cursorAligning = false;
	private cursorAlignmentContainer: PIXI.Container;
	private cursorAlignmentInstruction: PIXI.Text;
	private cursorAlignmentCircle: CursorAlignmentCircle;
	private currentCursorAlignmentPosition: Point;
	private cursorAlignmentRegistration: InteractionRegistration;

	private fadeInterpolator: Interpolator;
	private centerContainerInterpolator: Interpolator;
	private cursorAlignmentInterpolator: Interpolator;

    constructor(controller: GameplayController) {
		this.controller = controller;
		this.container = new PIXI.Container();
		
		this.background = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.background.tint = 0x000000;
		this.container.addChild(this.background);

		this.centerContainer = new PIXI.Container();

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
		backgroundRegistration.setZIndex(-1000);
		backgroundRegistration.enableEmptyListeners();
		this.interactionGroup.add(backgroundRegistration);

		this.buttonsGroup = new InteractionGroup();
		this.interactionGroup.add(this.buttonsGroup);
		this.continueButton.setupInteraction(this.buttonsGroup, () => {
			this.trigger();
		});
		this.retryButton.setupInteraction(this.buttonsGroup, () => {
			this.controller.restart();
		});
		this.quitButton.setupInteraction(this.buttonsGroup, () => {
			this.controller.endPlay();
		});

		this.cursorAlignmentContainer = new PIXI.Container();
		this.cursorAlignmentInstruction = new PIXI.Text("click the circle to resume", {
			fontFamily: "Exo2-Light",
			fill: 0xffffff,
			dropShadow: true,
			dropShadowDistance: 1,
			dropShadowBlur: 0
		});
		this.cursorAlignmentContainer.addChild(this.cursorAlignmentInstruction);
		this.cursorAlignmentCircle = new CursorAlignmentCircle(this);
		this.cursorAlignmentContainer.addChild(this.cursorAlignmentCircle.container);

		this.cursorAlignmentRegistration = new InteractionRegistration(this.container);
		this.cursorAlignmentRegistration.setZIndex(-1);
		this.cursorAlignmentRegistration.allowAllMouseButtons();
		this.interactionGroup.add(this.cursorAlignmentRegistration);
		this.cursorAlignmentRegistration.addListener('mouseDown', (e) => {
			if (e.button === 1) return;
			this.cursorAlignmentCircle.hitTest();
		});
		this.cursorAlignmentRegistration.addListener('keyDown', (e) => {
			if (!GAME_KEYS.includes(e.keyCode)) return;
			this.cursorAlignmentCircle.hitTest();
		});

		this.container.addChild(this.cursorAlignmentContainer);
		this.container.addChild(this.centerContainer);

		this.fadeInterpolator = new Interpolator({
			duration: 220,
			reverseDuration: 100,
			ease: EaseType.EaseOutCubic,
			beginReversed: true,
			defaultToFinished: true
		});
		this.centerContainerInterpolator = new Interpolator({
			duration: 220,
			reverseDuration: 100,
			ease: EaseType.EaseOutCubic,
			beginReversed: true,
			defaultToFinished: true
		});
		this.cursorAlignmentInterpolator = new Interpolator({
			duration: 150,
			beginReversed: true,
			defaultToFinished: true
		});

		this.reset();
	}

	private updateHeadingText(str: string) {
		this.heading.text = str;
		this.heading.pivot.x = Math.floor(this.heading.width / 2);
	}

	private requireCursorAlignment() {
		let play = this.controller.currentPlay;
		return !(this.controller.playbackReplay || play.activeMods.has(Mod.Relax) || play.activeMods.has(Mod.Autopilot) || play.processedBeatmap.isInBreak(play.getCurrentSongTime()));
	}

	trigger() {
		if (this.shown()) {
			if (this.controller.currentPlay.hasFailed()) {
				this.controller.endPlay();
			} else {
				if (this.requireCursorAlignment()) {
					this.toggleCursorAligning();
				} else {
					this.controller.unpause();
				}
			}
		} else {
			if (this.controller.currentPlay.hasFailed()) this.show(PauseScreenMode.Failed);
			else this.controller.pause();
		}
	}

	toggleCursorAligning() {
		this.setCursorAligning(!this.cursorAligning);
	}

	setCursorAligning(state: boolean) {
		this.cursorAligning = state;

		let now = performance.now();

		this.centerContainerInterpolator.setReversedState(this.cursorAligning, now);
		this.cursorAlignmentInterpolator.setReversedState(!this.cursorAligning, now);

		if (this.cursorAligning) {
			this.currentCursorAlignmentPosition = this.controller.inputState.getMousePosition();
			this.cursorAlignmentCircle.pos = this.currentCursorAlignmentPosition;
			this.cursorAlignmentCircle.reset();
			this.positionCursorAlignment();

			this.cursorAlignmentRegistration.enable();
			this.buttonsGroup.disable();
			globalState.baseSkin.sounds[SkinSoundType.PauseLoop].stop();
		} else {
			this.cursorAlignmentRegistration.disable();
			this.buttonsGroup.enable();
			if (this.currentMode === PauseScreenMode.Paused || this.currentMode === PauseScreenMode.PausedReplay) globalState.baseSkin.sounds[SkinSoundType.PauseLoop].start(0);
		}
	}

    show(mode: PauseScreenMode) {
		if (this.interactionGroup.enabled) return;

		this.currentMode = mode;
		if (this.currentMode === PauseScreenMode.Paused || this.currentMode === PauseScreenMode.PausedReplay) {
			this.updateHeadingText('paused');
			this.continueButton.container.visible = true;
			this.continueButton.enable();

			this.retryButton.setLabel((this.currentMode === PauseScreenMode.PausedReplay)? 'restart replay' : 'retry');
		} else if (this.currentMode === PauseScreenMode.Failed) {
			this.updateHeadingText('failed');
			this.continueButton.container.visible = false;
			this.continueButton.disable();

			globalState.baseSkin.sounds[SkinSoundType.FailSound].start(0);
		}

		this.fadeInterpolator.setReversedState(false, performance.now());
		this.setCursorAligning(false);
		this.cursorAlignmentInterpolator.end();

		this.cursorAlignmentRegistration.disable();

		this.interactionGroup.enable();
    }

    hide() {
		let now = performance.now();

		this.fadeInterpolator.setReversedState(true, now);
		this.centerContainerInterpolator.setReversedState(true, now);

		this.interactionGroup.disable();
		this.turnOffSound();
	}

	turnOffSound() {
		globalState.baseSkin.sounds[SkinSoundType.PauseLoop].stop();
		globalState.baseSkin.sounds[SkinSoundType.FailSound].stop();
	}

	shown() {
		return this.interactionGroup.enabled;
	}

	reset() {
		this.hide();

		this.fadeInterpolator.end();
		this.centerContainerInterpolator.end();
		this.cursorAlignmentInterpolator.end();
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

		this.cursorAlignmentInstruction.style.fontSize = Math.floor(45 * this.scalingFactor);
		this.cursorAlignmentInstruction.pivot.x = Math.floor(this.cursorAlignmentInstruction.width / 2);
		this.cursorAlignmentInstruction.pivot.y = Math.floor(this.cursorAlignmentInstruction.height / 2);
		this.cursorAlignmentCircle.resize();
		this.positionCursorAlignment();
	}

	positionCursorAlignment() {
		if (!this.currentCursorAlignmentPosition) return;

		let pointIsTop = this.currentCursorAlignmentPosition.y < PLAYFIELD_DIMENSIONS.height/2;

		this.cursorAlignmentInstruction.x = Math.floor(currentWindowDimensions.width / 2);
		// Position the instruction text on the other side of the point location (so we never occlude it)
		this.cursorAlignmentInstruction.y = Math.floor(currentWindowDimensions.height / 2 + 200 * (pointIsTop? 1 : -1) * this.scalingFactor);

		let screenCoordinates = this.controller.currentPlay.toScreenCoordinates(this.currentCursorAlignmentPosition);
		this.cursorAlignmentCircle.container.position.set(screenCoordinates.x, screenCoordinates.y);
	}

	update(now: number) {
		let scalingFactor = this.scalingFactor;

		let cursorAlignmentCompletion = this.cursorAlignmentInterpolator.getCurrentValue(now);

		let fadeCompletion = this.fadeInterpolator.getCurrentValue(now);
		this.background.alpha = MathUtil.lerp(0.9, 0.35, cursorAlignmentCompletion) * fadeCompletion;
		this.container.alpha = fadeCompletion;
		this.container.visible = this.container.alpha !== 0;

		if (!this.container.visible) return;

		let centerContainerCompletion = this.centerContainerInterpolator.getCurrentValue(now);
		this.centerContainer.alpha = centerContainerCompletion;

		this.heading.x = -7 * (1 - centerContainerCompletion) * scalingFactor;
		if (centerContainerCompletion === 1) this.heading.x = Math.floor(this.heading.x);

		for (let i = 0; i < this.buttons.length; i++) {
			let button = this.buttons[i];

			button.update(now);
			button.container.y = (-32 + 80 * i - MathUtil.lerp(10 + 15*i, 0, centerContainerCompletion)) * scalingFactor;
			if (centerContainerCompletion === 1) button.container.y = Math.floor(button.container.y);
		}

		this.cursorAlignmentContainer.alpha = cursorAlignmentCompletion;
		if (cursorAlignmentCompletion > 0) this.cursorAlignmentCircle.update(now);
	}
}

class CursorAlignmentCircle {
	public container: PIXI.Container;
	private parent: PauseScreen;
	private graphics: PIXI.Graphics;
	public pos: Point;
	private hoverInterpolator: Interpolator;
	private clickInterpolator: Interpolator;
	private pulseStartTime = 0;

	constructor(parent: PauseScreen) {
		this.parent = parent;
		this.container = new PIXI.Container();

		this.graphics = new PIXI.Graphics();
		this.container.addChild(this.graphics);

		this.hoverInterpolator = new Interpolator({
			duration: 150,
			ease: EaseType.EaseOutCubic,
			reverseEase: EaseType.EaseInCubic,
			reverseDuration: 333,
			beginReversed: true,
			defaultToFinished: true
		});
		this.clickInterpolator = new Interpolator({
			duration: 100,
			ease: EaseType.EaseOutCubic
		});
	}

	resize() { }
	
	private getDistanceToMouse() {
		let osuCoordinates = this.parent.controller.currentPlay.toOsuCoordinates(getCurrentMousePosition());
		let dist = pointDistance(osuCoordinates, this.pos);

		return dist;
	}

	hitTest() {
		if (this.getDistanceToMouse() <= REQUIRED_CURSOR_ALIGNMENT_PROXIMITY) {
			this.parent.controller.unpause();
			this.clickInterpolator.start(performance.now());
		}
	}

	private hoverUpdate() {
		let hits = this.getDistanceToMouse() <= REQUIRED_CURSOR_ALIGNMENT_PROXIMITY;

		if (!hits && !this.hoverInterpolator.isReversed()) this.pulseStartTime = performance.now();
		this.hoverInterpolator.setReversedState(!hits, performance.now());
	}

	reset() {
		this.clickInterpolator.reset();
	}

	update(now: number) {
		this.hoverUpdate();
		let hoverCompletion = this.hoverInterpolator.getCurrentValue(now);

		const lineWidth = MathUtil.lerp(5, 7, hoverCompletion);
		const radius = REQUIRED_CURSOR_ALIGNMENT_PROXIMITY + lineWidth/2

		let pulseFactor = 1 + Math.sin((now - this.pulseStartTime) / 100 + Math.PI/2) * 0.05;
		let scalar = MathUtil.lerp(pulseFactor, 1.0, hoverCompletion) * MathUtil.lerp(0.85, 1.0, hoverCompletion) * this.parent.scalingFactor;
		let color = lerpColors(THEME_COLORS.PrimaryYellow, Colors.White, hoverCompletion);

		let proximityScalar = MathUtil.lerp(0.95, 1.0, MathUtil.clamp(1 - this.getDistanceToMouse() / REQUIRED_CURSOR_ALIGNMENT_PROXIMITY, 0, 1));

		let clickCompletion = this.clickInterpolator.getCurrentValue(now);
		let clickScalar = MathUtil.lerp(1, 1.25, clickCompletion);
		this.container.alpha = 1 - clickCompletion;

		this.graphics.clear();
		this.graphics.beginFill(0x000000, 0.0); // transparent
		this.graphics.lineStyle(lineWidth * scalar, colorToHexNumber(color));
		this.graphics.drawCircle(0, 0, radius * scalar * proximityScalar * clickScalar);

		this.graphics.lineStyle(1.5 * scalar, colorToHexNumber(color));
		this.graphics.drawCircle(0, 0, (radius + lineWidth/2) * this.parent.scalingFactor * proximityScalar * clickScalar);

		this.graphics.endFill();
	}
}