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

var inputData = {
    mouseX: Math.round(document.width / 2),
    mouseY: Math.round(document.height / 2),
    inputButtonStates: {
        m1: false,
        m2: false,
        k1: false,
        k2: false
    },
    isHolding: false
};

var keyCodeBindings = {
    88: "k1",
    89: "k2"
};

document.addEventListener("mousemove", function(event) {
    inputData.mouseX = event.clientX;
    inputData.mouseY = event.clientY;
});

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
    } else if (!isLeft && inputData.inputButtonStates["k2"] == false && inputData.inputButtonStates["m1"] != false) {
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
document.addEventListener("mousedown", function() {
    changeMouseButtonState(true, true);
});
document.addEventListener("mouseup", function() {
    changeMouseButtonState(true, false);
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