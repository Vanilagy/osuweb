var playareaDom = document.getElementById("playarea");
var objectContainerDom = document.getElementById("objectContainer");

var maximumTracePointDistance = 3;
var snakingSliders = true;

/////

function Circle(data) {
    this.type = "circle";
    this.time = data.time;
    this.endTime = this.time;
    this.newCombo = data.newCombo;
    this.x = data.x;
    this.y = data.y;
    this.startPoint = {x: this.x, y: this.y};
    this.basePoint = {x: this.x, y: this.y};
    this.stackShift = 0;
    this.hitCircleExploded = false;
}

Circle.prototype.updateStackPosition = function() {
    this.x += this.stackShift;
    this.y += this.stackShift;
}

Circle.prototype.draw = function() {
    this.containerDiv = document.createElement("div");
    this.containerDiv.className = "hitCircleContainer";
    this.containerDiv.style.width = currentPlay.csPixel + "px";
    this.containerDiv.style.height = currentPlay.csPixel + "px";
    this.containerDiv.style.left = ((this.x + currentPlay.marginWidth) * currentPlay.pixelRatio - currentPlay.halfCsPixel) + "px", this.containerDiv.style.top = ((this.y + currentPlay.marginHeight) * currentPlay.pixelRatio - currentPlay.halfCsPixel) + "px";
    this.containerDiv.style.zIndex = this.zIndex;

    this.containerDiv.style.visibility = "hidden";
    this.containerDiv.style.opacity = 0;
    this.containerDiv.style.transition = "opacity " + (currentPlay.ARMs / 1000 / 3) + "s linear";

    var baseCanvas = document.createElement("canvas"); // Create local object canvas
    baseCanvas.setAttribute("width", currentPlay.csPixel);
    baseCanvas.setAttribute("height", currentPlay.csPixel);

    var ctx = baseCanvas.getContext("2d");
    osuweb.graphics.drawCircle(ctx, 0, 0, this.comboInfo);

    this.approachCircleCanvas = document.createElement("canvas");
    this.approachCircleCanvas.setAttribute("width", currentPlay.csPixel);
    this.approachCircleCanvas.setAttribute("height", currentPlay.csPixel);

    var approachCtx = this.approachCircleCanvas.getContext("2d");
    osuweb.graphics.drawApproachCircle(approachCtx, 0, 0, this.comboInfo.comboNum);

    this.containerDiv.appendChild(baseCanvas);
    this.containerDiv.appendChild(this.approachCircleCanvas);
}

Circle.prototype.append = function() {
    objectContainerDom.appendChild(this.containerDiv);
}

Circle.prototype.show = function(offset) {
    this.containerDiv.style.visibility = "visible";
    this.containerDiv.style.transition = "opacity " + (((currentPlay.ARMs / 2) - offset) / 1000) + "s linear";
    this.containerDiv.style.opacity = 1;
    this.approachCircleCanvas.style.animation = "closeApproachCircle linear " + currentPlay.ARMs / 1000 + "s";
}

Circle.prototype.remove = function() {
    this.containerDiv.parentNode.removeChild(this.containerDiv);
}

function Slider(data) {
    this.type = "slider";
    this.time = data.time;
    this.newCombo = data.newCombo;
    this.x = data.x;
    this.y = data.y;
    this.startPoint = {x: this.x, y: this.y};
    this.stackShift = 0;
    this.sections = data.sections;
    this.hitCircleExploded = false;
    this.fadingOut = false;

    this.repeat = data.repeat;
    this.length = data.length;
    this.currentSliderTick = 0;

    this.sliderPathPoints = [];

    var passedLength = 0;
    var segmentCount = Math.floor(this.length / maximumTracePointDistance + 1); // Math.floor + 1 is basically like .ceil, but we can't get 0 here
    var segmentLength = this.length / segmentCount;
    var tracedPointsAdded = 0;

    function addTracedPoint(pos, dist) { // Taking care of curve length exceeding pixelLength
        pushPos.bind(this)(pos);

        tracedPointsAdded++;
        if (tracedPointsAdded == segmentCount + 1) {
            return true; // Stops tracing
        }
    }

    function pushPos(pos) { // Pushes endpoint to array
        pos = {
            x: pos.x * currentPlay.pixelRatio,
            y: pos.y * currentPlay.pixelRatio
        };

        this.sliderPathPoints.push(pos);

        this.minX = Math.min(this.minX, pos.x);
        this.minY = Math.min(this.minY, pos.y);
        this.maxX = Math.max(this.maxX, pos.x);
        this.maxY = Math.max(this.maxY, pos.y);
    }

    (function() {
        if (this.sections[0].type == "circle") {
            var points = this.sections[0].values;

            var centerPos = osuweb.mathutil.circleCenterPos(points[0], points[1], points[2]);
            var radius = Math.hypot(centerPos.x - points[0].x, centerPos.y - points[0].y);
            var a1 = Math.atan2(points[0].y - centerPos.y, points[0].x - centerPos.x), // angle to start
                a2 = Math.atan2(points[1].y - centerPos.y, points[1].x - centerPos.x), // angle to control point
                a3 = Math.atan2(points[2].y - centerPos.y, points[2].x - centerPos.x); // angle to end

            var incre = segmentLength / radius, condition;

            if (a1 < a2 && a2 < a3) { // Point order
                condition = function(x) {return x < a3};
            } else if ((a2 < a3 && a3 < a1) || (a3 < a1 && a1 < a2)) {
                condition = function(x) {return x < a3 + osuweb.graphics.pi2};
            } else if (a3 < a1 && a1 < a2) {
                condition = function(x) {return x < a3 + osuweb.graphics.pi2};
            } else if (a3 < a2 && a2 < a1) {
                condition = function(x) {return x > a3};
                incre *= -1;
            } else {
                condition = function(x) {return x > a3 - osuweb.graphics.pi2};
                incre *= -1;
            }

            this.minX = this.maxX = (centerPos.x + radius * Math.cos(a1)) * currentPlay.pixelRatio;
            this.minY = this.maxY = (centerPos.y + radius * Math.sin(a1)) * currentPlay.pixelRatio;

            var angle = a1;
            for (var i = 0; i <= segmentCount; i++) {
                pushPos.bind(this)({
                    x: centerPos.x + radius * Math.cos(angle),
                    y: centerPos.y + radius * Math.sin(angle)
                });

                angle += incre;
            }
        } else {
            this.minX = this.maxX = this.sections[0].values[0].x * currentPlay.pixelRatio;
            this.minY = this.maxY = this.sections[0].values[0].y * currentPlay.pixelRatio;
            var p1;

            // Extra section is added because ppy fucked up his pixelLength
            var lastPoint = this.sections[this.sections.length - 1].values[this.sections[this.sections.length - 1].values.length - 1];
            var secondLastPoint = this.sections[this.sections.length - 1].values[this.sections[this.sections.length - 1].values.length - 2];
            if (lastPoint && secondLastPoint) {
                var angle = Math.atan2(lastPoint.y - secondLastPoint.y, lastPoint.x - secondLastPoint.x);
                this.sections.push({
                    type: "linear",
                    values: [
                        {x: lastPoint.x, y: lastPoint.y},
                        {x: lastPoint.x + 500 * Math.cos(angle), y: lastPoint.y + 500 * Math.sin(angle)}
                    ]
                })
            }


            for (var i = 0; i < this.sections.length; i++) {
                var points = this.sections[i].values;

                var leftT = 0, rightT = 0.01;
                if (i == 0) {
                    p1 = osuweb.mathutil.coordsOnBezier(points, leftT);
                    addTracedPoint.bind(this)(p1);
                }
                var p2 = osuweb.mathutil.coordsOnBezier(points, rightT);

                while (leftT <= 1) { // Binary segment approximation method
                    while (true) {
                        var dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);

                        if (dist < segmentLength) {
                            leftT += 0.01;
                            rightT += 0.01;

                            if (leftT > 1) {
                                break;
                            }

                            p2 = osuweb.mathutil.coordsOnBezier(points, rightT);
                        } else {
                            var p3, midT;

                            while (true) {
                                midT = (leftT + rightT) / 2;
                                p3 = osuweb.mathutil.coordsOnBezier(points, midT);
                                dist = Math.hypot(p3.x - p1.x, p3.y - p1.y);

                                if (Math.abs(segmentLength - dist) < 0.001) {
                                    break;
                                }

                                if (dist < segmentLength) {
                                    leftT = midT;
                                } else {
                                    rightT = midT;
                                }
                            }

                            if (midT < 1) {
                                if (addTracedPoint.bind(this)(p3, dist)) {
                                    return;
                                }
                                p1 = p3;
                            }

                            leftT = midT;
                            rightT = leftT + 0.01;
                            p2 = osuweb.mathutil.coordsOnBezier(points, rightT);

                            break;
                        }
                    }
                }
            }
        }
    }).bind(this)();

    /*var length = 0;
    for(var i = 1; i < this.sliderPathPoints.length; i++) {
        length += Math.hypot(this.sliderPathPoints[i - 1].x / currentPlay.pixelRatio - this.sliderPathPoints[i].x / currentPlay.pixelRatio, this.sliderPathPoints[i - 1].y / currentPlay.pixelRatio - this.sliderPathPoints[i].y / currentPlay.pixelRatio);
    }

    console.log(this);
    console.log("length difference: "+Math.abs(this.length - distanceTraced).toFixed(5));*/

    if(this.repeat % 2 == 0) {
        this.basePoint = this.startPoint;
    }
    else {
        this.basePoint = {x: this.sliderPathPoints[this.sliderPathPoints.length - 1].x / currentPlay.pixelRatio, y: this.sliderPathPoints[this.sliderPathPoints.length - 1].y / currentPlay.pixelRatio};
    }
}

Slider.prototype.updateStackPosition = function() {
    this.x += this.stackShift;
    this.y += this.stackShift;

    this.minX += this.stackShift * currentPlay.pixelRatio;
    this.minY += this.stackShift * currentPlay.pixelRatio;
    this.maxX += this.stackShift * currentPlay.pixelRatio;
    this.maxY += this.stackShift * currentPlay.pixelRatio;

    for(var i = 0; i < this.sliderPathPoints.length; i++) {
        this.sliderPathPoints[i].x += this.stackShift * currentPlay.pixelRatio;
        this.sliderPathPoints[i].y += this.stackShift * currentPlay.pixelRatio;
    }
}

Slider.prototype.draw = function() {
    this.containerDiv = document.createElement("div");
    this.containerDiv.className = "sliderContainer";
    this.containerDiv.style.left = (this.minX - currentPlay.halfCsPixel) + currentPlay.marginWidth * currentPlay.pixelRatio + "px", this.containerDiv.style.top = (this.minY - currentPlay.halfCsPixel) + currentPlay.marginHeight * currentPlay.pixelRatio + "px";
    this.containerDiv.style.visibility = "hidden";
    this.containerDiv.style.opacity = 0;
    this.containerDiv.style.zIndex = this.zIndex;

    var sliderWidth = this.maxX - this.minX, sliderHeight = this.maxY - this.minY;
    var sliderBodyRadius = currentPlay.halfCsPixel * 14.5 / 16;

    this.baseCanvas = document.createElement("canvas"); // Create local object canvas
    this.baseCanvas.setAttribute("width", Math.ceil(sliderWidth + currentPlay.csPixel));
    this.baseCanvas.setAttribute("height", Math.ceil(sliderHeight + currentPlay.csPixel));

    var ctx = this.baseCanvas.getContext("2d");

    this.updateBase = function(initialRender) {
        if (initialRender) {
            var thisCompletion = 1;
        } else {
            var thisCompletion = Math.min(1, (currentPlay.audioCurrentTime - (this.time - currentPlay.ARMs)) / currentPlay.ARMs * 2.5);
        }

        var targetIndex = Math.floor(thisCompletion * (this.sliderPathPoints.length - 1));
        var pointsToDraw = this.sliderPathPoints.slice(0, targetIndex + 1);

        ctx.clearRect(0, 0, sliderWidth + currentPlay.csPixel, sliderHeight + currentPlay.csPixel);
        ctx.beginPath();
        ctx.moveTo(this.sliderPathPoints[0].x - this.minX + currentPlay.halfCsPixel, this.sliderPathPoints[0].y - this.minY + currentPlay.halfCsPixel);
        for (var i = 0; i < pointsToDraw.length; i++) {
            ctx.lineTo(pointsToDraw[i].x - this.minX + currentPlay.halfCsPixel, pointsToDraw[i].y - this.minY + currentPlay.halfCsPixel);
        }

        ctx.lineWidth = currentPlay.csPixel;
        ctx.strokeStyle = "white";
        ctx.lineCap = "round";
        ctx.lineJoin= "round";
        ctx.globalCompositeOperation = "source-over";
        ctx.stroke();

        for (var i = sliderBodyRadius; i > 1; i -= 2) {
            ctx.lineWidth = i * 2;
            var completionRgb = Math.floor((1 - (i / sliderBodyRadius)) * 130);
            ctx.strokeStyle = "rgb(" + completionRgb + ", " + completionRgb + ", "  + completionRgb + ")";
            ctx.stroke();
        }
        ctx.lineWidth = sliderBodyRadius * 2;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
        ctx.globalCompositeOperation = "destination-out";
        ctx.stroke();

        if (!initialRender && thisCompletion < 1) {
            requestAnimationFrame(function() {
                this.updateBase.bind(this)(false);
            }.bind(this));
        }
    }

    this.updateBase.bind(this)(true);
    this.containerDiv.appendChild(this.baseCanvas);

    var overlay = document.createElement("canvas");
    overlay.setAttribute("width", sliderWidth + currentPlay.csPixel);
    overlay.setAttribute("height", sliderHeight + currentPlay.csPixel);

    var overlayCtx = overlay.getContext("2d");

    function getCoordFromCoordArray(arr, percent) {
        var actualIdx = percent * (arr.length - 1);
        var lowerIdx = Math.floor(actualIdx), upperIdx = Math.ceil(actualIdx);
        var lowerPos = arr[lowerIdx];
        var upperPos = arr[upperIdx];

        return { // Linear interpolation
            x: lowerPos.x * (1 - (actualIdx - lowerIdx)) + upperPos.x * (actualIdx - lowerIdx),
            y: lowerPos.y * (1 - (actualIdx - lowerIdx)) + upperPos.y * (actualIdx - lowerIdx)
        }
    }

    function getLowestTickCompletionFromCurrentRepeat(completion) {
        var currentRepeat = Math.floor(completion);
        for (var i = 0; i < this.sliderTickCompletions.length; i++) {
            if (this.sliderTickCompletions[i] > currentRepeat) {
                return this.sliderTickCompletions[i];
            }
        }
    }

    this.updateOverlay = function() {
        var completion = 0;
        var isMoving = this.time <= currentPlay.audioCurrentTime;

        if (isMoving) {
            overlayCtx.clearRect(0, 0, sliderWidth + currentPlay.csPixel, sliderHeight + currentPlay.csPixel);

            var currentSliderTime = currentPlay.audioCurrentTime - this.time;
            completion = (this.timingInfo.sliderVelocity * currentSliderTime) / this.length;

            if (completion >= this.repeat) {
                completion = this.repeat;
            }

            // Draws slider ticks
            if (this.sliderTickCompletions[this.currentSliderTick] != undefined) {
                var lowestTickCompletionFromCurrentRepeat = getLowestTickCompletionFromCurrentRepeat.bind(this)(completion)
                for (var i = 0; this.sliderTickCompletions[i] < Math.floor(completion + 1) && this.sliderTickCompletions[i] < lowestTickCompletionFromCurrentRepeat + (completion % 1) * 2; i++) {
                    if (this.sliderTickCompletions[i] >= completion) {
                        var sliderTickPos = getCoordFromCoordArray(this.sliderPathPoints, osuweb.mathutil.reflect(this.sliderTickCompletions[i]));
                        var x = sliderTickPos.x - this.minX + currentPlay.halfCsPixel, y = sliderTickPos.y - this.minY + currentPlay.halfCsPixel;
                        var tickMs = Math.floor(completion) * this.length / this.timingInfo.sliderVelocity /* ms of current repeat */ +
                            ((this.sliderTickCompletions[i] - lowestTickCompletionFromCurrentRepeat) * this.length / this.timingInfo.sliderVelocity) / 2 /* ms of tick showing up */;
                        var animationCompletion = Math.min(1, (currentSliderTime - tickMs) / 85);

                        overlayCtx.beginPath();
                        overlayCtx.arc(x, y, currentPlay.csPixel * 0.038 * (/* parabola */ -2.381 * animationCompletion * animationCompletion + 3.381 * animationCompletion), 0, osuweb.graphics.pi2);
                        overlayCtx.fillStyle = "rgba(255, 255, 255," + 1 + ")";
                        overlayCtx.fill();
                    }
                }
            }
        }

        // Draws repeat arrow
        if (this.repeat - completion > 1) {
            if (Math.floor(completion) % 2 == 0) {
                var reverseArrowPos = this.sliderPathPoints[this.sliderPathPoints.length - 1];
                var p2 = this.sliderPathPoints[this.sliderPathPoints.length - 2];
            } else {
                var reverseArrowPos = this.sliderPathPoints[0];
                var p2 = this.sliderPathPoints[1];
            }
            var angle = Math.atan2(p2.y - reverseArrowPos.y, p2.x - reverseArrowPos.x);
            var x = reverseArrowPos.x - this.minX + currentPlay.halfCsPixel;
            var y = reverseArrowPos.y - this.minY + currentPlay.halfCsPixel;

            var repeatArrowCanvas = document.createElement("canvas");
            repeatArrowCanvas.setAttribute("width", currentPlay.csPixel);
            repeatArrowCanvas.setAttribute("height", currentPlay.csPixel);

            var repeatArrowCtx = repeatArrowCanvas.getContext("2d");
            repeatArrowCtx.translate(currentPlay.halfCsPixel, currentPlay.halfCsPixel);
            repeatArrowCtx.rotate(angle);
            repeatArrowCtx.translate(-currentPlay.halfCsPixel, -currentPlay.halfCsPixel);
            repeatArrowCtx.font = "lighter " + (currentPlay.csPixel * 0.6) + "px Arial";
            repeatArrowCtx.textAlign = "center", repeatArrowCtx.textBaseline = "middle";
            repeatArrowCtx.fillStyle = "white";
            repeatArrowCtx.fillText("▶", currentPlay.halfCsPixel, currentPlay.halfCsPixel);

            overlayCtx.drawImage(repeatArrowCanvas, x - currentPlay.halfCsPixel, y - currentPlay.halfCsPixel);
        }

        if (isMoving) {
            // Draws slider ball
            var sliderBallPos = getCoordFromCoordArray(this.sliderPathPoints, osuweb.mathutil.reflect(completion));
            var x = sliderBallPos.x - this.minX + currentPlay.halfCsPixel;
            var y = sliderBallPos.y - this.minY + currentPlay.halfCsPixel;

            var colour = currentBeatmap.colours[this.comboInfo.comboNum % currentBeatmap.colours.length];
            var colourString = "rgb(" + colour.r + "," + colour.g + "," + colour.b + ")";

            overlayCtx.beginPath();
            overlayCtx.arc(x, y, sliderBodyRadius, 0, osuweb.graphics.pi2);
            overlayCtx.fillStyle = colourString;
            overlayCtx.fill();
        }

        if (completion < this.repeat || completion == 0) {
            requestAnimationFrame(this.updateOverlay.bind(this));
        }
    }

    this.containerDiv.appendChild(overlay);

    this.sliderHeadContainer = document.createElement("div");
    this.sliderHeadContainer.className = "hitCircleContainer";
    this.sliderHeadContainer.style.width = currentPlay.csPixel + "px";
    this.sliderHeadContainer.style.height = currentPlay.csPixel + "px";
    this.sliderHeadContainer.style.left = this.sliderPathPoints[0].x - this.minX + "px";
    this.sliderHeadContainer.style.top = this.sliderPathPoints[0].y - this.minY + "px";

    var sliderHeadBaseCanvas = document.createElement("canvas"); // Create local object canvas
    sliderHeadBaseCanvas.setAttribute("width", currentPlay.csPixel);
    sliderHeadBaseCanvas.setAttribute("height", currentPlay.csPixel);

    var sliderHeadBaseCtx = sliderHeadBaseCanvas.getContext("2d");
    osuweb.graphics.drawCircle(sliderHeadBaseCtx, 0, 0, this.comboInfo);

    this.approachCircleCanvas = document.createElement("canvas");
    this.approachCircleCanvas.setAttribute("width", currentPlay.csPixel);
    this.approachCircleCanvas.setAttribute("height", currentPlay.csPixel);

    var approachCtx = this.approachCircleCanvas.getContext("2d");
    osuweb.graphics.drawApproachCircle(approachCtx, 0, 0, this.comboInfo.comboNum);

    this.sliderHeadContainer.appendChild(sliderHeadBaseCanvas);
    this.sliderHeadContainer.appendChild(this.approachCircleCanvas);

    this.containerDiv.appendChild(this.sliderHeadContainer);
}

Slider.prototype.append = function() {
    objectContainerDom.appendChild(this.containerDiv);
}

Slider.prototype.show = function(offset) {
    this.containerDiv.style.visibility = "visible";
    this.containerDiv.style.transition = "opacity " + (((currentPlay.ARMs / 2) - offset) / 1000) + "s linear";
    this.containerDiv.style.opacity = 1;
    this.approachCircleCanvas.style.animation = "closeApproachCircle linear " + ((currentPlay.ARMs - offset) / 1000) + "s";
    this.updateOverlay.bind(this)();

    if (snakingSliders) {
        this.updateBase.bind(this)(false);
    }
}

Slider.prototype.remove = function() {
    this.containerDiv.parentNode.removeChild(this.containerDiv);
}
