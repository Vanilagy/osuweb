import { ProcessedHitObject } from "./processed_hit_object";
import { ComboInfo, CurrentTimingPointInfo, ProcessedBeatmap } from "./processed_beatmap";
import { Spinner } from "../hit_objects/spinner";
import { PlayEvent, PlayEventType } from "../play_events";
import { BeatmapDifficulty } from "../beatmap/beatmap_difficulty";

export class ProcessedSpinner extends ProcessedHitObject {
	public hitObject: Spinner;
	public duration: number;
	public requiredSpins: number;

	constructor(spinner: Spinner, comboInfo: ComboInfo, timingInfo: CurrentTimingPointInfo, processedBeatmap: ProcessedBeatmap) {
		super(spinner, comboInfo, timingInfo, processedBeatmap);

		this.startTime = this.hitObject.time;
		this.endTime = this.hitObject.endTime;
		this.endPoint = this.startPoint;

		this.duration = this.endTime - this.startTime;

		// 1 Spin = 1 Revolution. This calculation is taken straight from lazer's source:
		this.requiredSpins = Math.floor(this.duration / 1000 * BeatmapDifficulty.difficultyRange(processedBeatmap.difficulty.OD, 3, 5, 7.5));
		this.requiredSpins = Math.floor(Math.max(1, this.requiredSpins * 0.6)); // "spinning doesn't match 1:1 with stable, so let's fudge them easier for the time being."
	}
	
	addPlayEvents(playEventArray: PlayEvent[]) {
		playEventArray.push({
			type: PlayEventType.SpinnerEnd,
			hitObject: this,
			time: this.endTime
		});
		playEventArray.push({
			type: PlayEventType.SpinnerSpin,
			hitObject: this,
			time: this.startTime,
			endTime: this.endTime
		});
	}
}