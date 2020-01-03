import { Point, clonePoint } from "../util/point";
import { CustomEventEmitter } from "../util/custom_event_dispatcher";
import { normalizeWheelEvent } from "../util/misc_util";

let currentMousePosition: Point = {
    x: window.innerWidth / 2, // Before any events, just center the mouse
    y: window.innerHeight / 2
};

export function getCurrentMousePosition() {
    return clonePoint(currentMousePosition);
}

window.onmousemove = (e: MouseEvent) => {
    currentMousePosition.x = e.clientX;
    currentMousePosition.y = e.clientY;

    inputEventEmitter.emit('mouseMove');
};

const PREVENT_NATIVE_CONTEXT_MENU = true;

enum KeyCode {
    X = 88,
    Y = 89
}

enum FunctionalInput {
    GameKeyA,
    GameKeyB,
    GameMouseButtonA,
    GameMouseButtonB
}

enum MouseButton {
    Left = 0,
    Right = 2
}

const gameKeys = [FunctionalInput.GameKeyA, FunctionalInput.GameKeyB];

const functionalInputState: { [key: string]: boolean } = {};

for (let key in FunctionalInput) {
    if (isNaN(Number(key))) continue; // Skip the text 

    functionalInputState[key] = false;
}

let keyCodeMappings = new Map<KeyCode, FunctionalInput>();
keyCodeMappings.set(KeyCode.Y, FunctionalInput.GameKeyA);
keyCodeMappings.set(KeyCode.X, FunctionalInput.GameKeyB);

let mouseButtonMappings = new Map<MouseButton, FunctionalInput>();
mouseButtonMappings.set(MouseButton.Left, FunctionalInput.GameMouseButtonA);
mouseButtonMappings.set(MouseButton.Right, FunctionalInput.GameMouseButtonB);

window.addEventListener('keydown', (e) => {
	let keyCode = e.keyCode;

    let mappedFunctionalInput = keyCodeMappings.get(keyCode);
	if (mappedFunctionalInput === undefined) return;

    if (functionalInputState[mappedFunctionalInput] !== true) {
        functionalInputState[mappedFunctionalInput] = true;
        if (gameKeys.includes(mappedFunctionalInput)) {
            handleGameButtonDown(mappedFunctionalInput);
        }
    }
});

window.addEventListener('keyup', (e) => {
    let keyCode = e.keyCode;

    let mappedFunctionalInput = keyCodeMappings.get(keyCode);
    if (mappedFunctionalInput === undefined) return;

    if (functionalInputState[mappedFunctionalInput] !== false) {
        functionalInputState[mappedFunctionalInput] = false;
    }
});

// TODO: Eventually add touch support. Eventually.
window.addEventListener('mousedown', (e) => {
    let button = e.button;

    let mappedFunctionalInput = mouseButtonMappings.get(button);
    if (mappedFunctionalInput === undefined) return;

    if (functionalInputState[mappedFunctionalInput] !== true) {
        functionalInputState[mappedFunctionalInput] = true;
        handleGameButtonDown(mappedFunctionalInput);
    }
});

window.addEventListener('mouseup', (e) => {
    let button = e.button;

    let mappedFunctionalInput = mouseButtonMappings.get(button);
    if (mappedFunctionalInput === undefined) return;

    if (functionalInputState[mappedFunctionalInput] !== false) {
        functionalInputState[mappedFunctionalInput] = false;
    }
});

// Prevent context menu from opening on right click
window.addEventListener('contextmenu', (e) => {
    if (PREVENT_NATIVE_CONTEXT_MENU) e.preventDefault(); 
});

function handleGameButtonDown(button: FunctionalInput) {
    switch (button) {
        case FunctionalInput.GameKeyA: {
            // Keys can't cause a game button press if their respective mouse version is being pressed right now
            if (functionalInputState[FunctionalInput.GameMouseButtonA] === false) {
                emitGameButtonDown();
            }
        }; break;
        case FunctionalInput.GameKeyB: {
            if (functionalInputState[FunctionalInput.GameMouseButtonB] === false) {
                emitGameButtonDown();
            }
        }; break;
        case FunctionalInput.GameMouseButtonA: {
            // Similarly, mouse button can't cause a game button press if their respective key version is being pressed right now
            if (functionalInputState[FunctionalInput.GameKeyA] === false) {
                emitGameButtonDown();
            }
        }; break;
        case FunctionalInput.GameMouseButtonB: {
            if (functionalInputState[FunctionalInput.GameKeyB] === false) {
                emitGameButtonDown();
            }
        }; break;
    }
}

function emitGameButtonDown() {
    inputEventEmitter.emit('gameButtonDown');
}

export function anyGameButtonIsPressed() {
    return functionalInputState[FunctionalInput.GameKeyA] ||
        functionalInputState[FunctionalInput.GameKeyB] ||
        functionalInputState[FunctionalInput.GameMouseButtonA] ||
        functionalInputState[FunctionalInput.GameMouseButtonB];
}

window.addEventListener('wheel', (ev) => {
	inputEventEmitter.emit('wheel', normalizeWheelEvent(ev));
});

window.addEventListener('mousedown', (ev) => {
	inputEventEmitter.emit('mousedown', ev);
});

export let inputEventEmitter = new CustomEventEmitter();