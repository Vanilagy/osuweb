var pi2 = Math.PI * 2;
var maximumTracePointDistance = 3; // The maximum distance two points in a slider's traced path can be apart – used to control detail in sliders.
var circleBorderWidth = 1.75 / 16; // in relation to circle radius
var interpolationStorage = {};

var GraphicUtil = {
    widthToHeightRatio: 3 / 4,
    coordinateDimensions: {
        x: 512,
        y: 384
    },
    playAreaDimensions: {
        x: 640,
        y: 480
    },
    pi2: Math.PI * 2,
    drawCircle: function(context, x, y, comboInfo) { // Draws circle used for Hit Circles, Slider Heads and Repeat Tails
        context.beginPath(); // Draw circle base (will become border)
        context.arc(x + halfCsPixel, y + halfCsPixel, halfCsPixel, 0, pi2);
        context.fillStyle = "white";
        context.fill();

        var colour = currentBeatmap.colours[comboInfo.comboNum % currentBeatmap.colours.length];
        var colourString = "rgb(" + Math.round(colour.r * 0.8) + "," + Math.round(colour.g * 0.8) + "," + Math.round(colour.b * 0.8) + ")";
        var darkColourString = "rgb(" + Math.round(colour.r * 0.3) + "," + Math.round(colour.g * 0.3) + "," + Math.round(colour.b * 0.3) + ")";

        var radialGradient = context.createRadialGradient(x + halfCsPixel, y + halfCsPixel, 0, x + halfCsPixel, y + halfCsPixel, halfCsPixel);
        radialGradient.addColorStop(0, colourString);
        radialGradient.addColorStop(1, darkColourString);

        context.beginPath(); // Draw circle body with radial gradient
        context.arc(x + halfCsPixel, y + halfCsPixel, halfCsPixel * (1 - circleBorderWidth), 0, pi2);
        context.fillStyle = radialGradient;
        context.fill();
        context.fillStyle = "rgba(255, 255, 255, 0.5)";
        context.globalCompositeOperation = "destination-out"; // Transparency
        context.fill();

        var innerType = "number";
        context.globalCompositeOperation = "source-over";

        if (innerType == "number") {
            context.font = "lighter " + (csPixel * 0.41) + "px Arial";
            context.textAlign = "center", context.textBaseline = "middle";
            context.fillStyle = "white";
            context.fillText(comboInfo.n, x + halfCsPixel, y + halfCsPixel);
        } else {
            context.beginPath();
            context.arc(x + halfCsPixel, y + halfCsPixel, halfCsPixel * 0.25, 0, pi2);
            context.fillStyle = "white";
            context.fill();
        }
    },
    drawApproachCircle: function(context, x, y, comboNum) {
        context.beginPath();
        context.arc(x + halfCsPixel, y + halfCsPixel, halfCsPixel * ((1 - circleBorderWidth) + 1) / 2, 0, pi2);
        var color = currentPlay.beatmap.colours[comboNum % currentPlay.beatmap.colours.length];
        context.strokeStyle = "rgb(" + color.r + ", " + color.g + ", " + color.b + ")";
        context.lineWidth = halfCsPixel * circleBorderWidth;
        context.stroke();
    },
    getCoordFromCoordArray: function(arr, percent) {
        var actualIdx = percent * (arr.length - 1);
        var lowerIdx = Math.floor(actualIdx), upperIdx = Math.ceil(actualIdx);
        var lowerPos = arr[lowerIdx];
        var upperPos = arr[upperIdx];

        return { // Linear interpolation
            x: lowerPos.x * (1 - (actualIdx - lowerIdx)) + upperPos.x * (actualIdx - lowerIdx),
            y: lowerPos.y * (1 - (actualIdx - lowerIdx)) + upperPos.y * (actualIdx - lowerIdx)
        }
    },
    interpolate: function(from, to, dur, type, callback, id, fps) {
        if (!fps) {
            fps = 60;
        }
        if (!id) {
            id = 0;
        }
        clearInterval(interpolationStorage[id]);
        if (callback === undefined) {
            callback = function(x) {return};
        }

        var iterationsNeeded = Math.floor(dur / (1000 / fps));
        var count = 0;
        var difference = to - from;
        var num = from;
        callback(from);

        interpolationStorage[id] = setInterval(function() {
            num = from + difference * getInterpolatedValue(count / iterationsNeeded);
            callback(num);
            if (count == iterationsNeeded) {
                clearInterval(interpolationStorage[id]);
                callback(to);
            }
            count++;
        }, 1000 / fps);

        function getInterpolatedValue(completion) {
            if (type == "linear") {
                return completion;
            } else if (type == "easeOut") {
                return -(completion * completion) + 2 * completion;
            } else if (type == "easeIn") {
                return completion * completion;
            } else if (type == "easeInOut") {
                return Math.cos(Math.PI * completion) * -0.5 + 0.5;
            }
        }
    }
}