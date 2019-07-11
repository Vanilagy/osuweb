import { ProcessedBeatmap } from "./processed_beatmap";
import { MathUtil } from "../util/math_util";
import { scoreDisplay, comboDisplay } from "./hud";
import { padNumberWithZeroes } from "../util/misc_util";
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

    add(rawAmount: number) {
        let gain = rawAmount;
        gain *= 1 + MathUtil.clamp(this.currentCombo - 1, 0, Infinity) * this.difficultyMultiplier * this.modMultiplier / 25;
        gain = Math.floor(gain);

        this.score.points += gain;

        this.currentCombo++;

        someShit.setGoal(this.score.points);
    }

    updateDisplay() {
        scoreDisplay.text = padNumberWithZeroes(someShit.getCurrentValue(), 8);
        comboDisplay.text = String(this.currentCombo) + "x";
    }
}


let someShit = new InterpolatedCounter({
    initial: 0,
    duration: 333,
    ease: 'easeOutQuad'
});