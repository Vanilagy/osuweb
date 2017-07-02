"use strict";

export class MathUtil {
	static coordsOnBezier(pointArray, t) {
        let bx = 0, by = 0, n = pointArray.length - 1; // degree

        if (n === 1) { // if linear
            bx = (1 - t) * pointArray[0].x + t * pointArray[1].x;
            by = (1 - t) * pointArray[0].y + t * pointArray[1].y;
        } else if (n === 2) { // if quadratic
            bx = (1 - t) * (1 - t) * pointArray[0].x + 2 * (1 - t) * t * pointArray[1].x + t * t * pointArray[2].x;
            by = (1 - t) * (1 - t) * pointArray[0].y + 2 * (1 - t) * t * pointArray[1].y + t * t * pointArray[2].y;
        } else if (n === 3) { // if cubic
            bx = (1 - t) * (1 - t) * (1 - t) * pointArray[0].x + 3 * (1 - t) * (1 - t) * t * pointArray[1].x + 3 * (1 - t) * t * t * pointArray[2].x + t * t * t * pointArray[3].x;
            by = (1 - t) * (1 - t) * (1 - t) * pointArray[0].y + 3 * (1 - t) * (1 - t) * t * pointArray[1].y + 3 * (1 - t) * t * t * pointArray[2].y + t * t * t * pointArray[3].y;
        } else { // generalized equation
            for(let i = 0; i <= n; i++) {
                bx += this.binomialCoef(n, i) * Math.pow(1 - t, n - i) * Math.pow(t, i) * pointArray[i].x;
                by += this.binomialCoef(n, i) * Math.pow(1 - t, n - i) * Math.pow(t, i) * pointArray[i].y;
            }
        }

        return {x: bx, y: by}
	}
    static binomialCoef(n, k) {
		let r = 1;

        if (k > n)
            return 0;

        for (let d = 1; d <= k; d++) {
            r *= n--;
            r /= d;
        }

        return r;
	}
    static circleCenterPos(p1, p2, p3) {
        let yDelta_a = p2.y - p1.y;
        let xDelta_a = p2.x - p1.x;
        let yDelta_b = p3.y - p2.y;
        let xDelta_b = p3.x - p2.x;
        let center = {x: 0, y: 0};

        let aSlope = yDelta_a/xDelta_a;
        let bSlope = yDelta_b/xDelta_b;

        let AB_Mid = {x: (p1.x+p2.x)/2, y: (p1.y+p2.y)/2};
        let BC_Mid = {x: (p2.x+p3.x)/2, y: (p2.y+p3.y)/2};

        if(yDelta_a === 0)         //aSlope == 0
        {
            center.x = AB_Mid.x;
            if (xDelta_b === 0)         //bSlope == INFINITY
            {
                center.y = BC_Mid.y;
            }
            else
            {
                center.y = BC_Mid.y + (BC_Mid.x-center.x)/bSlope;
            }
        }
        else if (yDelta_b === 0)               //bSlope == 0
        {
            center.x = BC_Mid.x;
            if (xDelta_a === 0)             //aSlope == INFINITY
            {
                center.y = AB_Mid.y;
            }
            else
            {
                center.y = AB_Mid.y + (AB_Mid.x-center.x)/aSlope;
            }
        }
        else if (xDelta_a === 0)        //aSlope == INFINITY
        {
            center.y = AB_Mid.y;
            center.x = bSlope*(BC_Mid.y-center.y) + BC_Mid.x;
        }
        else if (xDelta_b === 0)        //bSlope == INFINITY
        {
            center.y = BC_Mid.y;
            center.x = aSlope*(AB_Mid.y-center.y) + AB_Mid.x;
        }
        else
        {
            center.x = (aSlope*bSlope*(AB_Mid.y-BC_Mid.y) - aSlope*BC_Mid.x + bSlope*AB_Mid.x)/(bSlope-aSlope);
            center.y = AB_Mid.y - (center.x - AB_Mid.x)/aSlope;
        }

        return center;
    }
    static reflect(val) {
        if (Math.floor(val) % 2 === 0) {
            return val - Math.floor(val);
        } else {
            return 1 - (val - Math.floor(val));
        }
    }
    static distance(p1, p2) {
	    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
    }
    static getRandomInt(min, max)
    {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    static interpolate(from, to, dur, type, callback, id, fps) {
        if (!fps) {
            fps = 60;
        }
        if (!id) {
            id = 0;
        }
        clearInterval(interpolationStorage[id]);
        if (callback === undefined) {
            callback = function(x) {};
        }

        let iterationsNeeded = Math.floor(dur / (1000 / fps));
        let count = 0;
        let difference = to - from;
        let num = from;
        callback(from);

        interpolationStorage[id] = setInterval(function() {
            num = from + difference * getInterpolatedValue(count / iterationsNeeded);
            callback(num);
            if (count === iterationsNeeded) {
                clearInterval(interpolationStorage[id]);
                callback(to);
            }
            count++;
        }, 1000 / fps);

        function getInterpolatedValue(completion) {
            if (type === "linear") {
                return completion;
            } else if (type === "easeOut") {
                return -(completion * completion) + 2 * completion;
            } else if (type === "easeIn") {
                return completion * completion;
            } else if (type === "easeInOut") {
                return Math.cos(Math.PI * completion) * -0.5 + 0.5;
            }
        }
    }
    static getNormalizedAngleDelta(alpha, beta) {
        let difference = alpha - beta;
        if (beta - alpha < -Math.PI) {
            difference -= Math.PI * 2;
        } else if (difference < -Math.PI) {
            difference += Math.PI * 2;
        }
        return difference;
    }
    static getAvg(array) {
        let total = 0, len = array.length;
        for (let i = 0; i < len; i++) {
            total += array[i];
        }
        return total / len;
    }
}

let interpolationStorage = {};