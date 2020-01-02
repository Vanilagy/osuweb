import { Job, JobContainer, JobResponse } from "./job";
import { randomInArray } from "../util/misc_util";
import { MathUtil } from "../util/math_util";

let workerPool: Worker[] = [];
let currentJobId = 0;
let jobPromises: {
    promise: Promise<void>,
    resolve: Function,
    reject: Function,
    currentlyProcessing: number
}[] = [];

let currentRoundRobinIndex = 0;
function getNextRoundRobinIndex() {
	let value = currentRoundRobinIndex;

	currentRoundRobinIndex++;
	currentRoundRobinIndex %= workerPool.length;

	return value;
}

let workerCount = MathUtil.clamp(navigator.hardwareConcurrency - 1, 1, 2); // Using more than two can kinda cause lag

for (let i = 0; i < workerCount; i++) {
    let worker = new Worker('./js/worker_bundle.js');
    workerPool.push(worker);

    worker.onmessage = (e) => {
        let response = e.data as JobResponse;
        let thing = jobPromises[response.id];
        if (!thing) return;

        thing.currentlyProcessing--;

        if (thing.currentlyProcessing === 0) {
            jobPromises[response.id].resolve(response.data);
            jobPromises[response.id] = null;
        }
    };
}

export function uploadSliderData(jobContainers: JobContainer[]) {
    let worker = workerPool[0];

    let transferables: Transferable[] = [];
    let jobBatchId = currentJobId++;

    for (let j = 0; j < jobContainers.length; j++) {
        let container = jobContainers[j];

        transferables.push(...container.transfer as Transferable[]);
    }

    worker.postMessage({
        id: jobBatchId,
        jobs: jobContainers.map((a) => a.job)
    }, transferables);
}

export function processJob(jobContainer: JobContainer) {
    let worker = workerPool[getNextRoundRobinIndex()];
    let jobBatchId = currentJobId++;

    worker.postMessage({
        id: jobBatchId,
        jobs: [jobContainer.job]
    }, jobContainer.transfer as Transferable[]);

    let promiseResolve: Function, promiseReject: Function;
    let promise = new Promise<void>((resolve, reject) => {
        promiseResolve = resolve;
        promiseReject = reject;
    });

    jobPromises[jobBatchId] = {
        promise: promise,
        resolve: promiseResolve,
        reject: promiseReject,
        currentlyProcessing: 1
    };

    return promise;
}

export function processJobs(jobContainers: JobContainer[]) {
    let designations: JobContainer[][] = new Array(workerPool.length);
    for (let i = 0; i < designations.length; i++) designations[i] = [];

    for (let i = 0; i < jobContainers.length; i++) {
        let index = i % designations.length;
        //index = (Math.random() * designations.length) | 0;
        let bucket = designations[index];

        bucket.push(jobContainers[i]);
    }

    let jobBatchId = currentJobId++;

    for (let i = 0; i < designations.length; i++) {
        let jobContainers = designations[i];

        let worker = workerPool[i];
        let transferables: Transferable[] = [];

        for (let j = 0; j < jobContainers.length; j++) {
            let container = jobContainers[j];

            transferables.push(...container.transfer as Transferable[]);
        }

        worker.postMessage({
            id: jobBatchId,
            jobs: jobContainers.map((a) => a.job)
        }, transferables);
    }

    let promiseResolve: Function, promiseReject: Function;
    let promise = new Promise<void>((resolve, reject) => {
        promiseResolve = resolve;
        promiseReject = reject;
    });

    jobPromises[jobBatchId] = {
        promise: promise,
        resolve: promiseResolve,
        reject: promiseReject,
        currentlyProcessing: designations.length
    };

    return promise;
}