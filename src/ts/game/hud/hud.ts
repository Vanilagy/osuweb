import { SpriteNumber, USUAL_SCORE_DIGIT_HEIGHT } from "../../visuals/sprite_number";
import { ProgressIndicator } from "./progress_indicator";
import { AccuracyMeter } from "./accuracy_meter";
import { Scorebar } from "./scorebar";
import { SectionStateDisplayer } from "./section_state_displayer";
import { GameplayWarningArrows } from "./gameplay_warning_arrows";
import { currentWindowDimensions } from "../../visuals/ui";
import { PauseScreen } from "../../menu/gameplay/pause_screen";
import { GameplayController } from "../gameplay_controller";
import { globalState } from "../../global_state";
import { Interpolator } from "../../util/interpolation";
import { SkipButton } from "./skip_button";
import { InteractionGroup } from "../../input/interactivity";

export class Hud {
	public controller: GameplayController;
	public container: PIXI.Container;
	public interactionGroup: InteractionGroup;

	public scoreDisplay: SpriteNumber;
	public phantomComboDisplay: SpriteNumber;
	public comboDisplay: SpriteNumber;
	public accuracyDisplay: SpriteNumber;
	public progressIndicator: ProgressIndicator;
	public accuracyMeter: AccuracyMeter;
	public scorebar: Scorebar;
	public sectionStateDisplayer: SectionStateDisplayer;
	public gameplayWarningArrows: GameplayWarningArrows;
	public skipButton: SkipButton;

	private fadeInterpolator: Interpolator;

	constructor(controller: GameplayController) {
		this.controller = controller;
		this.container = new PIXI.Container();
		this.interactionGroup = new InteractionGroup();

		let baseSkin = globalState.baseSkin;

		this.scoreDisplay = new SpriteNumber({
			scaleFactor: 1,
			equalWidthDigits: true,
			verticalAlign: "top",
			horizontalAlign: "right",
			overlap: baseSkin.config.fonts.scoreOverlap,
			overlapAtEnd: true,
			textures: baseSkin.scoreNumberTextures,
			leftPad: 8
		});
		this.scoreDisplay.setValue(0);
		
		this.accuracyDisplay = new SpriteNumber({
			scaleFactor: 1,
			equalWidthDigits: true,
			verticalAlign: "top",
			horizontalAlign: "right",
			overlap: baseSkin.config.fonts.scoreOverlap,
			overlapAtEnd: true,
			textures: baseSkin.scoreNumberTextures,
			fixedDecimals: 2,
			hasPercent: true
		});
		this.accuracyDisplay.setValue(100);
	
		this.progressIndicator = new ProgressIndicator(0);
	
		this.phantomComboDisplay = new SpriteNumber({
			scaleFactor: 1,
			verticalAlign: "bottom",
			horizontalAlign: "left",
			overlap: baseSkin.config.fonts.comboOverlap,
			textures: baseSkin.scoreNumberTextures,
			hasX: true
		});
		this.phantomComboDisplay.container.alpha = 0.333;
		this.phantomComboDisplay.setValue(0);
	
		this.comboDisplay = new SpriteNumber({
			scaleFactor: 1,
			verticalAlign: "bottom",
			horizontalAlign: "left",
			overlap: baseSkin.config.fonts.comboOverlap,
			textures: baseSkin.scoreNumberTextures,
			hasX: true
		});
		
		this.comboDisplay.setValue(0);
	
		this.accuracyMeter = new AccuracyMeter(this);
		this.scorebar = new Scorebar(this);
		this.sectionStateDisplayer = new SectionStateDisplayer(this);
		this.gameplayWarningArrows = new GameplayWarningArrows(this);
		this.skipButton = new SkipButton(this);

		this.fadeInterpolator = new Interpolator({
			beginReversed: true,
			defaultToFinished: true
		});
	
		this.container.addChild(this.sectionStateDisplayer.container);
		this.container.addChild(this.scorebar.container);
		this.container.addChild(this.gameplayWarningArrows.container);
		this.container.addChild(this.accuracyMeter.container);
		this.container.addChild(this.scoreDisplay.container);
		this.container.addChild(this.phantomComboDisplay.container);
		this.container.addChild(this.comboDisplay.container);
		this.container.addChild(this.accuracyDisplay.container);
		this.container.addChild(this.progressIndicator.container);
		this.container.addChild(this.skipButton.container);
	}

	// Should be called every time a Play is started
	init() {
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
		this.gameplayWarningArrows.resize();

		this.skipButton.resize();
	}

	update(now: number) {
		this.container.alpha = this.fadeInterpolator.getCurrentValue(now);
	}

	setFade(visible: boolean, duration: number) {
		let now = performance.now();

		this.fadeInterpolator.setReversedState(!visible, now);
		this.fadeInterpolator.setDuration(duration, now);
	}
}