function AccMeter() {
    this.scale = 2;
    this.wrapper = currentScene.elements.accmeterDiv;

    currentScene.elements.accmeterDiv.style.width = (199.5 - 10 * currentPlay.beatmap.OD) * 2 * this.scale;

    currentScene.elements.accstrip50Div.style.width = (199.5 - 10 * currentPlay.beatmap.OD) * 2 * this.scale;
    currentScene.elements.accstrip100Div.style.width = (139.5 - 8 * currentPlay.beatmap.OD) * 2 * this.scale;
    currentScene.elements.accstrip300Div.style.width = (79.5 - 6 * currentPlay.beatmap.OD) * 2 * this.scale;

    currentScene.elements.acctickXDiv.style.width = this.scale;

    this.center = Math.floor((199.5 - 10 * currentPlay.beatmap.OD) * 2 * this.scale / 2) - Math.floor(this.scale / 2);
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

    //tickDiv.style.opacity = "0";
};