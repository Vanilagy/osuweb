import { ProcessedBeatmap } from "./processed_beatmap";
import { MathUtil, EaseType } from "../util/math_util";
import { scoreDisplay, comboDisplay, accuracyDisplay } from "./hud";
import { padNumberWithZeroes, toPercentageString } from "../util/misc_util";
import { InterpolatedCounter } from "../util/graphics_util";

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
    }

    // A raw amount of zero means miss
    add(rawAmount: number, raw: boolean = false, affectCombo: boolean = true, affectAccuracy: boolean = true) {
        console.log(rawAmount);

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
    }

    break() {
        this.currentCombo = 0;

        // And do the other things
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