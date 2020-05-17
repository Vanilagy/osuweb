import { MathUtil } from "../util/math_util";
import { JobTaskInput, JobTask, JobTaskOutput, JobResponseWrapper } from "./worker";

interface JobPromiseWrapper {
	promise: Promise<unknown>,
	resolve: Function,
	reject: Function
}

let workerCount = MathUtil.clamp(navigator.hardwareConcurrency - 1, 1, 2); // Using more than two can kinda cause lag
//workerCount = 1;
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

export function startJob<T extends JobTask>(task: T, data?: JobTaskInput[T], transfer?: Transferable[], workerIndexOverride?: number): Promise<JobTaskOutput[T]> {
	let worker = workerPool[(workerIndexOverride ?? getNextRoundRobinIndex()) % workerPool.length];
	let jobId = currentJobId++;

	worker.postMessage({
		id: jobId,
		task: task,
		data: data
	}, transfer);

	let promiseResolve: Function, promiseReject: Function;
	let promise = new Promise<JobTaskOutput[T]>((resolve, reject) => {
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