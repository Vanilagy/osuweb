"use strict";

export class HitObject {
    constructor(data) {
        let comboSkip = HitObject.getComboSkipsFromType(data[3]);

        let hitObjectType = parseInt(data[3]) % 16;

        this.newCombo = hitObjectType === 5 || hitObjectType === 6 || hitObjectType === 12 ? (comboSkip > 0 ? comboSkip : -1) : null;
        this.x = parseInt(data[0]);
        this.y = parseInt(data[1]);
        this.time = parseInt(data[2]);
        this.hitSound = parseInt(data[4]);

        let samplingValues = [0, 0];

        if (data[5] !== undefined) {
            samplingValues = data[5].split(':');
        }

        this.samplings = {
            sampleSet: parseInt(samplingValues[0], 10),
            sampleSetAddition: parseInt(samplingValues[1], 10)
        };
    }

    static getComboSkipsFromType(hitObjectType) {
        let comboSkip = 0;

        while (hitObjectType > 12) {
            hitObjectType -= 16;
            comboSkip++;
        }

        return comboSkip;
    }
}