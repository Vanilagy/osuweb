function Circle(data) {
    HitObject.call(this, data);
    this.type = "circle";
    
    this.hittable = true;
}

Circle.prototype = Object.create(HitObject.prototype);
Circle.prototype.constructor = Circle;

Circle.prototype.hit = function(timeDelta) {
    var score = TimingUtil.getScoreFromHitDelta(Math.abs(timeDelta));
    this.hittable = false;

    if (score) {
        currentPlay.score.addScore(score, false, false, this);
        this.playHitSound(this.hitSoundInfo);
        currentPlay.accmeter.addRating(timeDelta);
    } else {
        currentPlay.score.addScore(0, false, true, this);
    }
    
    this.containerDiv.style.animation = (score) ? "0.15s destroyHitCircle linear forwards" : "0.15s fadeOut linear forwards";
    this.approachCircleCanvas.style.display = "none";
};

Circle.prototype.draw = function() {
    this.containerDiv = document.createElement("div");
    this.containerDiv.className = "hitCircleContainer";
    this.containerDiv.style.width = csPixel + "px";
    this.containerDiv.style.height = csPixel + "px";
    this.containerDiv.style.left = ((this.x + currentPlay.marginWidth) * pixelRatio - halfCsPixel) + "px", this.containerDiv.style.top = ((this.y + currentPlay.marginHeight) * pixelRatio - halfCsPixel) + "px";
    this.containerDiv.style.zIndex = this.zIndex;

    this.containerDiv.style.visibility = "hidden";
    this.containerDiv.style.opacity = 0;
    this.containerDiv.style.transition = "opacity " + (currentPlay.ARMs / 1000 / 3) + "s linear";

    var baseCanvas = document.createElement("canvas"); // Create local object canvas
    baseCanvas.setAttribute("width", csPixel);
    baseCanvas.setAttribute("height", csPixel);

    var ctx = baseCanvas.getContext("2d");
    GraphicUtil.drawCircle(ctx, 0, 0, this.comboInfo);

    this.approachCircleCanvas = document.createElement("canvas");
    this.approachCircleCanvas.setAttribute("width", csPixel);
    this.approachCircleCanvas.setAttribute("height", csPixel);
    this.approachCircleCanvas.style.transform = "scale(3.5)";

    var approachCtx = this.approachCircleCanvas.getContext("2d");
    GraphicUtil.drawApproachCircle(approachCtx, 0, 0, this.comboInfo.comboNum);

    this.containerDiv.appendChild(baseCanvas);
    this.containerDiv.appendChild(this.approachCircleCanvas);
};