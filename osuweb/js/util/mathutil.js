var MathUtil = {
	coordsOnBezier: function(pointArray, t) {
        var bx = 0, by = 0, n = pointArray.length - 1; // degree

        if (n == 1) { // if linear
            bx = (1 - t) * pointArray[0].x + t * pointArray[1].x;
            by = (1 - t) * pointArray[0].y + t * pointArray[1].y;
        } else if (n == 2) { // if quadratic
            bx = (1 - t) * (1 - t) * pointArray[0].x + 2 * (1 - t) * t * pointArray[1].x + t * t * pointArray[2].x;
            by = (1 - t) * (1 - t) * pointArray[0].y + 2 * (1 - t) * t * pointArray[1].y + t * t * pointArray[2].y;
        } else if (n == 3) { // if cubic
            bx = (1 - t) * (1 - t) * (1 - t) * pointArray[0].x + 3 * (1 - t) * (1 - t) * t * pointArray[1].x + 3 * (1 - t) * t * t * pointArray[2].x + t * t * t * pointArray[3].x;
            by = (1 - t) * (1 - t) * (1 - t) * pointArray[0].y + 3 * (1 - t) * (1 - t) * t * pointArray[1].y + 3 * (1 - t) * t * t * pointArray[2].y + t * t * t * pointArray[3].y;
        } else { // generalized equation
            for(var i = 0; i <= n; i++) {
                bx += this.binomialCoef(n, i) * Math.pow(1 - t, n - i) * Math.pow(t, i) * pointArray[i].x;
                by += this.binomialCoef(n, i) * Math.pow(1 - t, n - i) * Math.pow(t, i) * pointArray[i].y;
            }
        }

        return {x: bx, y: by}
	},
	binomialCoef: function(n, k) {
		var r = 1;

        if (k > n)
            return 0;

        for (var d = 1; d <= k; d++) {
            r *= n--;
            r /= d;
        }

        return r;
	},
    circleCenterPos: function(p1, p2, p3) {
	    /*
        var yDelta_a = p2.y - p1.y,
            xDelta_a = p2.x - p1.x,
            yDelta_b = p3.y - p2.y,
            xDelta_b = p3.x - p2.x,
            center = {};


        if (p2.x == p1.x || p2.x == p3.x) {
            var reverse = true;

            var aSlope = xDelta_a / yDelta_a,
                bSlope = xDelta_b / yDelta_b;
        }
        else {
            var aSlope = yDelta_a / xDelta_a,
                bSlope = yDelta_b / xDelta_b;
        }

        if (aSlope == 0 || aSlope == -0) {
            var temp = aSlope;
            aSlope = bSlope;
            bSlope = temp;
        }

        center.x = (aSlope * bSlope * (p1.y - p3.y) + bSlope * (p1.x + p2.x) - aSlope * (p2.x + p3.x)) / (2 * (bSlope - aSlope));
        center.y = -1 * (center.x - (p1.x + p2.x) / 2) / aSlope + (p1.y + p2.y) / 2;

        if (reverse) {
            temp = center.x;
            center.x = center.y;
            center.y = temp;
        }

        return center;
        */
        var yDelta_a = p2.y - p1.y;
        var xDelta_a = p2.x - p1.x;
        var yDelta_b = p3.y - p2.y;
        var xDelta_b = p3.x - p2.x;
        var center = {x: 0, y: 0};

        var aSlope = yDelta_a/xDelta_a;
        var bSlope = yDelta_b/xDelta_b;

        var AB_Mid = {x: (p1.x+p2.x)/2, y: (p1.y+p2.y)/2};
        var BC_Mid = {x: (p2.x+p3.x)/2, y: (p2.y+p3.y)/2};

        if(yDelta_a == 0)         //aSlope == 0
        {
            center.x = AB_Mid.x;
            if (xDelta_b == 0)         //bSlope == INFINITY
            {
                center.y = BC_Mid.y;
            }
            else
            {
                center.y = BC_Mid.y + (BC_Mid.x-center.x)/bSlope;
            }
        }
        else if (yDelta_b == 0)               //bSlope == 0
        {
            center.x = BC_Mid.x;
            if (xDelta_a == 0)             //aSlope == INFINITY
            {
                center.y = AB_Mid.y;
            }
            else
            {
                center.y = AB_Mid.y + (AB_Mid.x-center.x)/aSlope;
            }
        }
        else if (xDelta_a == 0)        //aSlope == INFINITY
        {
            center.y = AB_Mid.y;
            center.x = bSlope*(BC_Mid.y-center.y) + BC_Mid.x;
        }
        else if (xDelta_b == 0)        //bSlope == INFINITY
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
    },
    reflect: function(val) {
        if (Math.floor(val) % 2 == 0) {
            return val - Math.floor(val);
        } else {
            return 1 - (val - Math.floor(val));
        }
    },
    distance: function(p1, p2) {
	    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
    }
}