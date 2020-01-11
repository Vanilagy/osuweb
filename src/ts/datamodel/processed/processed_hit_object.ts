import { ComboInfo, CurrentTimingPointInfo, ProcessedBeatmap } from "./processed_beatmap";
import { HitObject } from "../hit_object";
import { Point } from "../../util/point";
import { PlayEvent } from "../play_events";

export abstract class ProcessedHitObject {
	public hitObject: HitObject;
	public index: number = null;
	public comboInfo: ComboInfo;
	public timingInfo: CurrentTimingPointInfo;
	public processedBeatmap: ProcessedBeatmap;

	public startPoint: Point;
	public endPoint: Point;
	public startTime: number;
	public endTime: number;
	
	constructor(hitObject: HitObject, comboInfo: ComboInfo, timingInfo: CurrentTimingPointInfo, processedBeatmap: ProcessedBeatmap) {
		this.hitObject = hitObject;

		this.startPoint = { // It is important that we "duplicate" the point here. This decouples the raw hitObject from the drawable.
			x: this.hitObject.x,
			y: this.hitObject.y
		};
		this.startTime = this.hitObject.time;

		this.comboInfo = comboInfo;
		this.timingInfo = timingInfo;
		this.processedBeatmap = processedBeatmap;
	}
	
	abstract addPlayEvents(playEventArray: PlayEvent[]): void;
}