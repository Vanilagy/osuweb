interface Extras {
	sampleSet: number,
	additionSet: number,
	customIndex: number,
	sampleVolume: number,
	filename: string
}

const DEFAULT_EXTRAS: Extras = {
	sampleSet: 0,
	additionSet: 0,
	customIndex: 0,
	sampleVolume: 0,
	filename: ""
};

export abstract class HitObject {
	public x: number = 0;
	public y: number = 0;
	public time: number = 0;
	public comboSkips: number = 0;
	public hitSound: number = 0;
	public extras: Extras = DEFAULT_EXTRAS;

	constructor() {}
}