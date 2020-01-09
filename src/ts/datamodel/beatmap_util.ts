import { VirtualFile } from "../file_system/virtual_file";
import { Beatmap } from "./beatmap";
import { ProcessedBeatmap } from "./processed/processed_beatmap";
import { DifficultyCalculator, DifficultyAttributes } from "./difficulty/difficulty_calculator";
import { BeatmapDifficulty } from "./beatmap_difficulty";

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
	playableLength: number
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
			playableLength: processedBeatmap.getPlayableLength()
		};
	}
}