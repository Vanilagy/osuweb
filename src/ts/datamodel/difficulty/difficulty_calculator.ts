import { Aim } from "./aim";
import { Speed } from "./speed";
import { ProcessedBeatmap } from "../processed/processed_beatmap";
import { Skill } from "./skill";
import { DifficultyHitObject } from "./difficulty_hit_object";
import { Mod } from "../mods";

const DIFFICULTY_MULTIPLIER = 0.0675;
const SECTION_LENGTH = 400;

export interface DifficultyAttributes {
	aimStrain: number,
	speedStrain: number,
	starRating: number
}

// This algorithm for difficulty calculation is taken from lazer's source code.
export abstract class DifficultyCalculator {
	static calculate(beatmap: ProcessedBeatmap, mods: Set<Mod>, clockRate: number): DifficultyAttributes {
		let skills = [new Aim(), new Speed()];

		if (beatmap.hitObjects.length === 0) return this.createDifficultyAttributes(beatmap, mods, skills, clockRate);

		let difficultyHitObjects = this.createDifficultyHitObjects(beatmap, clockRate);
		let sectionLength = SECTION_LENGTH * clockRate;
		
		// The first object doesn't generate a strain, so we begin with an incremented section end
		let currentSectionEnd = Math.ceil(beatmap.hitObjects[0].startTime / sectionLength) * sectionLength;

		for (let i = 0; i < difficultyHitObjects.length; i++) {
			let h = difficultyHitObjects[i];

			while (h.baseObject.startTime > currentSectionEnd) {
				for (let j = 0; j < 2; j++) {
					let s = skills[j];

					s.saveCurrentPeak();
					s.startNewSectionFrom(currentSectionEnd);
				}

				currentSectionEnd += sectionLength;
			}

			for (let j = 0; j < 2; j++) {
				skills[j].process(h);
			}
		}

		// The peak strain will not be saved for the last section in the above loop
		for (let j = 0; j < 2; j++) {
			skills[j].saveCurrentPeak();
		}

		return this.createDifficultyAttributes(beatmap, mods, skills, clockRate);
	}

	private static createDifficultyAttributes(beatmap: ProcessedBeatmap, mods: Set<Mod>, skills: Skill[], clockRate: number): DifficultyAttributes {
		if (beatmap.hitObjects.length === 0) {
			return {
				starRating: 0,
				aimStrain: 0,
				speedStrain: 0
			};
		}

		let aimRating = Math.sqrt(skills[0].difficultyValue()) * DIFFICULTY_MULTIPLIER;
		let speedRating = Math.sqrt(skills[1].difficultyValue()) * DIFFICULTY_MULTIPLIER;
		let starRating = aimRating + speedRating + Math.abs(aimRating - speedRating) / 2;

		return {
			aimStrain: aimRating,
			speedStrain: speedRating,
			starRating: starRating
		};
	}

	private static createDifficultyHitObjects(beatmap: ProcessedBeatmap, clockRate: number) {
		let arr: DifficultyHitObject[] = [];

		for (let i = 1; i < beatmap.hitObjects.length; i++) {
			let lastLast = (i > 1)? beatmap.hitObjects[i - 2] : null;
			let last = beatmap.hitObjects[i - 1];
			let current = beatmap.hitObjects[i];

			arr.push(new DifficultyHitObject(current, lastLast, last, clockRate));
		}

		return arr;
	}
}