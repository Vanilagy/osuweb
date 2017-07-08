"use strict";

export class Skill {
    getSkillMultiplier() {}
    getStrainDecayBase() {}

    constructor() {
        this.lastObject = null;
        this.currentStrain = 1; // We keep track of the strain level at all times throughout the beatmap.
        this.currentSectionPeak = 1; // We also keep track of the peak strain level in the current section.
        this.strainPeaks = [];
    }

    process(current) {
        this.currentStrain *= this.strainDecay(current.deltaTime);
        if (!(current.baseObject.constructor.name === "DrawableSpinner"))
            this.currentStrain += this.strainValueOf(current) * this.getSkillMultiplier();

        this.currentSectionPeak = Math.max(this.currentStrain, this.currentSectionPeak);

        this.lastObject = current;
    }

    saveCurrentPeak() {
        if (this.lastObject)
            this.strainPeaks.push(this.currentSectionPeak);
    }

    startNewSectionFrom(offset) {
        // The maximum strain of the new section is not zero by default, strain decays as usual regardless of section boundaries.
        // This means we need to capture the strain level at the beginning of the new section, and use that as the initial peak level.
        if (this.lastObject)
            this.currentSectionPeak = this.currentStrain * this.strainDecay(offset - this.lastObject.baseObject.startTime);
    }

    getDifficultyValue() {
        this.strainPeaks.sort((a, b) => {
            if(a === b) return 0;
            return b > a ? 1 : -1;
        });

        let difficulty = 0;
        let weight = 1;

        // Difficulty is the weighted sum of the highest strains from every section.
        for(let i = 0; i < this.strainPeaks.length; i++)
        {
            let strain = this.strainPeaks[i];

            difficulty += strain * weight;
            weight *= 0.9;
        }

        return difficulty;
    }

    strainValueOf(current) {}

    strainDecay(ms) {
        return Math.pow(this.getStrainDecayBase(), ms / 1000);
    }
}

export class Aim extends Skill {
    getSkillMultiplier() {return 26.25;}
    getStrainDecayBase() {return 0.15;}

    strainValueOf(current) { return Math.pow(current.distance, 0.99)}
}

const SINGLE_SPACING_THRESHOLD = 125;
const STREAM_SPACING_THRESHOLD = 110;
const ALMOST_DIAMETER = 90;

export class Speed extends Skill {
    getSkillMultiplier() {return 1400;}
    getStrainDecayBase() {return 0.3;}

    strainValueOf(current)
    {
        let distance = current.distance;

        let speedValue;
        if (distance > SINGLE_SPACING_THRESHOLD)
            speedValue = 2.5;
        else if (distance > STREAM_SPACING_THRESHOLD)
            speedValue = 1.6 + 0.9 * (distance - STREAM_SPACING_THRESHOLD) / (SINGLE_SPACING_THRESHOLD - STREAM_SPACING_THRESHOLD);
        else if (distance > ALMOST_DIAMETER)
            speedValue = 1.2 + 0.4 * (distance - ALMOST_DIAMETER) / (STREAM_SPACING_THRESHOLD - ALMOST_DIAMETER);
        else if (distance > ALMOST_DIAMETER / 2)
            speedValue = 0.95 + 0.25 * (distance - ALMOST_DIAMETER / 2) / (ALMOST_DIAMETER / 2);
        else
            speedValue = 0.95;

        return speedValue / current.deltaTime;
    }
}