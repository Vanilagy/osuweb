import { SpriteNumber, USUAL_SCORE_DIGIT_HEIGHT } from "../../visuals/sprite_number";
import { baseSkin } from "../skin/skin";
import { ProgressIndicator } from "./progress_indicator";
import { AccuracyMeter } from "./accuracy_meter";
import { Scorebar } from "./scorebar";
import { SectionStateDisplayer } from "./section_state_displayer";
import { GameplayWarningArrows } from "./gameplay_warning_arrows";
import { currentWindowDimensions } from "../../visuals/ui";
import { PauseScreen } from "./pause_screen";

export class Hud {
	public container: PIXI.Container;

	public scoreDisplay: SpriteNumber;
	public phantomComboDisplay: SpriteNumber;
	public comboDisplay: SpriteNumber;
	public accuracyDisplay: SpriteNumber;
	public progressIndicator: ProgressIndicator;
	public accuracyMeter: AccuracyMeter;
	public scorebar: Scorebar;
	public sectionStateDisplayer: SectionStateDisplayer;
	public gameplayWarningArrows: GameplayWarningArrows;
	public pauseScreen: PauseScreen; // NO this is NOT hud! temp

	constructor() {
		this.container = new PIXI.Container();

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
	
		this.accuracyMeter = new AccuracyMeter();
		this.scorebar = new Scorebar();
		this.sectionStateDisplayer = new SectionStateDisplayer();
		this.gameplayWarningArrows = new GameplayWarningArrows();
		this.pauseScreen = new PauseScreen();
	
		this.container.addChild(this.sectionStateDisplayer.container);
		this.container.addChild(this.scorebar.container);
		this.container.addChild(this.gameplayWarningArrows.container);
		this.container.addChild(this.accuracyMeter.container);
		this.container.addChild(this.scoreDisplay.container);
		this.container.addChild(this.phantomComboDisplay.container);
		this.container.addChild(this.comboDisplay.container);
		this.container.addChild(this.accuracyDisplay.container);
		this.container.addChild(this.progressIndicator.container);
		this.container.addChild(this.pauseScreen.container);
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

		this.progressIndicator.changeDiameter(currentWindowDimensions.height * 0.043);
		this.progressIndicator.container.x = Math.floor(this.accuracyDisplay.container.x - this.accuracyDisplay.lastComputedWidth - currentWindowDimensions.height * 0.035 - (baseSkin.config.fonts.scoreOverlap  * accuracyHeight / USUAL_SCORE_DIGIT_HEIGHT));
		this.progressIndicator.container.y = Math.floor(this.accuracyDisplay.container.y + Math.min(accuracyHeight/2, this.accuracyDisplay.lastComputedHeight/2));

		this.phantomComboDisplay.setScaleFactor(comboHeight / USUAL_SCORE_DIGIT_HEIGHT);
		this.phantomComboDisplay.container.x = Math.floor(currentWindowDimensions.height * 0.005);
		this.phantomComboDisplay.container.y = Math.floor(currentWindowDimensions.height);

		this.comboDisplay.setScaleFactor(comboHeight / USUAL_SCORE_DIGIT_HEIGHT);
		this.comboDisplay.container.x = this.phantomComboDisplay.container.x;
		this.comboDisplay.container.y = this.phantomComboDisplay.container.y;

		this.accuracyMeter.resize();
		this.accuracyMeter.container.x = currentWindowDimensions.width / 2;
		this.accuracyMeter.container.y = currentWindowDimensions.height;

		this.sectionStateDisplayer.resize();
		this.gameplayWarningArrows.resize();
		this.pauseScreen.resize();
	}
}