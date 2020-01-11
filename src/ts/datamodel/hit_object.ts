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
	public x: number;
	public y: number;
	public time: number;
	public comboSkips: number;
	public hitSound: number;
	public extras: Extras;

	constructor(data: string[]) {
		this.x = parseInt(data[0]);
		this.y = parseInt(data[1]);
		this.time = parseInt(data[2]);
		this.comboSkips = HitObject.getComboSkipsFromType(parseInt(data[3]));
		this.hitSound = parseInt(data[4]);
	}

	protected parseExtras(data: string) {
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
		if ((hitObjectType & 4) === 0) {
			return 0;
		} else {
			let skips = 1;
			skips += (hitObjectType & 0b01110000) >> 4;

			return skips;
		}
	}
}