import { CustomEventEmitter } from "../util/custom_event_emitter";
import { modMultipliers } from "../datamodel/mods";

export interface TaskStatus {
	settled: boolean,
	done: boolean,
	error: boolean
}

export interface TaskProgress {
	completion?: number,
	dataCompleted?: number,
	dataTotal?: number
}

/** Represents an asynchronous task with certain interfaces like pausing, resuming and getting current status. */
export abstract class Task <U, T> extends CustomEventEmitter<{done: T, error: any}> {
	/** Describes what this task does. Should be overridden! */
	public descriptor = "Processing task";
	protected input: U;
	protected resultPromise: Promise<T>;
	private promiseResolve: (value?: T | PromiseLike<T>) => void;
	private promiseReject: (reason?: any) => void;
	/** Whether or not the promise has been resolved OR rejected. */
	protected settled = false;
	/** Whether or not the promise has been resolved. */
	protected resolved = false;
	public destroyed = false;

	constructor(input: U) {
		super();

		this.input = input;
		this.resultPromise = new Promise<T>((resolve, reject) => {
			this.promiseResolve = resolve;
			this.promiseReject = reject;
		});
	}

	/** Initiate and start the task. */
	async start() {
		await this.init();
		this.resume();
	}

	/** Initiate the task. */
	abstract async init(): Promise<void>;
	/** Resume progress of the task where it last left off. */
	abstract resume(): void;
	/** Pause the task where it currently is. */
	abstract pause(): void;

	protected setResult(result: T) {
		if (this.settled) return;
		
		this.promiseResolve(result);
		this.emit('done', result);
		this.settled = true;
		this.resolved = true;
	}

	protected reject(reason?: any) {
		if (this.settled) return;

		this.promiseReject(reason);
		this.emit('error', reason);
		this.settled = true;
	}

	getResult() {
		return this.resultPromise;
	}

	getStatus(): TaskStatus {
		return {
			settled: this.settled,
			done: this.resolved,
			error: this.settled && !this.resolved
		};
	}

	getProgress(): TaskProgress {
		return null;
	}

	/** Destroy this task, allowing it to be GC'd. */
	destroy() {
		this.pause();
		this.removeAllListeners();
		this.destroyed = true;
	}
}