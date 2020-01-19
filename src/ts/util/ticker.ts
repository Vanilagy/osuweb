import { addRenderingTask } from "../visuals/rendering";
import { removeItem, pushItemUnique } from "./misc_util";

export type TickingTask = (now?: number, dt?: number) => any;
let tickingTasks: TickingTask[] = [];
let lastTickTime: number = null;

export function addTickingTask(task: TickingTask) {
	pushItemUnique(tickingTasks, task);
}

export function removeTickingTask(task: TickingTask) {
	removeItem(tickingTasks, task);
}

// Should run as often as possible.
export function tickAll(now?: number) {
	let dt = 1000 / 250;
	now = (now === undefined)? performance.now() : now;

	if (lastTickTime !== null) {
		dt = now - lastTickTime;
	}
	lastTickTime = now;

	for (let i = 0; i < tickingTasks.length; i++) {
		tickingTasks[i](now, dt);
	}
}

setInterval(tickAll, 0);
addRenderingTask((now) => tickAll(now));