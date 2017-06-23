function AccMeter() {
    this.scale = 2;
    this.wrapper = currentScene.elements.accmeterDiv;

    this.lastRatings = [];

    currentScene.elements.accmeterDiv.style.width = (199.5 - 10 * currentPlay.beatmap.OD) * 2 * this.scale;

    currentScene.elements.accstrip50Div.style.width = (199.5 - 10 * currentPlay.beatmap.OD) * 2 * this.scale;
    currentScene.elements.accstrip100Div.style.width = (139.5 - 8 * currentPlay.beatmap.OD) * 2 * this.scale;
    currentScene.elements.accstrip300Div.style.width = (79.5 - 6 * currentPlay.beatmap.OD) * 2 * this.scale;

    currentScene.elements.acctickXDiv.style.width = this.scale;

    this.center = Math.floor((199.5 - 10 * currentPlay.beatmap.OD) * 2 * this.scale / 2) - Math.floor(this.scale / 2);

    this.arrowUpdate = (function() {

        if(this.newRating) {
            var deltaCount = 0;
            var deltaSum = 0;

            for(var index in this.lastRatings) {
                var rating = this.lastRatings[index];

                if(typeof rating === "function") continue;

                if(rating.time < window.performance.now() - 10000) {
                    this.lastRatings.splice(index, 1);

                    this.wrapper.removeChild(rating.element);
                }
                else {
                    deltaSum += rating.delta;
                    deltaCount++;
                }
            }

            this.lastAvgDelta = deltaSum / deltaCount;

            if(deltaCount == 0) {
                currentScene.elements.accarrowImg.style.display = "none";
            }
            else {
                currentScene.elements.accarrowImg.style.display = "block";

                var oldValue = Math.round(currentScene.elements.accarrowImg.style.left.substr(0, currentScene.elements.accarrowImg.style.left.length - 2));
                var newValue = currentScene.elements.accmeterDiv.clientWidth / 2 - currentScene.elements.accarrowImg.clientWidth / 2.0 + this.lastAvgDelta * this.scale;

                if(currentScene.elements.accarrowImg.style.left == "") {
                    console.log(newValue);
                    currentScene.elements.accarrowImg.style.left = newValue;
                }
                else {
                    console.log(oldValue);
                    MathUtil.interpolate(oldValue, newValue, 500, "easeOut", function(val) {currentScene.elements.accarrowImg.style.left = val;}, "accarrow", 60);
                }
            }


            this.newRating = false;
        }

        requestAnimationFrame(this.arrowUpdate);
    }.bind(this));

    requestAnimationFrame(this.arrowUpdate);
}

AccMeter.prototype.addRating = function(timeDelta) {
    var tickDiv = document.createElement("div");

    tickDiv.className = "acctick";

    if(Math.abs(timeDelta) < 79.5 - 6 * currentPlay.beatmap.OD) {
        var color = "deepskyblue";
    }
    else if(Math.abs(timeDelta) < 139.5 - 8 * currentPlay.beatmap.OD) {
        var color = "greenyellow";
    }
    else {
        var color = "orange";
    }

    tickDiv.style.left = (this.center+this.scale*timeDelta)+"px";
    tickDiv.style.width = this.scale+"px";
    tickDiv.style.backgroundColor = color;

    this.wrapper.appendChild(tickDiv);

    this.lastRatings.push({time: window.performance.now(), delta: timeDelta, element: tickDiv});

    this.newRating = true;
};