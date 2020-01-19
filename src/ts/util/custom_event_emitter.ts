import { removeItem, pushItemUnique } from "./misc_util";

// Like EventTarget, but without the event loop bullshittery.
export class CustomEventEmitter <T extends {} = any> {
	private listeners: Map<keyof T, ((data?: T[keyof T]) => any)[]> = new Map();

	addListener<K extends Extract<keyof T, string>>(name: K, func: (data?: T[K]) => any) {
		let listeners = this.listeners.get(name);
		if (!listeners) {
			listeners = [];
			this.listeners.set(name, listeners);
		}
		
		pushItemUnique(listeners, func);
	}

	removeListener<K extends Extract<keyof T, string>>(name: K, func: (data?: T[K]) => any) {
		let listeners = this.listeners.get(name);
		if (!listeners) return;

		removeItem(listeners, func);
	}

	emit<K extends Extract<keyof T, string>>(name: K, data?: T[K]) {
		let listeners = this.listeners.get(name);
		if (!listeners) return;

		for (let i = 0; i < listeners.length; i++) {
			listeners[i](data);
		}
	}
}