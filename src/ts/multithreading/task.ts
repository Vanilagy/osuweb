import { globalState } from "../global_state";
import { DrawableTask } from "../menu/notifications/drawable_task";

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
export abstract class Task<U, T> {
	public input: U;
	protected resultPromise: Promise<T>;
	private promiseResolve: (value?: T | PromiseLike<T>) => void;
	private promiseReject: (reason?: any) => void;
	/** Whether or not the promise has been resolved OR rejected. */
	protected settled = false;
	/** Whether or not the promise has been resolved. */
	protected resolved = false;
	public destroyed = false;
	/** The task we're waiting for to finish. Once it does, automatically start this task. */
	public awaitingTask	: Task<any, any> = null;

	constructor(input: U) {
		this.input = input;
		this.resultPromise = new Promise<T>((resolve, reject) => {
			this.promiseResolve = resolve;
			this.promiseReject = reject;
		});

		globalState.taskManager.addTask(this);
	}

	/** Describes what this task does. */
	abstract get descriptor(): string;
	/** Whether or not this task should automatically be shown in the notification panel. */
	abstract get showAutomatically(): boolean;
	/** If this is set to true, then this task will automatically be paused during gameplay. */
	abstract get isPerformanceIntensive(): boolean;
	/** Whether or not the task can be manually cancelled by the user while it's running. */
	abstract get canBeCancelled(): boolean;

	/** Initiate and start the task. */
	async start() {
		await this.init();
		this.resume();
	}

	/** Initiate the task. */
	abstract async init(): Promise<void>;
	/** Resume progress of the task where it last left off. If the task is currently running, calling this method should do absolutely nothing. */
	abstract resume(): void;
	/** Pause the task where it currently is. If the task is already paused, calling this method should do absolutely nothnig. */
	abstract pause(): void;
	
	abstract isPaused(): boolean;

	protected setResult(result: T) {
		if (this.settled) return;
		
		this.promiseResolve(result);
		this.settled = true;
		this.resolved = true;
		this.onEnd();
	}

	protected reject(reason?: any) {
		if (this.settled) return;

		this.promiseReject(reason);
		this.settled = true;
		this.onEnd();
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

	/** Returns a more individual message describing the progress of the task, better than getProgress could. */
	getProgressMessage(): string {
		return null;
	}

	waitFor(task: Task<any, any>) {
		this.awaitingTask = task;

		// Set this task to start automatically once the other task is done
		task.getResult().finally(() => {
			this.awaitingTask = null;
			this.start();
		});
	}

	/** Pauses the task and destroys promise callbacks. */
	destroy() {
		if (this.destroyed) return;

		this.pause();
		this.promiseResolve = this.promiseReject = null;
		this.destroyed = true;
		
		globalState.taskManager.removeTask(this);
		this.onEnd();
		this.onDestroy();
	}

	/** Display the task in the notification panel. */
	show() {
		let drawable = new DrawableTask(globalState.notificationPanel, this);
		globalState.notificationPanel.addEntryToSection(drawable, "tasks");
	}

	/** Is called when the task is either completed or cancelled. */
	onEnd() {}

	/** Is called when the task is destroyed. */
	onDestroy() {}
}