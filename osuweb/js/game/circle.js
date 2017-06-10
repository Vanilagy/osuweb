function Circle(data) {
    this.type = "circle";
    this.x = data.x;
    this.y = data.y;
    this.startPoint = {x: this.x, y: this.y};
    this.basePoint = {x: this.x, y: this.y};
    this.time = data.time;
    this.endTime = this.time;
    this.newCombo = data.newCombo;
    this.stackHeight = 0;
    this.hitCircleExploded = false;
}
Circle.prototype.show = function(offset) {
    this.containerDiv.style.visibility = "visible";
    this.containerDiv.style.transition = "opacity " + (((currentPlay.ARMs / 2) - offset) / 1000) + "s linear";
    this.containerDiv.style.opacity = 1;
    this.approachCircleCanvas.style.transform = "scale(1.0)";
    this.approachCircleCanvas.style.transition = "transform " + ((currentPlay.ARMs - offset) / 1000) + "s linear";
};

Circle.prototype.remove = function() {
    this.containerDiv.parentNode.removeChild(this.containerDiv);
};

Circle.prototype.append = function() {
    currentScene.objectContainerDiv.appendChild(this.containerDiv);
};

Circle.prototype.updateStackPosition = function() {
    this.x += this.stackHeight * -4;
    this.y += this.stackHeight * -4;
};

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