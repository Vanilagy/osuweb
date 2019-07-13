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
const HIDE_300s = false; // Enable this if 300 popups get too annoying

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
    public geki: number; // Now, some smartass out there is gonna argue that it should be "gekis" and "katus". I'mma be the bigger smartass here and argue that, since these are Japanese words and Japanese does not have plural, these are correct.
    public katu: number;
    public maxCombo: number;

    constructor() {
        this.points = 0;
        this.accuracy = 1;

        this.hits300 = 0;
        this.hits100 = 0;
        this.hits50 = 0;
        this.misses = 0;
        this.geki = 0;
        this.katu = 0;
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

    /**
     * 
     * @param raw Determines if the amount should be added to the score in its raw form, ignoring any multipliers. If this is false, it additionally creates a score popup.
     */
    add(rawAmount: number, raw: boolean, affectCombo: boolean, affectAccuracy: boolean, hitObject: DrawableHitObject, time: number) {
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
        this.score.accuracy = this.calculateAccuracy();
        accuracyInterpolator.setGoal(this.score.accuracy);

        if (!raw) {
            if (rawAmount === ScoringValue.Hit300) this.score.hits300++;
            else if (rawAmount === ScoringValue.Hit100) this.score.hits100++;
            else if (rawAmount === ScoringValue.Hit50) this.score.hits50++;
            else this.score.misses++;

            if (rawAmount !== ScoringValue.Hit300) {
                this.isGeki = false;

                if (rawAmount !== ScoringValue.Hit100) {
                    this.isKatu = false;
                }
            }

            let scorePopupType: ScorePopupType;
            if (hitObject.comboInfo.isLast) {
                if (this.isGeki) {
                    this.score.geki++;

                    scorePopupType = ScorePopupType.Geki;
                }
                else if (this.isKatu) {
                    this.score.katu++;

                    if (rawAmount === ScoringValue.Hit300) scorePopupType = ScorePopupType.Katu300;
                    else scorePopupType = ScorePopupType.Katu100;
                }

                this.resetGekiAndKatu();
            }

            if (scorePopupType === undefined)
                scorePopupType = hitJudgementToScorePopupType.get(rawAmount);
            
            assert(scorePopupType !== undefined);
            
            let popup = new ScorePopup(scorePopupType, hitObject.endPoint, time);
            gameState.currentPlay.addScorePopup(popup);
        }
    }

    break() {
        this.currentCombo = 0;

        // ...and do the other things.
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
    Hit300,
    Hit100,
    Hit50,
    Miss,
    Geki, // Only 300s in the combo
    Katu300, // Only 100s or higher in the combo, but at least one 100 - last hit was 300
    Katu100 // Only 100s or higher in the combo, but at least one 100 - last hit was 100
}

let hitJudgementToScorePopupType = new Map<number, ScorePopupType>();
hitJudgementToScorePopupType.set(ScoringValue.Hit300, ScorePopupType.Hit300);
hitJudgementToScorePopupType.set(ScoringValue.Hit100, ScorePopupType.Hit100);
hitJudgementToScorePopupType.set(ScoringValue.Hit50, ScorePopupType.Hit50);
hitJudgementToScorePopupType.set(ScoringValue.Miss, ScorePopupType.Miss);

let scorePopupTypeToString = new Map<ScorePopupType, string>();
scorePopupTypeToString.set(ScorePopupType.Hit300, '300');
scorePopupTypeToString.set(ScorePopupType.Hit100, '100');
scorePopupTypeToString.set(ScorePopupType.Hit50, '50');
scorePopupTypeToString.set(ScorePopupType.Miss, 'X');
// ...and UTF-8 introduces itself:
scorePopupTypeToString.set(ScorePopupType.Geki, '激');
scorePopupTypeToString.set(ScorePopupType.Katu300, '喝');
scorePopupTypeToString.set(ScorePopupType.Katu100, '喝');

let scorePopupTypeToColor = new Map<ScorePopupType, string>();
scorePopupTypeToColor.set(ScorePopupType.Hit300, '#38b8e8');
scorePopupTypeToColor.set(ScorePopupType.Hit100, '#57e11a');
scorePopupTypeToColor.set(ScorePopupType.Hit50, '#d6ac52');
scorePopupTypeToColor.set(ScorePopupType.Miss, '#ff0000');
scorePopupTypeToColor.set(ScorePopupType.Geki, '#38b8e8'); // Same color as Hit300
scorePopupTypeToColor.set(ScorePopupType.Katu300, '#38b8e8'); // Same color as Hit300 and Geki
scorePopupTypeToColor.set(ScorePopupType.Katu100, '#57e11a'); // Same color as Hit100

export class ScorePopup {
    public container: PIXI.Container;
    private startTime: number = null;
    public renderingFinished: boolean = false;

    constructor(type: ScorePopupType, osuPosition: Point, startTime: number) {
        this.startTime = startTime;

        let currentPlay = gameState.currentPlay;
        let { pixelRatio } = currentPlay;

        let popup = new PIXI.Text(scorePopupTypeToString.get(type), {
            fontFamily: "Nunito",
            fontSize: 28 * pixelRatio,
            fill: scorePopupTypeToColor.get(type)
        });

        popup.pivot.x = popup.width / 2;
        popup.pivot.y = popup.height / 2;
        popup.x = currentPlay.toScreenCoordinatesX(osuPosition.x);
        popup.y = currentPlay.toScreenCoordinatesY(osuPosition.y);

        if (HIDE_300s && (
            type === ScorePopupType.Hit300 ||
            type === ScorePopupType.Geki ||
            type === ScorePopupType.Katu300
        )) popup.visible = false;

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