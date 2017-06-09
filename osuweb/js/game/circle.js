function Circle(data) {
    HitObject.call(this, data);

    this.type = "circle";
    this.hitCircleExploded = false;
}

Circle.prototype = Object.create(HitObject.prototype);
Circle.prototype.constructor = Circle;

Circle.prototype.draw = function() {
    this.containerDiv = document.createElement("div");
    this.containerDiv.className = "hitCircleContainer";
    this.containerDiv.style.width = currentPlay.csPixel + "px";
    this.containerDiv.style.height = currentPlay.csPixel + "px";
    this.containerDiv.style.left = ((this.x + currentPlay.marginWidth) * currentPlay.pixelRatio - currentPlay.halfCsPixel) + "px", this.containerDiv.style.top = ((this.y + currentPlay.marginHeight) * currentPlay.pixelRatio - currentPlay.halfCsPixel) + "px";
    this.containerDiv.style.zIndex = this.zIndex;

    this.containerDiv.style.visibility = "hidden";
    this.containerDiv.style.opacity = 0;
    this.containerDiv.style.transition = "opacity " + (currentPlay.ARMs / 1000 / 3) + "s linear";

    var baseCanvas = document.createElement("canvas"); // Create local object canvas
    baseCanvas.setAttribute("width", currentPlay.csPixel);
    baseCanvas.setAttribute("height", currentPlay.csPixel);

    var ctx = baseCanvas.getContext("2d");
    GraphicUtil.drawCircle(ctx, 0, 0, this.comboInfo);

    this.approachCircleCanvas = document.createElement("canvas");
    this.approachCircleCanvas.setAttribute("width", currentPlay.csPixel);
    this.approachCircleCanvas.setAttribute("height", currentPlay.csPixel);
    this.approachCircleCanvas.style.transform = "scale(3.5)";

    var approachCtx = this.approachCircleCanvas.getContext("2d");
    GraphicUtil.drawApproachCircle(approachCtx, 0, 0, this.comboInfo.comboNum);

    this.containerDiv.appendChild(baseCanvas);
    this.containerDiv.appendChild(this.approachCircleCanvas);
};