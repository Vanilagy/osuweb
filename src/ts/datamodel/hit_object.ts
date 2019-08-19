interface Extras {
    sampleSet: number,
    additionSet: number,
    customIndex: number,
    sampleVolume: number,
    fileName: string
}

const DEFAULT_EXTRAS: Extras = {
    sampleSet: 0,
    additionSet: 0,
    customIndex: 0,
    sampleVolume: 0,
    fileName: ""
};

export abstract class HitObject {
    public newCombo: number;
    public x: number;
    public y: number;
    public time: number;
    public hitSound: number;
    public extras: Extras;

    constructor(data: string[]) {
        let comboSkip = HitObject.getComboSkipsFromType(Number(data[3]));

        let hitObjectType = parseInt(data[3]) % 16;

        this.newCombo = (hitObjectType === 5 || hitObjectType === 6 || hitObjectType === 12) ? (comboSkip > 0 ? comboSkip : -1) : null;
        this.x = parseInt(data[0]);
        this.y = parseInt(data[1]);
        this.time = parseInt(data[2]);
        this.hitSound = parseInt(data[4]);
    }

    parseExtras(data: string) {
        if (data) {
            let values = data.split(":");

            this.extras = {
                sampleSet: parseInt(values[0]),
                additionSet: parseInt(values[1]),
                customIndex: parseInt(values[2]),
                sampleVolume: parseInt(values[3]),
                fileName: values[4]
            };
        } else {
            this.extras = DEFAULT_EXTRAS;
        }
    }

    static getComboSkipsFromType(hitObjectType: number) {
        let comboSkip = 0;

        while (hitObjectType > 12) {
            hitObjectType -= 16;
            comboSkip++;
        }

        return comboSkip;
    }
}