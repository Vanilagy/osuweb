import { SpriteNumber, USUAL_SCORE_DIGIT_HEIGHT } from "../../visuals/sprite_number";
import { ProgressIndicator } from "./progress_indicator";
import { AccuracyMeter } from "./accuracy_meter";
import { Scorebar } from "./scorebar";
import { SectionStateDisplayer } from "./section_state_displayer";
import { GameplayWarningArrows } from "./gameplay_warning_arrows";
import { currentWindowDimensions, getGlobalScalingFactor } from "../../visuals/ui";
import { GameplayController } from "../gameplay_controller";
import { globalState } from "../../global_state";
import { Interpolator } from "../../util/interpolation";
import { SkipButton } from "./skip_button";
import { InteractionGroup } from "../../input/interactivity";
import { MathUtil, EaseType } from "../../util/math_util";
import { KeyCounter } from "./key_counter";

export enum HudMode {
	Normal,
	Relax,
	Autopilot,
	Cinema
}

export class Hud {
	public controller: GameplayController;
	public container: PIXI.Container;
	public interactionGroup: InteractionGroup;

	public scoreDisplay: SpriteNumber;
	public phantomComboDisplay: SpriteNumber;
	public comboDisplay: SpriteNumber;
	private comboContainer: PIXI.Container;
	public accuracyDisplay: SpriteNumber;
	public progressIndicator: ProgressIndicator;
	public accuracyMeter: AccuracyMeter;
	public scorebar: Scorebar;
	public sectionStateDisplayer: SectionStateDisplayer;
	public gameplayWarningArrows: GameplayWarningArrows;
	public skipButton: SkipButton;
	public keyCounter: KeyCounter;

	private fadeInterpolator: Interpolator;
	private currentBreakiness = 1.0;

	constructor(controller: GameplayController) {
		this.controller = controller;
		this.container = new PIXI.Container();
		this.interactionGroup = new InteractionGroup();

		this.scoreDisplay = new SpriteNumber({
			scaleFactor: 1,
			equalWidthDigits: true,
			verticalAlign: "top",
			horizontalAlign: "right",
			overlapAtEnd: true,
			leftPad: 8
		});
		this.scoreDisplay.setValue(0);
		
		this.accuracyDisplay = new SpriteNumber({
			scaleFactor: 1,
			equalWidthDigits: true,
			verticalAlign: "top",
			horizontalAlign: "right",
			overlapAtEnd: true,
			fixedDecimals: 2,
			hasPercent: true
		});
		this.accuracyDisplay.setValue(100);

		this.phantomComboDisplay = new SpriteNumber({
			scaleFactor: 1,
			verticalAlign: "bottom",
			horizontalAlign: "left",
			hasX: true
		});
		this.phantomComboDisplay.container.alpha = 0.0;
		this.phantomComboDisplay.setValue(0);
	
		this.comboDisplay = new SpriteNumber({
			scaleFactor: 1,
			verticalAlign: "bottom",
			horizontalAlign: "left",
			hasX: true
		});
		this.comboDisplay.setValue(0);

		this.comboContainer = new PIXI.Container();
		this.comboContainer.addChild(this.phantomComboDisplay.container, this.comboDisplay.container);
	
		this.progressIndicator = new ProgressIndicator(0);
		this.accuracyMeter = new AccuracyMeter(this);
		this.scorebar = new Scorebar(this);
		this.sectionStateDisplayer = new SectionStateDisplayer(this);
		this.gameplayWarningArrows = new GameplayWarningArrows(this);
		this.skipButton = new SkipButton(this);
		this.keyCounter = new KeyCounter();

		this.fadeInterpolator = new Interpolator({
			beginReversed: true,
			defaultToFinished: true
		});
	
		this.container.addChild(this.sectionStateDisplayer.container);
		this.container.addChild(this.accuracyMeter.container);
		this.container.addChild(this.scorebar.container);
		this.container.addChild(this.keyCounter.container);
		this.container.addChild(this.gameplayWarningArrows.container);
		this.container.addChild(this.scoreDisplay.container);
		this.container.addChild(this.comboContainer);
		this.container.addChild(this.accuracyDisplay.container);
		this.container.addChild(this.progressIndicator.container);
		this.container.addChild(this.skipButton.container);
	}

	setMode(mode: HudMode) {
		switch (mode) {
			case HudMode.Normal: {
				this.accuracyMeter.container.visible = true;
				this.scorebar.container.visible = true;
				this.keyCounter.container.visible = true;
				this.scoreDisplay.container.visible = true;
				this.comboContainer.visible = true;
				this.accuracyDisplay.container.visible = true;
				this.progressIndicator.container.visible = true;
			}; break;
			case HudMode.Relax: {
				this.accuracyMeter.container.visible = true; // accuracy meter still visible
				this.scorebar.container.visible = false;
				this.keyCounter.container.visible = false;
				this.scoreDisplay.container.visible = false;
				this.comboContainer.visible = false;
				this.accuracyDisplay.container.visible = false;
				this.progressIndicator.container.visible = false;
			}; break;
			case HudMode.Autopilot: {
				this.accuracyMeter.container.visible = true; // accuracy meter still visible
				this.scorebar.container.visible = false;
				this.keyCounter.container.visible = true; // key counter visible since that's kind of a autopilot-y thing
				this.scoreDisplay.container.visible = false;
				this.comboContainer.visible = false;
				this.accuracyDisplay.container.visible = false;
				this.progressIndicator.container.visible = false;
			}; break;
			case HudMode.Cinema: {
				// Hide everything
				this.accuracyMeter.container.visible = false;
				this.scorebar.container.visible = false;
				this.keyCounter.container.visible = false;
				this.scoreDisplay.container.visible = false;
				this.comboContainer.visible = false;
				this.accuracyDisplay.container.visible = false;
				this.progressIndicator.container.visible = false;
			}; break;
		}

		this.sectionStateDisplayer.container.visible = mode !== HudMode.Cinema;
		this.gameplayWarningArrows.container.visible = mode !== HudMode.Cinema;
		this.skipButton.container.visible = mode !== HudMode.Cinema;

		if (!globalState.settings['showKeyOverlay']) this.keyCounter.container.visible = false;
	}

	updateSkin() {
		let skin = this.controller.currentPlay.skin;

		this.scoreDisplay.options.textures = skin.scoreNumberTextures;
		this.scoreDisplay.options.overlap = skin.config.fonts.scoreOverlap;
		this.scoreDisplay.refresh();

		this.accuracyDisplay.options.textures = skin.scoreNumberTextures;
		this.accuracyDisplay.options.overlap = skin.config.fonts.scoreOverlap;
		this.accuracyDisplay.refresh();

		this.phantomComboDisplay.options.textures = skin.comboNumberTextures;
		this.phantomComboDisplay.options.overlap = skin.config.fonts.comboOverlap;
		this.phantomComboDisplay.refresh();

		this.comboDisplay.options.textures = skin.comboNumberTextures;
		this.comboDisplay.options.overlap = skin.config.fonts.comboOverlap;
		this.comboDisplay.refresh();
	}

	// Should be called every time a Play is started
	init() {
		this.updateSkin();
		this.accuracyMeter.init();
		this.scorebar.init();
		this.gameplayWarningArrows.init();

		this.reset();
	}

	reset() {
		this.scoreDisplay.setValue(0);
		this.accuracyDisplay.setValue(100);
		this.phantomComboDisplay.setValue(0);
		this.comboDisplay.setValue(0);
		this.accuracyMeter.reset();
		this.sectionStateDisplayer.reset();
		this.skipButton.init();
		this.keyCounter.reset();
		
		this.currentBreakiness = 1.0;
	}

	resize() {
		let scoreHeight = currentWindowDimensions.height * 0.0575,
		    accuracyHeight = currentWindowDimensions.height * 0.0345,
			comboHeight = currentWindowDimensions.height * 0.0730;		
		
		this.scoreDisplay.setScaleFactor(scoreHeight / USUAL_SCORE_DIGIT_HEIGHT);
		this.scoreDisplay.container.x = Math.floor(currentWindowDimensions.width - scoreHeight * 0.2);
		this.scoreDisplay.container.y = 0;

		this.accuracyDisplay.setScaleFactor(accuracyHeight / USUAL_SCORE_DIGIT_HEIGHT);
		this.accuracyDisplay.container.x = Math.floor(currentWindowDimensions.width - accuracyHeight * 0.37);
		this.accuracyDisplay.container.y = Math.floor(this.scoreDisplay.container.height + currentWindowDimensions.height * 0.0075);

		let lastAccuracyDisplayValue = this.accuracyDisplay.getLastValue();
		this.accuracyDisplay.setValue(100); // Temporarily, so that we can do correct positioning

		this.progressIndicator.changeDiameter(currentWindowDimensions.height * 0.043);
		this.progressIndicator.container.x = Math.floor(this.accuracyDisplay.container.x - this.accuracyDisplay.lastComputedWidth - currentWindowDimensions.height * 0.035 - (globalState.baseSkin.config.fonts.scoreOverlap  * accuracyHeight / USUAL_SCORE_DIGIT_HEIGHT));
		this.progressIndicator.container.y = Math.floor(this.accuracyDisplay.container.y + Math.min(accuracyHeight/2, this.accuracyDisplay.lastComputedHeight/2));

		this.accuracyDisplay.setValue(lastAccuracyDisplayValue); // Set it back

		this.phantomComboDisplay.setScaleFactor(comboHeight / USUAL_SCORE_DIGIT_HEIGHT);
		this.phantomComboDisplay.container.x = Math.floor(currentWindowDimensions.height * 0.005);
		this.phantomComboDisplay.container.y = Math.floor(currentWindowDimensions.height);

		this.comboDisplay.setScaleFactor(comboHeight / USUAL_SCORE_DIGIT_HEIGHT);
		this.comboDisplay.container.x = this.phantomComboDisplay.container.x;
		this.comboDisplay.container.y = this.phantomComboDisplay.container.y;

		this.accuracyMeter.resize();
		this.accuracyMeter.container.x = Math.floor(currentWindowDimensions.width / 2);
		this.accuracyMeter.container.y = currentWindowDimensions.height;

		this.sectionStateDisplayer.resize();
		this.gameplayWarningArrows.init();

		this.skipButton.init();
		this.skipButton.resize();

		this.scorebar.init();

		this.keyCounter.resize();
		this.keyCounter.container.x = currentWindowDimensions.width;
		this.keyCounter.container.y = Math.floor(currentWindowDimensions.height / 2);
	}

	update(now: number) {
		this.container.alpha = this.fadeInterpolator.getCurrentValue(now);

		let breakiness = MathUtil.ease(EaseType.EaseInQuad, this.currentBreakiness);

		this.comboContainer.pivot.x = 50 * getGlobalScalingFactor() * breakiness;
		this.comboContainer.alpha = 1 - breakiness;

		this.scorebar.container.pivot.y = 50 * getGlobalScalingFactor() * breakiness;
		this.scorebar.container.alpha = 1 - breakiness;
	}

	setFade(visible: boolean, duration: number) {
		let now = performance.now();

		this.fadeInterpolator.setReversedState(!visible, now);
		this.fadeInterpolator.setDuration(duration, now);
	}

	setBreakiness(breakiness: number) {
		this.currentBreakiness = breakiness;
	}
}