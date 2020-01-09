import { ExtendedBeatmapData } from "../datamodel/beatmap_util";

export enum JobTask {
	GetExtendedBetamapData,
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
	task: JobTask.GetExtendedBetamapData,
	data: {
		beatmapResource: Blob
	},
	responseType: ExtendedBeatmapData
}

export interface GetImageBitmapRequest extends JobMessageBase {
	task: JobTask.GetImageBitmap,
	data: {
		imageResource: Blob,
		resizeWidth?: number,
		resizeHeight?: number
	},
	responseType?: ImageBitmap
}

export type JobRequestMessage = GetBeatmapMetadataRequest | GetImageBitmapRequest;