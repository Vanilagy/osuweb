import { Skill } from "./skill";
import { DifficultyHitObject } from "./difficulty_hit_object";
import { ProcessedSpinner } from "../processed/processed_spinner";

const ANGLE_BONUS_BEGIN = Math.PI / 3;
const TIMING_THRESHOLD = 107;

export class Aim extends Skill {
	constructor() {
		super();

		this.skillMultiplier = 26.25;
		this.strainDecayBase = 0.15;
	}

	strainValueOf(current: DifficultyHitObject) {
		if (current.baseObject instanceof ProcessedSpinner) return 0;

		let result = 0;

		if (this.previous.length > 0) {
			let previous = this.previous[0];

			if (current.angle !== null && current.angle > ANGLE_BONUS_BEGIN) {
				let scale = 90;

				let angleBonus = Math.sqrt(
					Math.max(previous.jumpDistance - scale, 0)
					* Math.pow(Math.sin(current.angle - ANGLE_BONUS_BEGIN), 2)
					* Math.max(current.jumpDistance - scale, 0));
				result = 1.5 * this.applyDiminishingExp(Math.max(0, angleBonus)) / Math.max(TIMING_THRESHOLD, previous.strainTime);
			}
		}

		let jumpDistanceExp = this.applyDiminishingExp(current.jumpDistance);
		let travelDistanceExp = this.applyDiminishingExp(current.travelDistance);

		return Math.max(
			result + (jumpDistanceExp + travelDistanceExp + Math.sqrt(travelDistanceExp * jumpDistanceExp)) / Math.max(current.strainTime, TIMING_THRESHOLD),
			(Math.sqrt(travelDistanceExp * jumpDistanceExp) + jumpDistanceExp + travelDistanceExp) / current.strainTime
		);
	}

	private applyDiminishingExp(val: number) {
		return Math.pow(val, 0.99);
	}
}