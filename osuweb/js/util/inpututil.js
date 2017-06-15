var InputUtil = {
    mouseXElement: function(mouseX, element) {
        return mouseX - element.getBoundingClientRect().left;
    },
    mouseYElement: function(mouseY, element) {
        return mouseY - element.getBoundingClientRect().top;
    },
    getUserPlayfieldCoords: function() {
        return {
            x: (mouseX - playareaBoundingRectLeft) / pixelRatio - currentPlay.marginWidth,
            y: (mouseY - playareaBoundingRectTop) / pixelRatio - currentPlay.marginHeight
        }
    }
}

var mouseX = Math.round(document.width / 2), mouseY = Math.round(document.height / 2);

document.addEventListener("mousemove", function(event) {
    mouseX = event.clientX;
    mouseY = event.clientY;
});

var inputButtonStates = {
    m1: false,
    m2: false,
    k1: false,
    k2: false
};
var holding = false;

var keyCodeBindings = {
    88: "k1",
    89: "k2"
}

function press() {
    if (currentPlay) {
        var userPlayfieldCoords = InputUtil.getUserPlayfieldCoords();
        
        for (var id in currentPlay.onScreenHitObjects) {
            var hitObject = currentPlay.onScreenHitObjects[id];
            
            if (hitObject.hittable) {
                var dist = Math.hypot(userPlayfieldCoords.x - hitObject.x, userPlayfieldCoords.y - hitObject.y);
                
                if (dist <= csOsuPixel / 2) {
                    var timeDelta = Math.abs(audioCurrentTime - hitObject.time);
                    var score = TimingUtil.getScoreFromHitDelta(timeDelta);
                    
                    if (score >= 50) {
                        if (hitObject.type == "circle") {
                            currentPlay.score.addScore(score, false);
                        } else {
                            currentPlay.score.addScore(30, true);
                        }
                        hitObject.hit(true);
                    } else {
                        if (hitObject.type == "circle") {
                            currentPlay.score.addScore(0, false, true);
                        } else {
                            currentPlay.score.addScore(0, true, true);
                        }
                        
                        hitObject.hit(false);
                    }
                    
                    break;
                }
            }
        }
    }
}

function updateHoldingState() {
    holding = inputButtonStates["m1"] || inputButtonStates["m2"] || inputButtonStates["k1"] || inputButtonStates["m2"];
}

function changeMouseButtonState(isLeft, bool) {
    var newPress = false;
    if (isLeft && inputButtonStates["k1"] == false && inputButtonStates["m1"] != bool) {
        inputButtonStates["m1"] = bool;
        newPress = true;
    } else if (!isLeft && inputButtonStates["k2"] == false && inputButtonStates["m1"] != false) {
        inputButtonStates["m2"] = bool;
        newPress = true;
    }
    
    updateHoldingState();
    if (newPress && bool) {
        press();
    }
}
function changeKeyButtonState(keycode, bool) {
    var newPress = false;
    if (keyCodeBindings[keycode] == "k1" && inputButtonStates["m1"] == false && inputButtonStates["k1"] != bool) {
        inputButtonStates["k1"] = bool;
        newPress = true;
    } else if (keyCodeBindings[keycode] == "k2" && inputButtonStates["m2"] == false && inputButtonStates["k2"] != bool) {
        inputButtonStates["k2"] = bool;
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