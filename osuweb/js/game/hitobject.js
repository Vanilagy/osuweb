function HitObject(data) {
    this.type = "hitobject";
    this.x = data.x;
    this.y = data.y;
    this.startPoint = {x: this.x, y: this.y};
    this.basePoint = {x: this.x, y: this.y};
    this.time = data.time;
    this.endTime = this.time;
    this.newCombo = data.newCombo;
    this.stackShift = 0;

    this.show = function(offset) {
        this.containerDiv.style.visibility = "visible";
        this.containerDiv.style.transition = "opacity " + (((currentPlay.ARMs / 2) - offset) / 1000) + "s linear";
        this.containerDiv.style.opacity = 1;
        this.approachCircleCanvas.style.transform = "scale(1.0)";
        this.approachCircleCanvas.style.transition = "transform " + ((currentPlay.ARMs - offset) / 1000) + "s linear";

        if(this.type == "slider") {
            this.updateOverlay.bind(this)();

            if (snakingSliders) {
                this.updateBase.bind(this)(false);
            }
        }
    };

    this.remove = function() {
        this.containerDiv.parentNode.removeChild(this.containerDiv);
    };

    this.append = function() {
        currentScene.objectContainerDiv.appendChild(this.containerDiv);
    };

    this.updateStackPosition = function() {
        this.x += this.stackShift;
        this.y += this.stackShift;

        if(this.type == "slider") {
            this.minX += this.stackShift * currentPlay.pixelRatio;
            this.minY += this.stackShift * currentPlay.pixelRatio;
            this.maxX += this.stackShift * currentPlay.pixelRatio;
            this.maxY += this.stackShift * currentPlay.pixelRatio;

            for(var i = 0; i < this.sliderPathPoints.length; i++) {
                this.sliderPathPoints[i].x += this.stackShift * currentPlay.pixelRatio;
                this.sliderPathPoints[i].y += this.stackShift * currentPlay.pixelRatio;
            }
        }
    };
}