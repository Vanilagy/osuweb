import { VirtualFile } from "../file_system/virtual_file";
import { BeatmapUtil } from "../util/beatmap_util";
import { UnPromisify } from "../util/misc_util";

export interface JobRequestMessage {
	id: number,
	task: JobTask,
	data: JobTaskInput[JobTask]
};

export type JobResponseWrapper = {
	id: number,
	status: 'fulfilled',
	data: JobTaskOutput[JobTask]
} | {
	id: number,
	status: 'rejected',
	reason: any
};

const buildTasks = <
    Tasks extends Record<string, (data: any, transfer?: Transferable[]) => Promise<any>>
>(tasks: Tasks) => tasks;

export type JobTask = keyof typeof tasks;
export type JobTaskInput = {
	[K in JobTask]: Parameters<typeof tasks[K]>[0]
};
export type JobTaskOutput = {
	[K in JobTask]: UnPromisify<ReturnType<typeof tasks[K]>>
};

let queue: MessageEvent[] = [];
async function shiftQueue() {
	let e = queue[0];

	let msg = e.data as JobRequestMessage;

	try {
		let transfer: Transferable[] = [];
		let response = await tasks[msg.task](msg.data as any, transfer);

		self.postMessage({
			id: msg.id,
			status: 'fulfilled',
			data: response
		} as JobResponseWrapper, transfer);
	} catch (e) {
		self.postMessage({
			id: msg.id,
			status: 'rejected',
			reason: e
		} as JobResponseWrapper);
	}

	queue.shift();
	if (queue.length > 0) shiftQueue();
}

self.onmessage = async (e: MessageEvent) => {
	queue.push(e);
	if (queue.length === 1) shiftQueue();
};

const tasks = buildTasks({
	getBasicBeatmapData: (blob: Blob) => {
		let file = VirtualFile.fromBlob(blob, null);
		return BeatmapUtil.getBasicBeatmapData(file);
	},
	getExtendedBetamapData: (blob: Blob) => {
		let file = VirtualFile.fromBlob(blob, null);
		return BeatmapUtil.getExtendedBeatmapData(file);
	},
	getImageBitmap: async (data: {
		resource: Blob,
		resizeWidth: number,
		resizeHeight: number
	}, transfer) => {
		let bitmap = await (createImageBitmap as any)(data.resource, {
			resizeWidth: data.resizeWidth,
			resizeHeight: data.resizeHeight
		});

		transfer.push(bitmap);
		return bitmap;
	}
});