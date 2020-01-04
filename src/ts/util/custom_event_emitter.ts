// Like EventTarget, but without the event loop bullshittery.
export class CustomEventEmitter {
    private listeners: Map<string, Function[]> = new Map();

    addListener(name: string, func: (data?: any) => any) {
		let listeners = this.listeners.get(name);
		if (!listeners) {
			listeners = [];
			this.listeners.set(name, listeners);
		}
		
        listeners.push(func);
    }

    removeListener(name: string, func: (data?: any) => any) {
        let listeners = this.listeners.get(name);
        if (!listeners) return;

        let index = listeners.indexOf(func);
        if (index === -1) return;

        listeners.splice(index, 1);
    }

    emit(name: string, data?: any) {
        let listeners = this.listeners.get(name);
        if (!listeners) return;

        for (let i = 0; i < listeners.length; i++) {
            listeners[i](data);
        }
    }
}