import { Mod } from "../game/mods/mods";
import { MathUtil } from "../util/math_util";

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

export enum ScoreGrade {
	X, // "SS"
	S,
	A,
	B,
	C,
	D
}

interface ScoreAccuracyData {
	lowError: number,
	highError: number,
	unstableRate: number
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
	public mods: Set<Mod>;
	public hitInaccuracies: number[];

	reset() {
		this.points = 0;
		this.accuracy = 1.0;

		this.hits300 = 0;
		this.hits100 = 0;
		this.hits50 = 0;
		this.misses = 0;
		this.geki = 0;
		this.katu = 0;
		this.maxCombo = 0;

		this.hitInaccuracies = [];
	}

	getTotalHits() {
		return this.hits300 + this.hits100 + this.hits50 + this.misses;
	}

	calculateGrade() {
		let totalHits = this.getTotalHits();
		let percentage300 = this.hits300 / totalHits;
		let percentage50 = this.hits50 / totalHits;

		// 100% accuracy
		if (this.accuracy === 1.0) return ScoreGrade.X;
		// Over 90% 300s, less than 1% 50s and no misses
		else if (percentage300 >= 0.9 && percentage50 < 0.01 && this.misses === 0) return ScoreGrade.S;
		// Over 80% 300s and no misses OR over 90% 300s
		else if (percentage300 >= 0.8 && this.misses === 0 || percentage300 >= 0.9) return ScoreGrade.A;
		// Over 70% 300s and no misses OR over 80% 300s
		else if (percentage300 >= 0.7 && this.misses === 0 || percentage300 >= 0.8) return ScoreGrade.B;
		// Over 60% 300s
		else if (percentage300 >= 0.6) return ScoreGrade.C;
		// Anything else
		return ScoreGrade.D;
	}

	calculateAccuracyData(): ScoreAccuracyData {
		if (this.hitInaccuracies.length === 0) return {
			lowError: 0,
			highError: 0,
			unstableRate: 0
		};

		let total = 0,
			negativeTotal = 0,
			negativeCount = 0,
			positiveTotal = 0,
			positiveCount = 0;

		for (let inaccuracy of this.hitInaccuracies) {
			if (inaccuracy < 0) {
				negativeTotal += inaccuracy;
				negativeCount++;
			} else {
				positiveTotal += inaccuracy;
				positiveCount++;
			}

			total += inaccuracy;
		}

		let mean = total / this.hitInaccuracies.length;

		return {
			lowError: (negativeCount > 0)? negativeTotal/negativeCount : 0,
			highError: (positiveCount > 0)? positiveTotal/positiveCount : 0,
			unstableRate: MathUtil.calculateStandardDeviation(this.hitInaccuracies, mean) * 10
		};
	}
}