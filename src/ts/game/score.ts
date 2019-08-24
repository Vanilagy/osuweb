import { ProcessedBeatmap } from "./processed_beatmap";
import { MathUtil, EaseType } from "../util/math_util";
import { scoreDisplay, phantomComboDisplay, accuracyDisplay, comboDisplay } from "./hud";
import { padNumberWithZeroes, toPercentageString, assert } from "../util/misc_util";
import { InterpolatedCounter, Interpolator } from "../util/graphics_util";
import { gameState } from "./game_state";
import { Point } from "../util/point";
import { scorePopupContainer } from "../visuals/rendering";
import { DrawableHitObject } from "./drawable_hit_object";
import { DRAWING_MODE, DrawingMode } from "../util/constants";

const SCORE_POPUP_APPEARANCE_TIME = 150; // Both in ms
const SCORE_POPUP_FADE_OUT_TIME = 1000;
const SCORE_POPUP_CS_RATIO = 1;
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

interface DelayedVisualComboIncrease {
    time: number,
    value: number
}

export class ScoreCounter {
    public processedBeatmap: ProcessedBeatmap;
    public delayedVisualComboIncreases: DelayedVisualComboIncrease[]; // For the combo display, which actually shows the change in combo a bit later. Just look at it and you'll know what I'm talking about.
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
    }

    init() {
        this.score = new Score();
        this.delayedVisualComboIncreases = [];

        this.currentCombo = 0;
        // These are used to calculate accuracy:
        this.totalNumberOfHits = 0;
        this.totalValueOfHits = 0;

        this.difficultyMultiplier = this.processedBeatmap.beatmap.difficulty.calculateDifficultyMultiplier();
        this.modMultiplier = 1;

        this.resetGekiAndKatu();

        scoreDisplay.setValue(0);
        accuracyDisplay.setValue(100);
        phantomComboDisplay.setValue(0);
        comboDisplay.setValue(0);
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

        let effectiveCombo = Math.max(0, this.currentCombo - 1);

        let gain = rawAmount;
        if (!raw) gain = rawAmount + (rawAmount * ((effectiveCombo * this.difficultyMultiplier * this.modMultiplier) / 25));
        gain = Math.round(gain); // TODO: round or floor, here?

        this.score.points += gain;

        if (affectCombo) {
            if (rawAmount === 0) { // Meaning miss
                this.break(time);
            } else {
                this.currentCombo++;
                if (this.currentCombo > this.score.maxCombo) this.score.maxCombo = this.currentCombo;

                phantomComboAnimationInterpolator.start(time);
                this.delayedVisualComboIncreases.push({time: time, value: this.currentCombo});
            }
        }

        scoreInterpolator.setGoal(this.score.points, time);
        this.score.accuracy = this.calculateAccuracy();
        accuracyInterpolator.setGoal(this.score.accuracy, time);

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

    break(time: number) {
        if (this.currentCombo === 0) return;

        this.currentCombo = 0;
        phantomComboAnimationInterpolator.start(time);
        this.delayedVisualComboIncreases.push({time: time, value: this.currentCombo});
    }

    resetGekiAndKatu() {
        this.isGeki = true;
        this.isKatu = true;
    }

    calculateAccuracy() {
        if (this.totalNumberOfHits === 0) return 1; // 100.00% acc by default
        return this.totalValueOfHits / (this.totalNumberOfHits * 300);
    }

    updateDisplay(currentTime: number) {
        scoreDisplay.setValue(Math.floor(scoreInterpolator.getCurrentValue(currentTime)));

        phantomComboDisplay.setValue(this.currentCombo);
        let phantomComboAnimCompletion = phantomComboAnimationInterpolator.getCurrentValue(currentTime);
        let phantomComboScale = MathUtil.lerp(1.5, 1, MathUtil.ease(EaseType.EaseOutCubic, phantomComboAnimCompletion));
        phantomComboDisplay.container.scale.set(phantomComboScale);
        phantomComboDisplay.container.alpha = 0.666 * (1 - phantomComboAnimCompletion);

        let comboAnimCompletion = comboAnimationInterpolator.getCurrentValue(currentTime);
        let parabola = -4 * comboAnimCompletion**2 + 4 * comboAnimCompletion;
        comboDisplay.container.scale.set(1 + parabola * 0.08);

        let nextDelayedComboIncrease = this.delayedVisualComboIncreases[0];
        while (nextDelayedComboIncrease && currentTime >= nextDelayedComboIncrease.time + 150) {
            comboAnimationInterpolator.start(nextDelayedComboIncrease.time);
            comboDisplay.setValue(nextDelayedComboIncrease.value);

            this.delayedVisualComboIncreases.shift();
            nextDelayedComboIncrease = this.delayedVisualComboIncreases[0];
        }

        accuracyDisplay.setValue(accuracyInterpolator.getCurrentValue(currentTime) * 100);
    }
}

let scoreInterpolator = new InterpolatedCounter({
    initial: 0,
    duration: (distanceToGoal: number) => {
        // Quick animation for small score increases, like slider ticks
        if (distanceToGoal <= 30) return 110;
        return 500;
    },
    ease: EaseType.EaseOutCubic
});

let accuracyInterpolator = new InterpolatedCounter({
    initial: 1,
    duration: 250,
    ease: EaseType.EaseOutQuad
});

let phantomComboAnimationInterpolator = new Interpolator({
    ease: EaseType.Linear,
    duration: 500,
    from: 0,
    to: 1
});
phantomComboAnimationInterpolator.end();

let comboAnimationInterpolator = new Interpolator({
    ease: EaseType.Linear,
    duration: 250,
    from: 0,
    to: 1
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
    private startWidth: number;
    private startHeight: number;

    constructor(type: ScorePopupType, osuPosition: Point, startTime: number) {
        this.startTime = startTime;

        let currentPlay = gameState.currentPlay;
        let { circleDiameter, pixelRatio } = currentPlay;

        if (DRAWING_MODE === DrawingMode.Procedural) {
            let popup = new PIXI.Text(scorePopupTypeToString.get(type), {
                fontFamily: "Nunito",
                fontSize: 28 * pixelRatio,
                fill: scorePopupTypeToColor.get(type)
            });
    
            popup.anchor.set(0.5, 0.5);
    
            if (HIDE_300s && (
                type === ScorePopupType.Hit300 ||
                type === ScorePopupType.Geki ||
                type === ScorePopupType.Katu300
            )) popup.visible = false;
    
            this.container = popup;
        } else if (DRAWING_MODE === DrawingMode.Skin) {
            let name: string;
            switch (type) {
                case ScorePopupType.Miss: name = "hit0"; break;
                case ScorePopupType.Hit50: name = "hit50"; break;
                case ScorePopupType.Hit100: name = "hit100"; break;
                case ScorePopupType.Katu100: name = "hit100k"; break;
                case ScorePopupType.Hit300: name = "hit300"; break;
                case ScorePopupType.Katu300: name = "hit300k"; break;
                case ScorePopupType.Geki: name = "hit300g"; break;
            }

            let osuTexture = gameState.currentGameplaySkin.textures[name];

            let factor = circleDiameter / 128;
            let width = osuTexture.getWidth() * factor;
            let height = osuTexture.getHeight() * factor;

            let texture = osuTexture.getDynamic(Math.max(width, height), 0);
            let sprite = new PIXI.Sprite(texture);

            sprite.anchor.set(0.5, 0.5);
            sprite.width = width;
            sprite.height = height;

            let wrapper = new PIXI.Container();
            wrapper.addChild(sprite);

            this.container = wrapper;
        }

        this.container.x = currentPlay.toScreenCoordinatesX(osuPosition.x);
        this.container.y = currentPlay.toScreenCoordinatesY(osuPosition.y);

        if (type === ScorePopupType.Miss) {
            this.container.rotation = (2 * (Math.random() - 0.5)) * Math.PI * 0.05; // Random tilt for miss popup
        }
    }

    update(currentTime: number) {
        if (currentTime >= this.startTime + SCORE_POPUP_FADE_OUT_TIME) {
            this.renderingFinished = true;
            return;
        }

        let { circleDiameter } = gameState.currentPlay;

        let appearanceCompletion = (currentTime - this.startTime) / SCORE_POPUP_APPEARANCE_TIME;
        appearanceCompletion = MathUtil.clamp(appearanceCompletion, 0, 1);
        // Same as 'em slider ticks
        //let parabola = (-2.381 * appearanceCompletion * appearanceCompletion + 3.381 * appearanceCompletion);
        appearanceCompletion = MathUtil.ease(EaseType.EaseOutElastic, appearanceCompletion, 0.55);

        let gradualScaleUp = (currentTime - this.startTime) / SCORE_POPUP_FADE_OUT_TIME;

        let fadeOutCompletion = (currentTime - this.startTime) / SCORE_POPUP_FADE_OUT_TIME;
        fadeOutCompletion = MathUtil.clamp(fadeOutCompletion, 0, 1);
        fadeOutCompletion = MathUtil.ease(EaseType.EaseInCubic, fadeOutCompletion);

        // At the end of the fade out, the thing should be at 1.12x the start size.
        let factor = appearanceCompletion + gradualScaleUp * 0.12;
        //this.container.width = SCORE_POPUP_CS_RATIO * circleDiameter * factor;
        //this.container.height = SCORE_POPUP_CS_RATIO * circleDiameter * factor;
        this.container.scale.set(factor);
        this.container.alpha = 1 - fadeOutCompletion;
    }

    remove() {
        scorePopupContainer.removeChild(this.container);
    }
}