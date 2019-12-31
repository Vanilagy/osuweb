import { HitObject } from "../../datamodel/hit_object";
import { Point } from "../../util/point";
import { ProcessedHitObject } from "../../datamodel/processed/processed_hit_object";
import { CurrentTimingPointInfo } from "../../datamodel/processed/processed_beatmap";

export abstract class DrawableHitObject {
	public parent: ProcessedHitObject;

    /** Specifies the timeframe is which the object is visible and needs to be rendered. */
    public renderStartTime: number;
    /** When true, the hit object has ended its short life as a graphical element and need not be rendered anymore. */
	public renderFinished: boolean = false;
	
	constructor(processedHitObject: ProcessedHitObject) {
		this.parent = processedHitObject;
	}

    protected abstract initSounds(hitObject: HitObject, timingInfo: CurrentTimingPointInfo): void;

    abstract draw(): void;

    abstract show(currentTime: number): void;

    abstract position(): void;

    abstract update(currentTime: number): void;

    abstract remove(): void;

    /** @returns A boolean, indicating whether or not the object was handled by the button press. It could be false, for example, if the mouse wasn't over it or the object was already hit. */
    abstract handleButtonDown(osuMouseCoordinates: Point, currentTime: number): boolean;
}