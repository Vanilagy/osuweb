import { DifficultyHitObject } from "./difficulty_hit_object";

export abstract class Skill {
	protected skillMultiplier: number;
	protected strainDecayBase: number;
	protected decayWeight = 0.9;
	private currentStrain = 1;
	private currentSectionPeak = 1;
	private strainPeaks: number[] = [];
	protected previous: DifficultyHitObject[] = [];

	process(current: DifficultyHitObject) {
		this.currentStrain *= this.strainDecay(current.deltaTime);
		this.currentStrain += this.strainValueOf(current) * this.skillMultiplier;

		this.currentSectionPeak = Math.max(this.currentStrain, this.currentSectionPeak);

		this.previous.push(current);
		if (this.previous.length === 3) this.previous.shift();
	}

	saveCurrentPeak() {
		if (this.previous.length > 0) this.strainPeaks.push(this.currentSectionPeak);
	}

	startNewSectionFrom(offset: number) {
		if (this.previous.length > 0) this.currentSectionPeak = this.currentStrain * this.strainDecay(offset - this.previous[0].baseObject.startTime);
	}

	difficultyValue() {
		let difficulty = 0;
		let weight = 1;

		this.strainPeaks.sort((a, b) => b - a); // Descending
		for (let i = 0; i < this.strainPeaks.length; i++) {
			difficulty += this.strainPeaks[i] * weight;
			weight *= this.decayWeight;
		}

		return difficulty;
	}

	private strainDecay(ms: number) {
		return Math.pow(this.strainDecayBase, ms / 1000);
	}

	protected abstract strainValueOf(current: DifficultyHitObject): number;
}