var interpolationStorage = {};

function interpolate(from, to, dur, type, callback, id, fps) {
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