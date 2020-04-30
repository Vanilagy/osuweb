import { ProcessedHeadedHitObject } from "./processed_headed_hit_object";
import { ComboInfo, CurrentTimingPointInfo, ProcessedBeatmap } from "./processed_beatmap";
import { Circle } from "../hit_objects/circle";
import { stackShiftPoint } from "../../util/point";

export class ProcessedCircle extends ProcessedHeadedHitObject {
	public hitObject: Circle;

	constructor(circle: Circle, comboInfo: ComboInfo, timingInfo: CurrentTimingPointInfo, processedBeatmap: ProcessedBeatmap) {
		super(circle, comboInfo, timingInfo, processedBeatmap);

		this.endTime = this.startTime;
		this.endPoint = this.startPoint;
	}
	
	applyStackPosition() {
		// Since start point == end point, this changes both points
		stackShiftPoint(this.startPoint, this.stackHeight);
	}
}