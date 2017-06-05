var playareaDom = document.getElementById("playarea");
var objectContainerDom = document.getElementById("objectContainer");

var sliderTracePointDistance = 4;

/////

function Circle(data, zIndex, comboInfo) {
    this.type = "circle";
    this.time = data.time;
    this.newCombo = data.newCombo;
    this.x = data.x + data.stackShift;
    this.y = data.y + data.stackShift;
    this.zIndex = zIndex;
    this.comboInfo = comboInfo;
}

Circle.prototype.append = function() {
    this.containerDiv = document.createElement("div");
    this.containerDiv.className = "hitCircleContainer";
    this.containerDiv.style.left = ((this.x + currentPlay.marginWidth) * currentPlay.pixelRatio - currentPlay.halfCsPixel) + "px", this.containerDiv.style.top = ((this.y + currentPlay.marginHeight) * currentPlay.pixelRatio - currentPlay.halfCsPixel) + "px";
    this.containerDiv.style.zIndex = this.zIndex;

    this.containerDiv.style.visibility = "hidden";
    this.containerDiv.style.opacity = 0;
    this.containerDiv.style.transition = "opacity " + (currentPlay.ARMs / 1000 / 3) + "s linear";

    var baseCanvas = document.createElement("canvas"); // Create local object canvas
    baseCanvas.setAttribute("width", currentPlay.csPixel);
    baseCanvas.setAttribute("height", currentPlay.csPixel);

    var ctx = baseCanvas.getContext("2d");
    osuweb.graphics.drawCircle(ctx, 0, 0, this.comboInfo.n);

    this.approachCircleCanvas = document.createElement("canvas");
    this.approachCircleCanvas.setAttribute("width", currentPlay.csPixel);
    this.approachCircleCanvas.setAttribute("height", currentPlay.csPixel);

    var approachCtx = this.approachCircleCanvas.getContext("2d");
    osuweb.graphics.drawApproachCircle(approachCtx, 0, 0, this.comboInfo.comboNum);

    this.containerDiv.appendChild(baseCanvas);
    this.containerDiv.appendChild(this.approachCircleCanvas);
    objectContainerDom.appendChild(this.containerDiv);
}

Circle.prototype.show = function(offset) {
    this.containerDiv.style.visibility = "visible";
    this.containerDiv.style.transition = "opacity " + (((currentPlay.ARMs / 2) - offset) / 1000) + "s linear";
    this.containerDiv.style.opacity = 1;
    this.approachCircleCanvas.style.animation = "closeApproachCircle linear " + currentPlay.ARMs / 1000 + "s";

    setTimeout(this.remove.bind(this), currentPlay.ARMs);
}

Circle.prototype.remove = function() {
    this.containerDiv.parentNode.removeChild(this.containerDiv);
}

function Slider(data, zIndex, comboInfo) {
    this.type = "slider";
    this.time = data.time;
    this.newCombo = data.newCombo;
    this.x = data.x + data.stackShift, this.y = data.y + data.stackShift;
    this.sections = data.sections;
    this.zIndex = zIndex;
    this.comboInfo = comboInfo;

    for(var j = 0; j < this.sections; j++) {
        var sec = this.sections[j];

        for(var i = 0; i < sec.length; i++) {
            sec[i].values.x += data.stackShift;
            sec[i].values.y += data.stackShift;
        }
    }

    this.repeat = data.repeat;
    this.length = data.length;

    this.sliderPathPoints = [];

    var passedLength = 0,
        lastPoint;

    function extendLength(pos, dist) { // Taking care of curve length exceeding pixelLength
        var causeExit = false;

        if (dist) {
            passedLength += dist;
        } else if (lastPoint) {
            passedLength += Math.hypot(lastPoint.x - pos.x, lastPoint.y - pos.y);
        }

        if (passedLength > this.length) {
            var angle = Math.atan2(pos.y - lastPoint.y, pos.x - lastPoint.x), dif = passedLength - this.length;
            pos.x = lastPoint.x + dif * Math.cos(angle), pos.y = lastPoint.y + dif * Math.sin(angle);

            causeExit = true;
        }

        lastPoint = pos;
        pushPos.bind(this)(pos);

        if (causeExit) return true;
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

            var incre = sliderTracePointDistance / radius, condition;

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

            for (var angle = a1; condition(angle); angle += incre) {
                if (extendLength.bind(this)({
                    x: centerPos.x + radius * Math.cos(angle),
                    y: centerPos.y + radius * Math.sin(angle)
                })) {
                    return;
                }
            }
        } else {
            this.minX = this.maxX = this.sections[0].values[0].x * currentPlay.pixelRatio;
            this.minY = this.maxY = this.sections[0].values[0].y * currentPlay.pixelRatio;
            var p1;

            for (var i = 0; i < this.sections.length; i++) {
                var points = this.sections[i].values;

                var leftT = 0, rightT = 0.01;
                if (i == 0) {
                    p1 = osuweb.mathutil.coordsOnBezier(points, leftT);
                    extendLength.bind(this)(p1);
                }
                var p2 = osuweb.mathutil.coordsOnBezier(points, rightT);

                while (leftT < 1) { // Binary segment approximation method
                    while (true) {
                        var dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);

                        if (dist < sliderTracePointDistance) {
                            leftT += 0.01;
                            rightT += 0.01;
                            p2 = osuweb.mathutil.coordsOnBezier(points, rightT);
                        } else {
                            var p3, midT;

                            while (true) {
                                midT = (leftT + rightT) / 2;
                                p3 = osuweb.mathutil.coordsOnBezier(points, midT);
                                dist = Math.hypot(p3.x - p1.x, p3.y - p1.y);

                                if (Math.abs(sliderTracePointDistance - dist) < 0.1) {
                                    break;
                                }

                                if (dist < sliderTracePointDistance) {
                                    leftT = midT;
                                } else {
                                    rightT = midT;
                                }
                            }

                            if (midT < 1) {
                                if (extendLength.bind(this)(p3, dist)) {
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

    if (passedLength < this.length) { // Fires when traced path is shorter than pixelLength
        var endPos = this.sections[this.sections.length - 1].values[this.sections[this.sections.length - 1].values.length - 1];
        var angle = Math.atan2(endPos.y - lastPoint.y, endPos.x - lastPoint.x);
        var dif = this.length - passedLength;

        for (var dist = sliderTracePointDistance; dist < dif; dist += sliderTracePointDistance) {
            pushPos.bind(this)({
                x: lastPoint.x + dist * Math.cos(angle),
                y: lastPoint.y + dist * Math.sin(angle)
            });
        }

        pushPos.bind(this)({
            x: lastPoint.x + dif * Math.cos(angle),
            y: lastPoint.y + dif * Math.sin(angle)
        });
    }
}

Slider.prototype.append = function() {
    this.containerDiv = document.createElement("div");
    this.containerDiv.className = "sliderContainer";
    this.containerDiv.style.left = (this.minX - currentPlay.halfCsPixel) + currentPlay.marginWidth * currentPlay.pixelRatio + "px", this.containerDiv.style.top = (this.minY - currentPlay.halfCsPixel) + currentPlay.marginHeight * currentPlay.pixelRatio + "px";
    this.containerDiv.style.visibility = "hidden";
    this.containerDiv.style.opacity = 0;
    this.containerDiv.style.zIndex = this.zIndex;

    var sliderWidth = this.maxX - this.minX, sliderHeight = this.maxY - this.minY;

    var baseCanvas = document.createElement("canvas"); // Create local object canvas
    baseCanvas.setAttribute("width", Math.ceil(sliderWidth + currentPlay.csPixel));
    baseCanvas.setAttribute("height", Math.ceil(sliderHeight + currentPlay.csPixel));

    var ctx = baseCanvas.getContext("2d");

    ctx.beginPath();
    ctx.moveTo(this.sliderPathPoints[0].x - this.minX + currentPlay.halfCsPixel, this.sliderPathPoints[0].y - this.minY + currentPlay.halfCsPixel);
    for (var i = 1; i < this.sliderPathPoints.length; i++) {
        ctx.lineTo(this.sliderPathPoints[i].x - this.minX + currentPlay.halfCsPixel, this.sliderPathPoints[i].y - this.minY + currentPlay.halfCsPixel);
    }
    ctx.lineWidth = currentPlay.csPixel;
    ctx.lineCap = "round";
    ctx.lineJoin="round";
    ctx.strokeStyle = "white";
    ctx.stroke();

    var sliderBodyRadius = currentPlay.halfCsPixel * 14.5 / 16;
    ctx.lineCap = "round";
    for (var i = sliderBodyRadius; i > 1; i -= 2) {
        ctx.lineWidth = i * 2;
        var completionRgb = Math.floor((1 - (i / sliderBodyRadius)) * 75);
        ctx.strokeStyle = "rgb(" + completionRgb + ", " + completionRgb + ", "  + completionRgb + ")";
        ctx.stroke();
    }

    osuweb.graphics.drawCircle(ctx, this.sliderPathPoints[0].x - this.minX, this.sliderPathPoints[0].y - this.minY, this.comboInfo.n);

    this.containerDiv.appendChild(baseCanvas);

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

    this.updateOverlay = function() {
        var completion = 0;

        if (this.time <= currentPlay.audioCurrentTime) {
            if (!this.dataOnStart) {
                this.dataOnStart = {
                    msPerBeat: currentPlay.currentMsPerBeat,
                    sliderVelocity: 100 * currentPlay.beatmap.SV / (currentPlay.currentMsPerBeat * (currentPlay.currentMsPerBeatMultiplier / 100))
                }

                this.approachCircleCanvas.style.display = "none";
            }

            overlayCtx.clearRect(0, 0, sliderWidth + currentPlay.csPixel, sliderHeight + currentPlay.csPixel);

            completion = (this.dataOnStart.sliderVelocity * (currentPlay.audioCurrentTime - this.time)) / this.length;
            if (completion > this.repeat) {
                completion = this.repeat;
                this.remove.bind(this)();
            }

            // Draws slider ticks
            var offsetFromLastBeat = (this.time - currentPlay.lastNonInheritedTimingPointMs) % (this.dataOnStart.msPerBeat / currentPlay.beatmap.sliderTickRate);

            for (var tickCompletion = (this.dataOnStart.sliderVelocity * offsetFromLastBeat) / this.length;
                 tickCompletion < Math.ceil(completion);
                 tickCompletion += (this.dataOnStart.sliderVelocity * this.dataOnStart.msPerBeat / currentPlay.beatmap.sliderTickRate) / this.length) {
                if (tickCompletion >= completion) {
                    var t = Math.round(osuweb.mathutil.reflect(tickCompletion) * 100) / 100;

                    if (t > 0 && t < 1) {
                        var sliderTickPos = getCoordFromCoordArray(this.sliderPathPoints, t);
                        var x = sliderTickPos.x - this.minX + currentPlay.halfCsPixel, y = sliderTickPos.y - this.minY + currentPlay.halfCsPixel;

                        overlayCtx.beginPath();
                        overlayCtx.arc(x, y, 3, 0, osuweb.graphics.pi2);
                        overlayCtx.fillStyle = "white";
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
            var x = reverseArrowPos.x - this.minX + currentPlay.halfCsPixel, y = reverseArrowPos.y - this.minY + currentPlay.halfCsPixel;

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

        if (this.time <= currentPlay.audioCurrentTime) {
            // Draws slider ball
            var sliderBallPos = getCoordFromCoordArray(this.sliderPathPoints, osuweb.mathutil.reflect(completion));
            var x = sliderBallPos.x - this.minX + currentPlay.halfCsPixel, y = sliderBallPos.y - this.minY + currentPlay.halfCsPixel;

            overlayCtx.beginPath();
            overlayCtx.arc(x, y, sliderBodyRadius, 0, osuweb.graphics.pi2);
            overlayCtx.fillStyle = "magenta";
            overlayCtx.fill();
        }

        if (completion < this.repeat || completion == 0) {
            requestAnimationFrame(this.updateOverlay.bind(this));
        }
    }

    this.containerDiv.appendChild(overlay);

    this.approachCircleCanvas = document.createElement("canvas");
    this.approachCircleCanvas.setAttribute("width", currentPlay.csPixel);
    this.approachCircleCanvas.setAttribute("height", currentPlay.csPixel);
    this.approachCircleCanvas.style.left = this.sliderPathPoints[0].x - this.minX + "px", this.approachCircleCanvas.style.top = this.sliderPathPoints[0].y - this.minY + "px";

    var approachCtx = this.approachCircleCanvas.getContext("2d");
    osuweb.graphics.drawApproachCircle(approachCtx, 0, 0, this.comboInfo.comboNum);

    this.containerDiv.appendChild(this.approachCircleCanvas);
    objectContainerDom.appendChild(this.containerDiv);
}

Slider.prototype.show = function(offset) {
    this.containerDiv.style.visibility = "visible";
    this.containerDiv.style.transition = "opacity " + (((currentPlay.ARMs / 2) - offset) / 1000) + "s linear";
    this.containerDiv.style.opacity = 1;
    this.approachCircleCanvas.style.animation = "closeApproachCircle linear " + ((currentPlay.ARMs - offset) / 1000) + "s";
    this.updateOverlay.bind(this)();
}

Slider.prototype.remove = function() {
    this.containerDiv.parentNode.removeChild(this.containerDiv);
}