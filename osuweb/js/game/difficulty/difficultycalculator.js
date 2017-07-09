"use strict";

import {ProcessedBeatmap} from "../../datamodel/processedbeatmap";
import {Aim, Speed} from "./skill";
import {DifficultyBeatmap} from "./difficultybeatmap";

const SECTION_LENGTH = 400;
const DIFFICULTY_MULTIPLIER = 0.0675;

export class DifficultyCalculator {
    constructor(beatmap) {
        this._beatmap = beatmap;
    }

    calculate(categoryDifficulty) {
        if(this._beatmap.constructor.name === "Beatmap") {
            this._beatmap = new ProcessedBeatmap(this._beatmap);
            this._beatmap.process(false);
        }

        let beatmap = new DifficultyBeatmap(this._beatmap.hitObjects);

        this.skills = [new Aim(), new Speed()];

        let sectionEnd = SECTION_LENGTH;

        let diffObject;

        while((diffObject = beatmap.getNext()) !== null) {
            while (diffObject.baseObject.startTime > sectionEnd) {
                for(let i = 0; i < this.skills.length; i++) {
                    this.skills[i].saveCurrentPeak();
                    this.skills[i].startNewSectionFrom(sectionEnd);
                }

                sectionEnd += SECTION_LENGTH;
            }

            for(let i = 0; i < this.skills.length; i++) {
                this.skills[i].process(diffObject);
            }
        }

        let aimRating = Math.sqrt(this.skills[0].getDifficultyValue()) * DIFFICULTY_MULTIPLIER;
        let speedRating = Math.sqrt(this.skills[1].getDifficultyValue()) * DIFFICULTY_MULTIPLIER;

        let starRating = aimRating + speedRating + Math.abs(aimRating - speedRating) / 2;

        if (categoryDifficulty !== null)
        {
            categoryDifficulty["Aim"] = aimRating.toFixed(2);
            categoryDifficulty["Speed"] = speedRating.toFixed(2);
        }

        return starRating;
    }
}