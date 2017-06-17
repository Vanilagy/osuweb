var snakingSliders = false;

function Slider(data) {
    HitObject.call(this, data);
    this.type = "slider";

    this.sections = data.sections;
    this.repeat = data.repeat;
    this.length = data.length;

    this.sliderPathPoints = [];
    this.init();
    
    this.scoring = { // Holds scoring information about slider
        head: false,
        ticks: 0,
        end: false
    }
    this.currentSliderTick = 0;
    this.currentRepeat = 0;
    this.lastPulseTime = -10e6;
    this.hittable = true;
    this.fadingOut = false;
    this.beingHeldDown = true;
    this.letGoTime = null;

    if(this.repeat % 2 == 0) {
        this.basePoint = this.startPoint;
    }
    else {
        this.basePoint = {
            x: this.sliderPathPoints[this.sliderPathPoints.length - 1].x / pixelRatio,
            y: this.sliderPathPoints[this.sliderPathPoints.length - 1].y / pixelRatio
        };
    }
}

Slider.prototype.append = function() {
    objectContainerDiv.appendChild(this.containerDiv);
};
Slider.prototype.remove = function() {
    objectContainerDiv.removeChild(this.containerDiv);
};

Slider.prototype.show = function(offset) {
    HitObject.prototype.show.call(this, offset);
    this.updateOverlay.bind(this)();

    if (snakingSliders) {
        this.updateBase.bind(this)(false);
    }
};

Slider.prototype.hit = function(success) {
    this.scoring.head = success;
    this.hittable = false;
    
    this.sliderHeadContainer.style.animation = (success) ? "0.15s destroyHitCircle linear forwards" : "0.15s fadeOut linear forwards";
    this.approachCircleCanvas.style.display = "none"; 
}

Slider.prototype.score = function() {
    var fraction = (((this.scoring.head) ? 1 : 0) + ((this.scoring.end) ? 1 : 0) + this.scoring.ticks) / (1 + this.repeat + this.sliderTickCompletions.length);

    currentPlay.score.addScore((function() {
        if (fraction == 1) {
            return 300;
        } else if (fraction >= 0.5) {
            return 100;
        } else if (fraction > 0) {
            return 50;
        }
        return 0;
    })(), false, true, this.basePoint);
}

Slider.prototype.updateStackPosition = function() {
    this.x += this.stackHeight * -4;
    this.y += this.stackHeight * -4;

    this.minX += this.stackHeight * -4 * pixelRatio;
    this.minY += this.stackHeight * -4 * pixelRatio;
    this.maxX += this.stackHeight * -4 * pixelRatio;
    this.maxY += this.stackHeight * -4 * pixelRatio;

    for(var i = 0; i < this.sliderPathPoints.length; i++) {
        this.sliderPathPoints[i].x += this.stackHeight * -4 * pixelRatio;
        this.sliderPathPoints[i].y += this.stackHeight * -4 * pixelRatio
    }
};

Slider.prototype.init = function() { // Calculates slider path
    if (this.sections[0].type == "circle") {
        var points = this.sections[0].values;

        var centerPos = MathUtil.circleCenterPos(points[0], points[1], points[2]);
        var radius = Math.hypot(centerPos.x - points[0].x, centerPos.y - points[0].y);
        var a1 = Math.atan2(points[0].y - centerPos.y, points[0].x - centerPos.x), // angle to start
            a2 = Math.atan2(points[1].y - centerPos.y, points[1].x - centerPos.x), // angle to control point
            a3 = Math.atan2(points[2].y - centerPos.y, points[2].x - centerPos.x); // angle to end

        var segmentCount = Math.floor(this.length / maximumTracePointDistance + 1); // Math.floor + 1 is basically like .ceil, but we can't get 0 here
        var segmentLength = this.length / segmentCount;
        var incre = segmentLength / radius, condition;

        if (a1 < a2 && a2 < a3) { // Point order
            condition = function(x) {return x < a3};
        } else if ((a2 < a3 && a3 < a1) || (a3 < a1 && a1 < a2)) {
            condition = function(x) {return x < a3 + pi2};
        } else if (a3 < a1 && a1 < a2) {
            condition = function(x) {return x < a3 + pi2};
        } else if (a3 < a2 && a2 < a1) {
            condition = function(x) {return x > a3};
            incre *= -1;
        } else {
            condition = function(x) {return x > a3 - pi2};
            incre *= -1;
        }

        this.minX = this.maxX = (centerPos.x + radius * Math.cos(a1)) * pixelRatio;
        this.minY = this.maxY = (centerPos.y + radius * Math.sin(a1)) * pixelRatio;

        var angle = a1;
        for (var i = 0; i <= segmentCount; i++) {
            this.pushPos({
                x: centerPos.x + radius * Math.cos(angle),
                y: centerPos.y + radius * Math.sin(angle)
            });

            angle += incre;
        }
    } else {
        this.minX = this.maxX = this.sections[0].values[0].x * pixelRatio;
        this.minY = this.maxY = this.sections[0].values[0].y * pixelRatio;       
        
        var initialTracePoints = [];        
        var sliderLength = 0;
        
        function addInitialTracePoint(pos) { // Adding points and keeping track of the distance passed
            if (initialTracePoints[initialTracePoints.length - 1]) {
                var thatPoint = initialTracePoints[initialTracePoints.length - 1];
                sliderLength += Math.hypot(thatPoint.x - pos.x, thatPoint.y - pos.y);
            }
            
            initialTracePoints.push(pos);
        }

        for (var i = 0; i < this.sections.length; i++) {
            var points = this.sections[i].values;
            
            if (points.length == 2) { // if linear
                addInitialTracePoint(points[0]);
                addInitialTracePoint(points[1]);
            } else {
                var leftT = 0, rightT = 0.01;
                var p1 = MathUtil.coordsOnBezier(points, leftT);
                var p2 = MathUtil.coordsOnBezier(points, rightT);
                addInitialTracePoint(p1);

                while (leftT < 1) { // Binary segment approximation method
                    while (true) {
                        var dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);

                        if (dist < maximumTracePointDistance) {
                            leftT += 0.01;
                            rightT += 0.01;

                            if (leftT >= 1) {
                                break;
                            }

                            p2 = MathUtil.coordsOnBezier(points, rightT);
                        } else {
                            var p3, midT;

                            while (true) {
                                midT = (leftT + rightT) / 2;
                                p3 = MathUtil.coordsOnBezier(points, midT);
                                dist = Math.hypot(p3.x - p1.x, p3.y - p1.y);

                                if (Math.abs(maximumTracePointDistance - dist) < 0.25) {
                                    break;
                                }

                                if (dist < maximumTracePointDistance) {
                                    leftT = midT;
                                } else {
                                    rightT = midT;
                                }
                            }

                            if (midT < 1) {
                                addInitialTracePoint(p3);
                                p1 = p3;
                            }

                            leftT = midT;
                            rightT = leftT + 0.01;
                            p2 = MathUtil.coordsOnBezier(points, rightT);

                            break;
                        }
                    }
                }
            }

            addInitialTracePoint(points[points.length - 1]);
        }
        
        if (sliderLength > this.length) { // If traced length bigger than pixelLength
            sliderLength = this.length;
        }
        
        // Extra point is added because floats
        var lastPoint = initialTracePoints[initialTracePoints.length - 1];
        var secondLastPoint = initialTracePoints[initialTracePoints.length - 2];
        if (lastPoint && secondLastPoint) {
            var angle = Math.atan2(lastPoint.y - secondLastPoint.y, lastPoint.x - secondLastPoint.x);
            initialTracePoints.push({
                x: lastPoint.x + 500 * Math.cos(angle),
                y: lastPoint.y + 500 * Math.sin(angle)
            });
        }
        
        var segmentCount = Math.floor(sliderLength / maximumTracePointDistance + 1); // Math.floor + 1 is basically like .ceil, but we can't get 0 here
        var segmentLength = sliderLength / segmentCount;
        
        /* Using the initially traced points, generate a slider path point array in which
           all points are equally distant from one another. This is done to guarantee constant
           slider velocity. */
        var lastPoint = initialTracePoints[0];
        this.pushPos(lastPoint);
        var currentIndex = 1;
        for (var c = 0; c < segmentCount; c++) {
            var remainingLength = segmentLength;
            
            while (true) {
                var dist = Math.hypot(lastPoint.x - initialTracePoints[currentIndex].x, lastPoint.y - initialTracePoints[currentIndex].y);
                
                if (dist < remainingLength) {
                    lastPoint = initialTracePoints[currentIndex];
                    remainingLength -= dist;
                    currentIndex++;
                } else {
                    var percentReached = remainingLength / dist;
                    var newPoint = {
                        x: lastPoint.x * (1 - percentReached) + initialTracePoints[currentIndex].x * percentReached,
                        y: lastPoint.y * (1 - percentReached) + initialTracePoints[currentIndex].y * percentReached
                    }
                    
                    this.pushPos(newPoint);
                    lastPoint = newPoint;
                    break;
                }
            }
        }
    }
};

Slider.prototype.pushPos = function(pos) { // Pushes endpoint to array
    pos = {
        x: pos.x * pixelRatio,
        y: pos.y * pixelRatio
    };

    this.sliderPathPoints.push(pos);

    this.minX = Math.min(this.minX, pos.x);
    this.minY = Math.min(this.minY, pos.y);
    this.maxX = Math.max(this.maxX, pos.x);
    this.maxY = Math.max(this.maxY, pos.y);
};

Slider.prototype.draw = function() {
    var sliderWidth = this.maxX - this.minX, sliderHeight = this.maxY - this.minY;
    var sliderBodyRadius = halfCsPixel * (1 - circleBorderWidth);
    var maxFollowCircleRadius = (halfCsPixel * 2.18);
    
    this.containerDiv = document.createElement("div");
    this.containerDiv.className = "sliderContainer";
    this.containerDiv.style.left = (this.minX - halfCsPixel) + currentPlay.marginWidth * pixelRatio + "px", this.containerDiv.style.top = (this.minY - halfCsPixel) + currentPlay.marginHeight * pixelRatio + "px";
    this.containerDiv.style.visibility = "hidden";
    this.containerDiv.style.opacity = 0;
    this.containerDiv.style.zIndex = this.zIndex;

    this.baseCanvas = document.createElement("canvas"); // Create local object canvas
    this.baseCanvas.setAttribute("width", Math.ceil(sliderWidth + csPixel));
    this.baseCanvas.setAttribute("height", Math.ceil(sliderHeight + csPixel));

    var ctx = this.baseCanvas.getContext("2d");

    this.updateBase = function(initialRender) {
        if (initialRender) {
            var thisCompletion = 1;
        } else {
            var thisCompletion = Math.min(1, (audioCurrentTime - (this.time - currentPlay.ARMs)) / currentPlay.ARMs * 2.5);
        }

        var targetIndex = Math.floor(thisCompletion * (this.sliderPathPoints.length - 1));
        var pointsToDraw = this.sliderPathPoints.slice(0, targetIndex + 1);

        ctx.clearRect(0, 0, Math.ceil(sliderWidth + csPixel), Math.ceil(sliderHeight + csPixel));
        ctx.beginPath();
        ctx.moveTo(this.sliderPathPoints[0].x - this.minX + halfCsPixel, this.sliderPathPoints[0].y - this.minY + halfCsPixel);
        for (var i = 0; i < pointsToDraw.length; i++) {
            ctx.lineTo(pointsToDraw[i].x - this.minX + halfCsPixel, pointsToDraw[i].y - this.minY + halfCsPixel);
            /*ctx.beginPath();
            ctx.arc(pointsToDraw[i].x - this.minX + halfCsPixel, pointsToDraw[i].y - this.minY + halfCsPixel, 1, 0, Math.PI * 2)
            ctx.fillStyle = "white";
            ctx.fill();*/
        }

        ctx.lineWidth = csPixel;
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
        ctx.globalCompositeOperation = "destination-out"; // Transparency
        ctx.stroke();

        if (!initialRender && thisCompletion < 1) {
            requestAnimationFrame(function() {
                this.updateBase.bind(this)(false);
            }.bind(this));
        }
    };

    if (!snakingSliders) {
        this.updateBase.bind(this)(true);
    }
    this.containerDiv.appendChild(this.baseCanvas);

    var overlay = document.createElement("canvas");
    overlay.setAttribute("width", Math.ceil(sliderWidth + csPixel));
    overlay.setAttribute("height", Math.ceil(sliderHeight + csPixel));
    var overlayCtx = overlay.getContext("2d");

    this.updateOverlay = function() {
        var completion = 0;
        var currentSliderTime = window.performance.now() - currentPlay.audioStartTime + currentPlay.audioOffset - this.time;
        var isMoving = currentSliderTime >= 0;
        
        overlayCtx.clearRect(0, 0, Math.ceil(sliderWidth + csPixel), Math.ceil(sliderHeight + csPixel));
        
        if (isMoving) {
            completion = Math.min(this.repeat, (this.timingInfo.sliderVelocity * currentSliderTime) / this.length);
        }

        var animationDuration = 85;
        var completionForSliderTicks = completion;
        if (completion < 1) {
            completionForSliderTicks = (this.timingInfo.sliderVelocity * (currentSliderTime + animationDuration)) / this.length;
        }

        // Draws slider ticks. Ticks in the first slider cycle appear animationDuration ms earlier.
        if (this.sliderTickCompletions[this.currentSliderTick] != undefined) {
            var lowestTickCompletionFromCurrentRepeat = getLowestTickCompletionFromCurrentRepeat.bind(this)(completion);
            for (var i = 0; this.sliderTickCompletions[i] < Math.floor(completion + 1) && this.sliderTickCompletions[i] < lowestTickCompletionFromCurrentRepeat + (completionForSliderTicks % 1) * 2; i++) {
                if (this.sliderTickCompletions[i] >= completion) {
                    var sliderTickPos = GraphicUtil.getCoordFromCoordArray(this.sliderPathPoints, MathUtil.reflect(this.sliderTickCompletions[i]));
                    var x = sliderTickPos.x - this.minX + halfCsPixel, y = sliderTickPos.y - this.minY + halfCsPixel;
                    var tickMs = 
                        /* ms of current repeat */ Math.floor(completion) * this.length / this.timingInfo.sliderVelocity
                      + /* ms of tick showing up */ ((this.sliderTickCompletions[i] - lowestTickCompletionFromCurrentRepeat) * this.length / this.timingInfo.sliderVelocity) / 2;
                    var animationCompletion = Math.min(1, (currentSliderTime - tickMs + ((completion < 1) ? animationDuration : 0)) / animationDuration);

                    overlayCtx.beginPath();
                    overlayCtx.arc(x, y, csPixel * 0.038 * (/* parabola */ -2.381 * animationCompletion * animationCompletion + 3.381 * animationCompletion), 0, pi2);
                    overlayCtx.fillStyle = "white";
                    overlayCtx.fill();
                }
            }
        }

        // Draws reverse arrow
        if (this.repeat - completion > 1) {
            if (Math.floor(completion) % 2 == 0) {
                var reverseArrowPos = this.sliderPathPoints[this.sliderPathPoints.length - 1];
                var p2 = this.sliderPathPoints[this.sliderPathPoints.length - 2];
            } else {
                var reverseArrowPos = this.sliderPathPoints[0];
                var p2 = this.sliderPathPoints[1];
            }
            var angle = Math.atan2(p2.y - reverseArrowPos.y, p2.x - reverseArrowPos.x);
            var x = reverseArrowPos.x - this.minX;
            var y = reverseArrowPos.y - this.minY;

            // Create second off-screen canvas used for rotating the text
            var reverseArrowCanvas = document.createElement("canvas");
            reverseArrowCanvas.setAttribute("width", csPixel);
            reverseArrowCanvas.setAttribute("height", csPixel);

            var reverseArrowCtx = reverseArrowCanvas.getContext("2d");
            reverseArrowCtx.translate(halfCsPixel, halfCsPixel);
            reverseArrowCtx.rotate(angle);
            reverseArrowCtx.translate(-halfCsPixel, -halfCsPixel);
            reverseArrowCtx.font = "lighter " + (csPixel * 0.6) + "px Arial";
            reverseArrowCtx.textAlign = "center", reverseArrowCtx.textBaseline = "middle";
            reverseArrowCtx.fillStyle = "white";
            reverseArrowCtx.fillText("➔", halfCsPixel, halfCsPixel);

            overlayCtx.drawImage(reverseArrowCanvas, x, y);
        }

        // Draws slider ball and follow circle to additional canvas
        if (isMoving) {
            var sliderBallPos = GraphicUtil.getCoordFromCoordArray(this.sliderPathPoints, MathUtil.reflect(completion));
            var fadeOutCompletion = Math.min(1, Math.max(0, (audioCurrentTime - this.letGoTime) / 120));
            this.followCircleCanvas.style.transform = "translate(" + (sliderBallPos.x - this.minX + halfCsPixel - maxFollowCircleRadius) + "px," + (sliderBallPos.y - this.minY + halfCsPixel - maxFollowCircleRadius) + "px) scale(" + ((this.letGoTime == null) ? 1 : 1 + fadeOutCompletion * 0.5) + ")"; // transform is gazillions of times faster than absolute positioning
            this.followCircleCanvas.style.opacity = (this.letGoTime == null) ? 1 : (1 - fadeOutCompletion);

            var colour = currentBeatmap.colours[this.comboInfo.comboNum % currentBeatmap.colours.length];
            var colourString = "rgb(" + colour.r + "," + colour.g + "," + colour.b + ")";

            overlayCtx.beginPath();
            overlayCtx.arc(sliderBallPos.x - this.minX + halfCsPixel, sliderBallPos.y - this.minY + halfCsPixel, sliderBodyRadius, 0, pi2);
            overlayCtx.fillStyle = colourString;
            overlayCtx.fill();
            
            var followCircleRadius = halfCsPixel * (
                /* base */ 1
              + /* enlarge on start */ Math.min(1, (audioCurrentTime - this.time) / 100)
              + ((this.letGoTime == null) ?
                    /* pulse */ Math.max(0, Math.min(0.15, 0.15 - (currentSliderTime - this.lastPulseTime) / 150 * 0.18))
                  + /* shrink on end */ -0.5 + Math.pow(Math.max(0, Math.min(1, (1 - (audioCurrentTime - this.endTime) / 175))), 2) * 0.5
                :
                    0
                )
            );
            var lineWidth = followCircleRadius * 0.1;

            sliderBallCtx.clearRect(0, 0, maxFollowCircleRadius * 2, maxFollowCircleRadius * 2);
            sliderBallCtx.beginPath();
            sliderBallCtx.arc(maxFollowCircleRadius, maxFollowCircleRadius, followCircleRadius - lineWidth / 2, 0, pi2);
            sliderBallCtx.strokeStyle = "white";
            sliderBallCtx.lineWidth = lineWidth;
            sliderBallCtx.stroke();
        }
        
        if (currentSliderTime < this.endTime - this.time + 175) {
            requestAnimationFrame(this.updateOverlay.bind(this));
        }
    };
    
    this.followCircleCanvas = document.createElement("canvas");
    this.followCircleCanvas.setAttribute("width", maxFollowCircleRadius * 2);
    this.followCircleCanvas.setAttribute("height", maxFollowCircleRadius * 2);
    var sliderBallCtx = this.followCircleCanvas.getContext("2d");
    
    function getLowestTickCompletionFromCurrentRepeat(completion) {
        var currentRepeat = Math.floor(completion);
        for (var i = 0; i < this.sliderTickCompletions.length; i++) {
            if (this.sliderTickCompletions[i] > currentRepeat) {
                return this.sliderTickCompletions[i];
            }
        }
    }

    this.sliderHeadContainer = document.createElement("div");
    this.sliderHeadContainer.className = "hitCircleContainer";
    this.sliderHeadContainer.style.width = csPixel + "px";
    this.sliderHeadContainer.style.height = csPixel + "px";
    this.sliderHeadContainer.style.left = this.sliderPathPoints[0].x - this.minX + "px";
    this.sliderHeadContainer.style.top = this.sliderPathPoints[0].y - this.minY + "px";

    var sliderHeadBaseCanvas = document.createElement("canvas"); // Create local object canvas
    sliderHeadBaseCanvas.setAttribute("width", csPixel);
    sliderHeadBaseCanvas.setAttribute("height", csPixel);

    var sliderHeadBaseCtx = sliderHeadBaseCanvas.getContext("2d");
    GraphicUtil.drawCircle(sliderHeadBaseCtx, 0, 0, this.comboInfo);

    this.approachCircleCanvas = document.createElement("canvas");
    this.approachCircleCanvas.setAttribute("width", csPixel);
    this.approachCircleCanvas.setAttribute("height", csPixel);
    this.approachCircleCanvas.style.transform = "scale(3.5)";

    var approachCtx = this.approachCircleCanvas.getContext("2d");
    GraphicUtil.drawApproachCircle(approachCtx, 0, 0, this.comboInfo.comboNum);

    this.sliderHeadContainer.appendChild(sliderHeadBaseCanvas);
    this.sliderHeadContainer.appendChild(this.approachCircleCanvas);

    this.containerDiv.appendChild(overlay);
    this.containerDiv.appendChild(this.sliderHeadContainer);
    this.containerDiv.appendChild(this.followCircleCanvas);
};