import { HitObject } from "./hit_object";
import { Point } from "../../util/point";

export enum SliderType {
	Perfect,
	Linear,
	Bézier,
	Catmull
}

export interface Sampling {
	sampleSet: number,
	additionSet: number
}

/** A section is basically the curve between two red anchor points (or the start/end of the slider). */
export interface SliderCurveSection {
	values: Point[]
}

export class Slider extends HitObject {
	public repeat: number = 1;
	public length: number = 100;
	public sections: SliderCurveSection[];
	public edgeHitSounds: number[] = [];
	public edgeSamplings: Sampling[] = [];
	public type: SliderType = SliderType.Bézier;
}