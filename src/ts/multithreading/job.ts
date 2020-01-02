export enum JobTask {
	GetBeatmapMetadata
}

export interface Job {
    task: JobTask,
    id?: number
}

export interface JobContainer {
    job: Job,
    transfer: (Transferable | OffscreenCanvas)[]
};

export interface JobMessageWrapper {
    id: number,
    jobs: Job[]
};

export interface JobResponse {
	id: number,
	data: any
}

export interface GetBeatmapMetadataJob extends Job {
	beatmapFile: File
}