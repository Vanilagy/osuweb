import { VirtualFile } from "../file_system/virtual_file";
import { DifficultyAttributes, DifficultyCalculator } from "../datamodel/difficulty/difficulty_calculator";
import { ProcessedBeatmap } from "../datamodel/processed/processed_beatmap";
import { createSearchableString } from "./misc_util";
import { BeatmapDifficulty } from "../datamodel/beatmap/beatmap_difficulty";
import { BeatmapParser } from "../datamodel/beatmap/beatmap_parser";

/** First value is when the first beat begins. Second value is the time in millisecond between beats. */
type MsPerBeatTiming = [number, number];

export interface BasicBeatmapData {
	title: string,
	titleUnicode: string,
	artist: string,
	artistUnicode: string,
	creator: string,
	version: string,
	tags: string,
	imageName: string,
	audioName: string,
	audioPreviewTime: number
}

export interface ExtendedBeatmapData {
	title: string,
	artist: string,
	creator: string,
	version: string,
	tags: string,
	bpmMin: number,
	bpmMax: number,
	/** The most frequent BPM. */
	bpmMain: number,
	objectCount: number,
	circleCount: number,
	sliderCount: number,
	spinnerCount: number,
	difficulty: Exclude<BeatmapDifficulty, Function>,
	difficultyAttributes: DifficultyAttributes,
	playableLength: number,
	msPerBeatTimings: MsPerBeatTiming[],
	imageName: string,
	audioName: string,
	audioPreviewTime: number
}

export abstract class BeatmapUtil {
	static async getBasicBeatmapData(beatmapFile: VirtualFile): Promise<BasicBeatmapData> {
		let text = await beatmapFile.readAsText();

		let beatmap = BeatmapParser.parse(text, null, true);

		return {
			title: beatmap.title,
			titleUnicode: beatmap.titleUnicode,
			artist: beatmap.artist,
			artistUnicode: beatmap.artistUnicode,
			creator: beatmap.creator,
			version: beatmap.version,
			tags: beatmap.tags,
			imageName: beatmap.getBackgroundImageName(),
			audioName: beatmap.audioFilename,
			audioPreviewTime: beatmap.getAudioPreviewTimeInSeconds()
		};
	}

	static async getExtendedBeatmapData(beatmapFile: VirtualFile): Promise<ExtendedBeatmapData> {
		let text = await beatmapFile.readAsText();

		let beatmap = BeatmapParser.parse(text, null, false);
		let processedBeatmap = new ProcessedBeatmap(beatmap, true);
		processedBeatmap.init();
		processedBeatmap.applyStackShift();

		let difficultyAttributes = DifficultyCalculator.calculate(processedBeatmap, new Set(), 1.0);

		let msPerBeatTimings: MsPerBeatTiming[] = [];
		for (let i = 0; i < beatmap.timingPoints.length; i++) {
			let timingPoint = beatmap.timingPoints[i];
			if (!timingPoint.inheritable) continue;

			msPerBeatTimings.push([timingPoint.offset, timingPoint.msPerBeat]);
		}

		processedBeatmap.getMostFrequentBpm();

		return {
			title: beatmap.title,
			artist: beatmap.artist,
			creator: beatmap.creator,
			version: beatmap.version,
			tags: beatmap.tags,
			bpmMin: beatmap.bpmMin,
			bpmMax: beatmap.bpmMax,
			bpmMain: processedBeatmap.getMostFrequentBpm(),
			objectCount: beatmap.hitObjects.length,
			circleCount: beatmap.circleCount,
			sliderCount: beatmap.sliderCount,
			spinnerCount: beatmap.spinnerCount,
			difficulty: beatmap.difficulty,
			difficultyAttributes: difficultyAttributes,
			playableLength: processedBeatmap.getPlayableLength(),
			msPerBeatTimings: msPerBeatTimings,
			imageName: beatmap.getBackgroundImageName(),
			audioName: beatmap.audioFilename,
			audioPreviewTime: beatmap.getAudioPreviewTimeInSeconds()
		};
	}
}