var cursorElement = document.getElementById("cursor");

var InputUtil = {
    mouseXElement: function(mouseX, element) {
        return mouseX - element.getBoundingClientRect().left;
    },
    mouseYElement: function(mouseY, element) {
        return mouseY - element.getBoundingClientRect().top;
    },
    getUserPlayfieldCoords: function() {
        return {
            x: (inputData.mouseX - playareaBoundingRectLeft) / pixelRatio - currentPlay.marginWidth,
            y: (inputData.mouseY - playareaBoundingRectTop) / pixelRatio - currentPlay.marginHeight
        }
    }
};

document.addEventListener("mousemove", function(event) {
    inputData.mouseX = event.clientX;
    inputData.mouseY = event.clientY;
    inputData.lastMousePosUpdateTime = window.performance.now();
    if (currentPlay) {
        inputData.userPlayfieldCoords = InputUtil.getUserPlayfieldCoords();
    }
    refreshCursor();

});
document.addEventListener("mousedown", function(e) {
    console.log("down: "+e.button);
    if(e.button == 0) changeMouseButtonState(true, true);
    else if(e.button == 2) changeMouseButtonState(false, true);
});
document.addEventListener("mouseup", function(e) {
    console.log("up: "+e.button);
    if(e.button == 0) changeMouseButtonState(true, false);
    else if(e.button == 2) changeMouseButtonState(false, false);
});
document.addEventListener("contextmenu", function(e) {
    e.preventDefault();
});
document.addEventListener("keydown", function(event) {
    if (keyCodeBindings[event.keyCode]) {
        changeKeyButtonState(event.keyCode, true);
    }
});
document.addEventListener("keyup", function(event) {
    if (keyCodeBindings[event.keyCode]) {
        changeKeyButtonState(event.keyCode, false);
    }
});

var inputData = {
    mouseX: Math.round(document.width / 2),
    mouseY: Math.round(document.height / 2),
    inputButtonStates: {
        m1: false,
        m2: false,
        k1: false,
        k2: false
    },
    isHolding: false,
    lastMousePosUpdateTime: window.performance.now(),
    userPlayfieldCoords: null
};

var keyCodeBindings = {
    88: "k1",
    89: "k2"
};

function refreshCursor() {
    cursorElement.style.transform = "translate(calc(" + inputData.mouseX + "px - 50%), calc(" + inputData.mouseY + "px - 50%))";
}

function press() {
    if (currentPlay) {
        currentPlay.registerClick();
    }
}

function updateHoldingState() {
    inputData.isHolding = inputData.inputButtonStates["m1"] || inputData.inputButtonStates["m2"] || inputData.inputButtonStates["k1"] || inputData.inputButtonStates["m2"];
}

function changeMouseButtonState(isLeft, bool) {
    var newPress = false;
    if (isLeft && inputData.inputButtonStates["k1"] == false && inputData.inputButtonStates["m1"] != bool) {
        inputData.inputButtonStates["m1"] = bool;
        newPress = true;
    } else if (!isLeft && inputData.inputButtonStates["k2"] == false && inputData.inputButtonStates["m2"] != bool) {
        inputData.inputButtonStates["m2"] = bool;
        newPress = true;
    }
    
    updateHoldingState();
    if (newPress && bool) {
        press();
    }
}
function changeKeyButtonState(keycode, bool) {
    var newPress = false;
    if (keyCodeBindings[keycode] == "k1" && inputData.inputButtonStates["m1"] == false && inputData.inputButtonStates["k1"] != bool) {
        inputData.inputButtonStates["k1"] = bool;
        newPress = true;
    } else if (keyCodeBindings[keycode] == "k2" && inputData.inputButtonStates["m2"] == false && inputData.inputButtonStates["k2"] != bool) {
        inputData.inputButtonStates["k2"] = bool;
        newPress = true;
    }

    updateHoldingState();
    if (newPress && bool) {
        press();
    }
}