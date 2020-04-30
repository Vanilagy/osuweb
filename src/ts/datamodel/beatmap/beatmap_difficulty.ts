import { ScoringValue } from "../scoring/score";

export class BeatmapDifficulty {
	public SL: number = 0.7; // Stack leniency taken from McOsu
	public SV: number = 1; // Slider velocity TODO: is this the default?
	public TR: number = 1; // Slider tick rate
	public AR: number = 5; // Approach rate
	public HP: number = 5; // Hit Points
	public OD: number = 5; // Overall difficulty
	public CS: number = 5; // Circle size

	// AR
	static getApproachTime(AR: number) {
		if (AR <= 5) {
			return 1800 - 120 * AR;
		} else {
			return 1950 - 150 * AR;
		}
	}

	getApproachTime() {
		return BeatmapDifficulty.getApproachTime(this.AR);
	}

	// OD
	static getHitDeltaForScoringValue(OD: number, scoringValue: ScoringValue) {
		switch(scoringValue) {
			case ScoringValue.Hit300:
				return Math.ceil(79.5 - 6 * OD);
			case ScoringValue.Hit100:
				return Math.ceil(139.5 - 8 * OD);
			case ScoringValue.Hit50:
				return Math.ceil(199.5 - 10 * OD);
			default:
				return Infinity; // Makes sense, right? No really, name a better value.
		}
	}

	getHitDeltaForScoringValue(scoringValue: number) {
		return BeatmapDifficulty.getHitDeltaForScoringValue(this.OD, scoringValue);
	}

	static getScoringValueForHitDelta(OD: number, hitDelta: number) {
		if (BeatmapDifficulty.getHitDeltaForScoringValue(OD, ScoringValue.Hit300) >= hitDelta) return ScoringValue.Hit300;
		if (BeatmapDifficulty.getHitDeltaForScoringValue(OD, ScoringValue.Hit100) >= hitDelta) return ScoringValue.Hit100;
		if (BeatmapDifficulty.getHitDeltaForScoringValue(OD, ScoringValue.Hit50) >= hitDelta) return ScoringValue.Hit50;
		return ScoringValue.Miss;
	}

	getScoringValueForHitDelta(hitDelta: number) {
		return BeatmapDifficulty.getScoringValueForHitDelta(this.OD, hitDelta);
	}

	// CS
	static getCirclePixelSize(CS: number) {
		return 64 * (1.0 - 0.7 * (CS - 5) / 5);
	}

	getCirclePixelSize()  {
		return BeatmapDifficulty.getCirclePixelSize(this.CS);
	}

	calculateDifficultyMultiplier() {
		// Should not be called from ProcessedBeatmap, but only Beatmap.
		let accumulatedDifficultyPoints = this.CS + this.HP + this.OD;
		
		// Determined emperically. These differ from what's listed on the official osu website, however these values seem to be the correct ones. UwU
		if (accumulatedDifficultyPoints <= 3.0) return 2;
		else if (accumulatedDifficultyPoints <= 10.5) return 3;
		else if (accumulatedDifficultyPoints <= 18.2) return 4;
		else if (accumulatedDifficultyPoints <= 25.7) return 5;
		return 6;
	}

	clone() {
		let newDifficulty = new BeatmapDifficulty();

		newDifficulty.SL = this.SL;
		newDifficulty.SV = this.SV;
		newDifficulty.TR = this.TR;
		newDifficulty.AR = this.AR;
		newDifficulty.HP = this.HP;
		newDifficulty.OD = this.OD;
		newDifficulty.CS = this.CS;

		return newDifficulty;
	}

	// Taken from https://github.com/ppy/osu/blob/e39604619d470f68c1ca57e9df297f475a130896/osu.Game/Beatmaps/BeatmapDifficulty.cs
	/**
	 * Maps a difficulty value [0, 10] to a two-piece linear range of values.
	 * @param difficulty The difficulty value to be mapped.
	 * @param min Minimum of the resulting range which will be achieved by a difficulty value of 0.
	 * @param mid Midpoint of the resulting range which will be achieved by a difficulty value of 5.
	 * @param max Maximum of the resulting range which will be achieved by a difficulty value of 10.
	 */
	static difficultyRange(difficulty: number, min: number, mid: number, max: number) {
		if (difficulty > 5)
			return mid + (max - mid) * (difficulty - 5) / 5;
		if (difficulty < 5)
			return mid - (mid - min) * (5 - difficulty) / 5;

		return mid;
	}
}