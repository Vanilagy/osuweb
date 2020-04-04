import { JudgementProcessor } from "./judgement_processor";
import { Judgement } from "./judgement";
import { ProcessedBeatmap } from "../processed/processed_beatmap";
import { Mod } from "../mods";
import { Score, ScoringValue } from "./score";
import { ModHelper } from "../../game/mods/mod_helper";

export class ScoreProcessor extends JudgementProcessor {
	public score: Score;

	protected beatmap: ProcessedBeatmap;
	protected activeMods: Set<Mod>;
	protected difficultyMultiplier: number;
	protected modMultiplier: number;

	protected currentCombo: number;
	protected totalNumberOfHits: number;
	protected totalValueOfHits: number;
	protected isGeki: boolean;
	protected isKatu: boolean;

	constructor() {
		super();
	}

	reset() {
		this.score = new Score();
		this.score.reset();
		if (this.activeMods) this.score.mods = this.activeMods;

		this.currentCombo = 0;
		this.totalNumberOfHits = 0;
		this.totalValueOfHits = 0;
		this.resetGekiAndKatu();
	}

	hookBeatmap(processedBeatmap: ProcessedBeatmap, activeMods: Set<Mod>) {
		this.reset();

		this.beatmap = processedBeatmap;
		this.activeMods = activeMods;

		this.score.mods = this.activeMods;
		this.difficultyMultiplier = this.beatmap.difficulty.calculateDifficultyMultiplier(); // Get the difficulty from the beatmap, not the processed beatmap, because: "Note that game modifiers (like Hard Rock/Easy) will not change the Difficulty multiplier. It will only account for original values only."
		this.modMultiplier = ModHelper.calculateModMultiplier(this.activeMods);
	}

 	process(judgement: Judgement, record = false) {
		super.process(judgement, record);

		if (!this.beatmap) return;

		let effectiveCombo = Math.max(0, this.currentCombo - 1);

		let rawAmount = judgement.getNumericScoreValue();
		let scoreGain = rawAmount;
		if (!judgement.isRaw) scoreGain = rawAmount + (rawAmount * (effectiveCombo * this.difficultyMultiplier * this.modMultiplier) / 25);
		scoreGain = Math.floor(scoreGain); // Especially with a mod multiplier, gain can be decimal, so floor here.

		this.score.points += scoreGain;

		if (!judgement.isRaw) {
			this.totalNumberOfHits++;
			this.totalValueOfHits += rawAmount;
		}

		if (judgement.affectsCombo) {
			if (judgement.value === ScoringValue.Miss) {
				this.break(judgement.time);
			} else {
				this.currentCombo++;
				if (this.currentCombo > this.score.maxCombo) this.score.maxCombo = this.currentCombo;
			}
		}

		this.score.accuracy = this.calculateAccuracy();

		if (!judgement.isRaw) {
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

			if (judgement.hitObject.comboInfo.isLast) {
				if (this.isGeki) {
					this.score.geki++;
					judgement.geki = true;
				} else if (this.isKatu) {
					this.score.katu++;
					judgement.katu = true;
				}

				this.resetGekiAndKatu();
			}
		}
	}

	resetGekiAndKatu() {
		this.isGeki = true;
		this.isKatu = true;
	}

	break(time: number) {
		this.currentCombo = 0;
	}

	calculateAccuracy() {
		if (this.totalNumberOfHits === 0) return 1; // 100.00% acc by default
		return this.totalValueOfHits / (this.totalNumberOfHits * 300);
	}

	addHitInaccuracy(timeInaccuracy: number) {
		this.score.hitInaccuracies.push(timeInaccuracy);
	}

	addSpinRpm(rpm: number) {
		this.score.spinRpms.push(rpm);
	}
}