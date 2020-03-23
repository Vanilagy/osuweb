import { Skill } from "./skill";
import { DifficultyHitObject } from "./difficulty_hit_object";
import { ProcessedSpinner } from "../processed/processed_spinner";

const SINGLE_SPACING_THRESHOLD = 125;
const ANGLE_BONUS_BEGIN = 5 * Math.PI/ 6;
const PI_OVER_4 = Math.PI / 4;
const PI_OVER_2 = Math.PI / 2;
const MIN_SPEED_BONUS = 75; // ~200 BPM
const MAX_SPEED_BONUS = 45; // ~330 BPM
const SPEED_BALANCING_FACTOR = 40;

export class Speed extends Skill {
	constructor() {
		super();
	
		this.skillMultiplier = 1400;
		this.strainDecayBase = 0.3;
	}

	strainValueOf(current: DifficultyHitObject) {
		if (current.baseObject instanceof ProcessedSpinner) return 0;

		let distance = Math.min(SINGLE_SPACING_THRESHOLD, current.travelDistance + current.jumpDistance);
		let deltaTime = Math.max(MAX_SPEED_BONUS, current.deltaTime);

		let speedBonus = 1.0;
		if (deltaTime < MIN_SPEED_BONUS) speedBonus = 1 + Math.pow((MIN_SPEED_BONUS - deltaTime) / SPEED_BALANCING_FACTOR, 2);

		let angleBonus = 1.0;
		if (current.angle !== null && current.angle < ANGLE_BONUS_BEGIN) {
			angleBonus = 1 + Math.pow(Math.sin(1.5 * (ANGLE_BONUS_BEGIN - current.angle)), 2) / 3.57;

			if (current.angle < PI_OVER_2) {
				angleBonus = 1.28;
				if (distance < 90 && current.angle < PI_OVER_4)
					angleBonus += (1 - angleBonus) * Math.min((90 - distance) / 10, 1);
				else if (distance < 90)
					angleBonus += (1 - angleBonus) * Math.min((90 - distance) / 10, 1) * Math.sin((PI_OVER_2 - current.angle) / PI_OVER_4);
			}
		}

		return (1 + (speedBonus - 1) * 0.75) * angleBonus * (0.95 + speedBonus * Math.pow(distance / SINGLE_SPACING_THRESHOLD, 3.5)) / current.strainTime;
	}
}