import { DifficultyAttributes } from "../datamodel/difficulty/difficulty_calculator";
import { NonTrivialBeatmapMetadata } from "../datamodel/beatmap";

export enum JobTask {
	GetBeatmapMetadata
}

interface JobMessageBase {
	id: number,
	task: JobTask,
	data: any,
	responseType?: any // DO NOT ASSIGN TO THIS ATTRIBUTE. This is simply a TypeScript hack.
};

export interface GetBeatmapMetadataRequest extends JobMessageBase {
	task: JobTask.GetBeatmapMetadata,
	data: {
		beatmapResource: Blob
	},
	responseType?: GetBeatmapMetadataResponse
}

export type JobRequestMessage = GetBeatmapMetadataRequest;

export type JobResponseWrapper = {
	id: number,
	status: 'fulfilled',
	data: any
} | {
	id: number,
	status: 'rejected',
	reason: any
};

export interface GetBeatmapMetadataResponse {
	metadata: NonTrivialBeatmapMetadata,
	difficulty: DifficultyAttributes
}