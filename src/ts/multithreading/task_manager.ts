import { Task } from "./task";
import { removeItem } from "../util/misc_util";

export class TaskManager {
	private tasks: Task<any, any>[] = [];

	addTask(task: Task<any, any>) {
		this.tasks.push(task);

		if (task.showAutomatically) task.show();

		task.getResult().finally(() => {
			removeItem(this.tasks, task);
		});
	}

	removeTask(task: Task<any, any>) {
		removeItem(this.tasks, task);
	}

	/** Pauses all performance-intensive tasks. */
	pause() {
		for (let task of this.tasks) {
			if (task.isPerformanceIntensive) task.pause();
		}
	}

	/** Resumes all tasks. */
	resume() {
		for (let task of this.tasks) {
			// If the task isn't awaiting some other task to finish, resume it.
			if (!task.awaitingTask) task.resume();
		}
	}
}