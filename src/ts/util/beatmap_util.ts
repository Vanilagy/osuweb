import { VirtualFile } from "../file_system/virtual_file";
import { BeatmapDifficulty } from "../datamodel/beatmap_difficulty";
import { DifficultyAttributes, DifficultyCalculator } from "../datamodel/difficulty/difficulty_calculator";
import { Beatmap } from "../datamodel/beatmap";
import { ProcessedBeatmap } from "../datamodel/processed/processed_beatmap";

export interface ExtendedBeatmapData {
	title: string,
	artist: string,
	creator: string,
	version: string,
	tags: string,
	bpmMin: number,
	bpmMax: number,
	objectCount: number,
	circleCount: number,
	sliderCount: number,
	spinnerCount: number,
	difficulty: Exclude<BeatmapDifficulty, Function>,
	difficultyAttributes: DifficultyAttributes,
	playableLength: number,
	msPerBeatTimings: number[][]
}

export abstract class BeatmapUtil {
	static async getExtendedBeatmapData(beatmapFile: VirtualFile): Promise<ExtendedBeatmapData> {
		let text = await beatmapFile.readAsText();

		let beatmap = new Beatmap({
			text: text,
			beatmapSet: null,
			metadataOnly: false
		});
		let processedBeatmap = new ProcessedBeatmap(beatmap, true);
		processedBeatmap.init();
		processedBeatmap.applyStackShift();

		let difficultyAttributes = DifficultyCalculator.calculate(processedBeatmap, new Set(), 1.0);

		let msPerBeatTimings: number[][] = [];
		for (let i = 0; i < beatmap.timingPoints.length; i++) {
			let timingPoint = beatmap.timingPoints[i];
			if (!timingPoint.inheritable) continue;

			msPerBeatTimings.push([timingPoint.offset, timingPoint.msPerBeat]);
		}

		return {
			title: beatmap.title,
			artist: beatmap.artist,
			creator: beatmap.creator,
			version: beatmap.version,
			tags: beatmap.tags,
			bpmMin: beatmap.bpmMin,
			bpmMax: beatmap.bpmMax,
			objectCount: beatmap.hitObjects.length,
			circleCount: beatmap.circleCount,
			sliderCount: beatmap.sliderCount,
			spinnerCount: beatmap.spinnerCount,
			difficulty: beatmap.difficulty,
			difficultyAttributes: difficultyAttributes,
			playableLength: processedBeatmap.getPlayableLength(),
			msPerBeatTimings: msPerBeatTimings
		};
	}
}