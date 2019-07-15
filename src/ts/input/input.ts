import { Point } from "../util/point";
import { gameState } from "../game/game_state";

export let currentMousePosition: Point = {
    x: window.innerWidth / 2, // Before any events, just center the mouse
    y: window.innerHeight / 2
};

window.onmousemove = (e) => {
    currentMousePosition.x = e.clientX;
    currentMousePosition.y = e.clientY;

    // Ergh. Unclean. Input shouldn't know about Play.
    if (gameState.currentPlay) {
        gameState.currentPlay.handleMouseMove();
    }
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
            handleGameButtonPress(mappedFunctionalInput);
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

// Eventually add touch support. Eventually.
window.addEventListener('mousedown', (e) => {
    let button = e.button;

    let mappedFunctionalInput = mouseButtonMappings.get(button);
    if (mappedFunctionalInput === undefined) return;

    if (functionalInputState[mappedFunctionalInput] !== true) {
        functionalInputState[mappedFunctionalInput] = true;
        handleGameButtonPress(mappedFunctionalInput);
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

function handleGameButtonPress(button: FunctionalInput) {
    switch (button) {
        case FunctionalInput.GameKeyA: {
            // Keys can't cause a game button press if their respective mouse version is being pressed right now
            if (functionalInputState[FunctionalInput.GameMouseButtonA] === false) {
                emitGameButtonPress();
            }
        }; break;
        case FunctionalInput.GameKeyB: {
            if (functionalInputState[FunctionalInput.GameMouseButtonB] === false) {
                emitGameButtonPress();
            }
        }; break;
        case FunctionalInput.GameMouseButtonA: {
            // Similarly, mouse button can't cause a game button press if their respective key version is being pressed right now
            if (functionalInputState[FunctionalInput.GameKeyA] === false) {
                emitGameButtonPress();
            }
        }; break;
        case FunctionalInput.GameMouseButtonB: {
            if (functionalInputState[FunctionalInput.GameKeyB] === false) {
                emitGameButtonPress();
            }
        }; break;
    }
}

function emitGameButtonPress() {
    // TEMP! This isn't clean. This doesn't isolate the input class.
    if (gameState.currentPlay) {
        gameState.currentPlay.handleButtonPress();
    }
}

export function anyGameButtonIsPressed() {
    return functionalInputState[FunctionalInput.GameKeyA] ||
        functionalInputState[FunctionalInput.GameKeyB] ||
        functionalInputState[FunctionalInput.GameMouseButtonA] ||
        functionalInputState[FunctionalInput.GameMouseButtonB];
}