// Like EventTarget, but without the event loop bullshittery.
export class CustomEventEmitter {
    private listeners: { [key: string]: Function[] } = {};

    addListener(name: string, func: (data?: any) => any) {
        let listeners = this.listeners[name] || (this.listeners[name] = []);
        listeners.push(func);
    }

    removeListener(name: string, func: (data?: any) => any) {
        let listeners = this.listeners[name];
        if (!listeners) return;

        let index = listeners.findIndex((a) => a === func);
        if (index === -1) return;

        listeners.splice(index, 1);
    }

    emit(name: string, data?: any) {
        let listeners = this.listeners[name];
        if (!listeners) return;

        for (let i = 0; i < listeners.length; i++) {
            listeners[i](data);
        }
    }
}