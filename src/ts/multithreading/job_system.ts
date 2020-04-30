import { JobTask, JobResponseWrapper, GetExtendedBeatmapDataRequest, GetImageBitmapRequest, GetBasicBeatmapDataRequest } from "./job";
import { MathUtil } from "../util/math_util";
import { ExtendedBeatmapData, BasicBeatmapData } from "../util/beatmap_util";

interface JobPromiseWrapper {
	promise: Promise<unknown>,
	resolve: Function,
	reject: Function
}

let workerCount = MathUtil.clamp(navigator.hardwareConcurrency - 1, 1, 2); // Using more than two can kinda cause lag
let workerPool: Worker[] = [];
let currentJobId = 0;
let jobPromises: Map<number, JobPromiseWrapper> = new Map();

let currentRoundRobinIndex = 0;
function getNextRoundRobinIndex() {
	let value = currentRoundRobinIndex;

	currentRoundRobinIndex++;
	currentRoundRobinIndex %= workerPool.length;

	return value;
}

for (let i = 0; i < workerCount; i++) {
	let worker = new Worker('./js/worker_bundle.js');
	workerPool.push(worker);

	worker.onmessage = (e) => {
		let response = e.data as JobResponseWrapper;
		let promiseWrapper = jobPromises.get(response.id);
		if (!promiseWrapper) return;

		if (response.status === 'fulfilled') {
			promiseWrapper.resolve(response.data);
		} else if (response.status === 'rejected') {
			promiseWrapper.reject(response.reason);
		}

		jobPromises.delete(response.id);
	};
}

export function startJob(task: JobTask.GetBasicBeatmapData, data: GetBasicBeatmapDataRequest["data"]): Promise<BasicBeatmapData>;
export function startJob(task: JobTask.GetExtendedBetamapData, data: GetExtendedBeatmapDataRequest["data"]): Promise<ExtendedBeatmapData>;
export function startJob(task: JobTask.GetImageBitmap, data: GetImageBitmapRequest["data"]): Promise<ImageBitmap>;
export function startJob<T>(task: JobTask, data?: any, transfer?: Transferable[]): Promise<T> {
	let worker = workerPool[getNextRoundRobinIndex()];
	let jobId = currentJobId++;

	worker.postMessage({
		id: jobId,
		task: task,
		data: data
	}, transfer);

	let promiseResolve: Function, promiseReject: Function;
	let promise = new Promise<T>((resolve, reject) => {
		promiseResolve = resolve;
		promiseReject = reject;
	});

	jobPromises.set(jobId, {
		promise: promise,
		resolve: promiseResolve,
		reject: promiseReject
	});

	return promise;
}