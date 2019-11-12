import { hudContainer } from "../../visuals/rendering";
import { SpriteNumber, USUAL_SCORE_DIGIT_HEIGHT } from "../../visuals/sprite_number";
import { baseSkin } from "../skin/skin";
import { ProgressIndicator } from "./progress_indicator";
import { AccuracyMeter } from "./accuracy_meter";
import { Scorebar } from "./scorebar";
import { SectionStateDisplayer } from "./section_state_displayer";
import { GameplayWarningArrows } from "./gameplay_warning_arrows";

export let scoreDisplay: SpriteNumber;
export let phantomComboDisplay: SpriteNumber;
export let comboDisplay: SpriteNumber;
export let accuracyDisplay: SpriteNumber;
export let progressIndicator: ProgressIndicator;
export let accuracyMeter: AccuracyMeter;
export let scorebar: Scorebar;
export let sectionStateDisplayer: SectionStateDisplayer;
export let gameplayWarningArrows: GameplayWarningArrows;

export function initHud() {
    let scoreHeight = window.innerHeight * 0.0575,
        accuracyHeight = window.innerHeight * 0.0345,
        comboHeight = window.innerHeight * 0.0730;

    scoreDisplay = new SpriteNumber({
        scaleFactor: scoreHeight / USUAL_SCORE_DIGIT_HEIGHT,
        equalWidthDigits: true,
        verticalAlign: "top",
        horizontalAlign: "right",
        overlap: baseSkin.config.fonts.scoreOverlap,
        overlapAtEnd: true,
        textures: baseSkin.scoreNumberTextures,
        leftPad: 8
    });
    scoreDisplay.container.x = Math.floor(window.innerWidth - scoreHeight * 0.2);
    scoreDisplay.container.y = 0;
    scoreDisplay.setValue(0);

    accuracyDisplay = new SpriteNumber({
        scaleFactor: accuracyHeight / USUAL_SCORE_DIGIT_HEIGHT,
        equalWidthDigits: true,
        verticalAlign: "top",
        horizontalAlign: "right",
        overlap: baseSkin.config.fonts.scoreOverlap,
        overlapAtEnd: true,
        textures: baseSkin.scoreNumberTextures,
        fixedDecimals: 2,
        hasPercent: true
    });
    accuracyDisplay.setValue(100);
    accuracyDisplay.container.x = Math.floor(window.innerWidth - accuracyHeight * 0.37);
    accuracyDisplay.container.y = Math.floor(scoreDisplay.container.height + window.innerHeight * 0.0075);

    progressIndicator = new ProgressIndicator(window.innerHeight * 0.043);
    progressIndicator.container.x = Math.floor(accuracyDisplay.container.x - accuracyDisplay.lastComputedWidth - window.innerHeight * 0.035 - (baseSkin.config.fonts.scoreOverlap  * accuracyHeight / USUAL_SCORE_DIGIT_HEIGHT));
    progressIndicator.container.y = Math.floor(accuracyDisplay.container.y + Math.min(accuracyHeight/2, accuracyDisplay.lastComputedHeight/2));

    phantomComboDisplay = new SpriteNumber({
        scaleFactor: comboHeight / USUAL_SCORE_DIGIT_HEIGHT,
        verticalAlign: "bottom",
        horizontalAlign: "left",
        overlap: baseSkin.config.fonts.comboOverlap,
        textures: baseSkin.scoreNumberTextures,
        hasX: true
    });
    phantomComboDisplay.container.x = Math.floor(window.innerHeight * 0.005);
    phantomComboDisplay.container.y = Math.floor(window.innerHeight);
    phantomComboDisplay.container.alpha = 0.333;
    phantomComboDisplay.setValue(0);

    comboDisplay = new SpriteNumber({
        scaleFactor: comboHeight / USUAL_SCORE_DIGIT_HEIGHT,
        verticalAlign: "bottom",
        horizontalAlign: "left",
        overlap: baseSkin.config.fonts.comboOverlap,
        textures: baseSkin.scoreNumberTextures,
        hasX: true
    });
    comboDisplay.container.x = phantomComboDisplay.container.x;
    comboDisplay.container.y = phantomComboDisplay.container.y;
    comboDisplay.setValue(0);

    accuracyMeter = new AccuracyMeter();
    accuracyMeter.container.x = window.innerWidth / 2;
    accuracyMeter.container.y = window.innerHeight;

    scorebar = new Scorebar();

    sectionStateDisplayer = new SectionStateDisplayer();

    gameplayWarningArrows = new GameplayWarningArrows();

    hudContainer.addChild(sectionStateDisplayer.container);
    hudContainer.addChild(scorebar.container);
    hudContainer.addChild(gameplayWarningArrows.container);
    hudContainer.addChild(accuracyMeter.container);
    hudContainer.addChild(scoreDisplay.container);
    hudContainer.addChild(phantomComboDisplay.container);
    hudContainer.addChild(comboDisplay.container);
    hudContainer.addChild(accuracyDisplay.container);
    hudContainer.addChild(progressIndicator.container);
}