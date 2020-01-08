import { DifficultyAttributes } from "../datamodel/difficulty/difficulty_calculator";
import { NonTrivialBeatmapMetadata } from "../datamodel/beatmap";

export enum JobTask {
	GetBeatmapMetadata,
	GetImageBitmap
}

interface JobMessageBase {
	id: number,
	task: JobTask,
	data: any,
	responseType?: any // DO NOT ASSIGN TO THIS ATTRIBUTE. This is simply a TypeScript hack.
};

export type JobResponseWrapper = {
	id: number,
	status: 'fulfilled',
	data: any
} | {
	id: number,
	status: 'rejected',
	reason: any
};

export interface GetBeatmapMetadataRequest extends JobMessageBase {
	task: JobTask.GetBeatmapMetadata,
	data: {
		beatmapResource: Blob
	},
	responseType?: GetBeatmapMetadataResponse
}

export interface GetBeatmapMetadataResponse {
	metadata: NonTrivialBeatmapMetadata,
	difficulty: DifficultyAttributes
}

export interface GetImageBitmapRequest extends JobMessageBase {
	task: JobTask.GetImageBitmap,
	data: {
		imageResource: Blob,
		resizeWidth?: number,
		resizeHeight?: number
	},
	responseType?: GetImageBitmapResponse
}

export interface GetImageBitmapResponse {
	bitmap: ImageBitmap
}

export type JobRequestMessage = GetBeatmapMetadataRequest | GetImageBitmapRequest;