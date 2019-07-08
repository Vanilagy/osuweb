export abstract class HitObject {
    public newCombo: any;
    public x: number;
    public y: number;
    public time: number;
    public hitSound: number;
    public samplings: any;

    constructor(data: any) {
        let comboSkip = HitObject.getComboSkipsFromType(data[3]);

        let hitObjectType = parseInt(data[3]) % 16;

        this.newCombo = hitObjectType === 5 || hitObjectType === 6 || hitObjectType === 12 ? (comboSkip > 0 ? comboSkip : -1) : false;
        this.x = parseInt(data[0]);
        this.y = parseInt(data[1]);
        this.time = parseInt(data[2]);
        this.hitSound = parseInt(data[4]);

        let samplingValues = ["0", "0"];

        if (data[5] !== undefined) {
            samplingValues = data[5].split(':');
        }

        this.samplings = {
            sampleSet: parseInt(samplingValues[0], 10),
            sampleSetAddition: parseInt(samplingValues[1], 10)
        };
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