import { ProcessedBeatmap } from "./processed_beatmap";
import { MathUtil, EaseType } from "../util/math_util";
import { scoreDisplay, comboDisplay, accuracyDisplay } from "./hud";
import { padNumberWithZeroes, toPercentageString, assert } from "../util/misc_util";
import { InterpolatedCounter } from "../util/graphics_util";
import { gameState } from "./game_state";
import { Point } from "../util/point";
import { scorePopupContainer } from "../visuals/rendering";
import { DrawableHitObject } from "./drawable_hit_object";

const SCORE_POPUP_APPEARANCE_TIME = 100; // Both in ms
const SCORE_POPUP_FADE_OUT_TIME = 1000;

export enum ScoringValue {
    NotHit = null, // Maybe rename this. Because logically, not hit = missed. But I mean like "Not hit yet" or "Has not tried to hit"
    Hit300 = 300,
    Hit100 = 100,
    Hit50 = 50,
    Miss = 0,
    SliderHead = 30,
    SliderTick = 10,
    SliderRepeat = 30,
    SliderEnd = 30
}

export class Score {
    public points: number;
    public accuracy: number;
    public hits300: number;
    public hits100: number;
    public hits50: number;
    public misses: number;
    public maxCombo: number;

    constructor() {
        this.points = 0;
        this.accuracy = 1;

        this.hits300 = 0;
        this.hits100 = 0;
        this.hits50 = 0;
        this.misses = 0;
        this.maxCombo = 0;
    }
}

export class ScoreCounter {
    public processedBeatmap: ProcessedBeatmap;    
    public score: Score;

    public currentCombo: number;
    private isGeki: boolean;
    private isKatu: boolean;

    private totalNumberOfHits: number;
    private totalValueOfHits: number;
    private difficultyMultiplier: number;
    private modMultiplier: number;

    constructor(processedBeatmap: ProcessedBeatmap) {
        this.processedBeatmap = processedBeatmap;
        this.score = new Score();

        this.currentCombo = 0;
        // These are used to calculate accuracy:
        this.totalNumberOfHits = 0;
        this.totalValueOfHits = 0;

        this.difficultyMultiplier = this.processedBeatmap.beatmap.calculateDifficultyMultiplier();
        this.modMultiplier = 1;

        this.resetGekiAndKatu();
    }

    // A raw amount of zero means miss
    add(rawAmount: number, raw: boolean = false, affectCombo: boolean = true, affectAccuracy: boolean = true, hitObject: DrawableHitObject, time: number) {
        if (affectAccuracy) {
            this.totalNumberOfHits++;
            this.totalValueOfHits += rawAmount;
        }        

        let gain = rawAmount;
        if (!raw) gain *= 1 + MathUtil.clamp(this.currentCombo - 1, 0, Infinity) * this.difficultyMultiplier * this.modMultiplier / 25;
        gain = Math.floor(gain);

        this.score.points += gain;

        if (affectCombo) {
            if (rawAmount === 0) { // Meaning miss
                this.break();
            } else {
                this.currentCombo++;
                if (this.currentCombo > this.score.maxCombo) this.score.maxCombo = this.currentCombo;
            }
        }

        scoreInterpolator.setGoal(this.score.points);
        accuracyInterpolator.setGoal(this.calculateAccuracy());

        if (!raw) {
            let comboInfo = hitObject.comboInfo;

            if (rawAmount !== ScoringValue.Hit300) {
                this.isGeki = false;

                if (rawAmount !== ScoringValue.Hit100) {
                    this.isKatu = false;
                }
            }

            let scorePopupType: ScorePopupType;
            if (comboInfo.isLast) {
                if (this.isGeki) scorePopupType = ScorePopupType.Geki;
                else if (this.isKatu) {
                    if (rawAmount === ScoringValue.Hit300) scorePopupType = ScorePopupType.Katu300;
                    else scorePopupType = ScorePopupType.Katu100;
                }

                this.resetGekiAndKatu();
            }

            if (scorePopupType === undefined)
                scorePopupType = hitRatingToScorePopupType.get(rawAmount);
            
            assert(scorePopupType);
            
            let popup = new ScorePopup(scorePopupType, hitObject.endPoint, time);
            gameState.currentPlay.addScorePopup(popup);
        }
    }

    break() {
        this.currentCombo = 0;

        // And do the other things
    }

    resetGekiAndKatu() {
        this.isGeki = true;
        this.isKatu = true;
    }

    calculateAccuracy() {
        if (this.totalNumberOfHits === 0) return 1; // 100.00% acc by default
        return this.totalValueOfHits / (this.totalNumberOfHits * 300);
    }

    updateDisplay() {
        scoreDisplay.text = padNumberWithZeroes(Math.floor(scoreInterpolator.getCurrentValue()), 8);
        comboDisplay.text = String(this.currentCombo) + "x";
        accuracyDisplay.text = toPercentageString(accuracyInterpolator.getCurrentValue(), 2);
    }
}


let scoreInterpolator = new InterpolatedCounter({
    initial: 0,
    duration: (distanceToGoal: number) => {
        // Quick animation for small score increases, like slider ticks
        if (distanceToGoal < 300) return 120;
        return 500;
    },
    ease: EaseType.EaseOutCubic
});

let accuracyInterpolator = new InterpolatedCounter({
    initial: 1,
    duration: 200,
    ease: EaseType.EaseOutQuad
});

enum ScorePopupType {
    Hit300 = "300",
    Hit100 = "100",
    Hit50 = "50",
    Miss = "X",
    // ...and UTF-8 introduces itself:
    Geki = "激", // Only 300s in the combo
    Katu300 = "喝", // Only 100s or higher in the combo, but at least one 100 - last hit was 300
    Katu100 = "喝" // Only 100s or higher in the combo, but at least one 100 - last hit was 100
}

let hitRatingToScorePopupType = new Map<number, ScorePopupType>();
hitRatingToScorePopupType.set(ScoringValue.Hit300, ScorePopupType.Hit300);
hitRatingToScorePopupType.set(ScoringValue.Hit100, ScorePopupType.Hit100);
hitRatingToScorePopupType.set(ScoringValue.Hit50, ScorePopupType.Hit50);
hitRatingToScorePopupType.set(ScoringValue.Miss, ScorePopupType.Miss);

let scorePopupTypeColors = new Map<ScorePopupType, string>();
scorePopupTypeColors.set(ScorePopupType.Hit300, '#38b8e8');
scorePopupTypeColors.set(ScorePopupType.Hit100, '#57e11a');
scorePopupTypeColors.set(ScorePopupType.Hit50, '#d6ac52');
scorePopupTypeColors.set(ScorePopupType.Miss, '#ff0000');
scorePopupTypeColors.set(ScorePopupType.Geki, '#38b8e8'); // Same color as Hit300
scorePopupTypeColors.set(ScorePopupType.Katu300, '#38b8e8'); // Same color as Hit300 and Geki
scorePopupTypeColors.set(ScorePopupType.Katu100, '#57e11a'); // Same color as Hit100

export class ScorePopup {
    public container: PIXI.Container;
    private startTime: number = null;
    public renderingFinished: boolean = false;

    constructor(type: ScorePopupType, osuPosition: Point, startTime: number) {
        this.startTime = startTime;

        let currentPlay = gameState.currentPlay;
        let { pixelRatio } = currentPlay;

        let popup = new PIXI.Text(type, {
            fontFamily: "Nunito",
            fontSize: 28 * pixelRatio,
            fill: scorePopupTypeColors.get(type)
        });

        popup.pivot.x = popup.width / 2;
        popup.pivot.y = popup.height / 2;
        popup.x = currentPlay.toScreenCoordinatesX(osuPosition.x);
        popup.y = currentPlay.toScreenCoordinatesY(osuPosition.y);

        this.container = popup;
    }

    update(currentTime: number) {
        if (currentTime >= this.startTime + SCORE_POPUP_FADE_OUT_TIME) {
            this.renderingFinished = true;
            return;
        }

        let appearanceCompletion = (currentTime - this.startTime) / SCORE_POPUP_APPEARANCE_TIME;
        appearanceCompletion = MathUtil.clamp(appearanceCompletion, 0, 1);
        // Same as 'em slider ticks
        //let parabola = (-2.381 * appearanceCompletion * appearanceCompletion + 3.381 * appearanceCompletion);
        appearanceCompletion = MathUtil.ease(EaseType.EaseOutCubic, appearanceCompletion);

        let gradualScaleUp = (currentTime - this.startTime) / SCORE_POPUP_FADE_OUT_TIME;

        let fadeOutCompletion = (currentTime - this.startTime) / SCORE_POPUP_FADE_OUT_TIME;
        fadeOutCompletion = MathUtil.clamp(fadeOutCompletion, 0, 1);
        fadeOutCompletion = MathUtil.ease(EaseType.EaseInQuad, fadeOutCompletion);

        // At the end of the fade out, the thing should be at 1.125x the start size.
        this.container.scale.x = appearanceCompletion + gradualScaleUp * 0.125;
        this.container.scale.y = appearanceCompletion + gradualScaleUp * 0.125;
        this.container.alpha = 1 - fadeOutCompletion;
    }

    remove() {
        scorePopupContainer.removeChild(this.container);
    }
}