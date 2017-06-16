function Circle(data) {
    HitObject.call(this, data);
    this.type = "circle";
    
    this.hittable = true;
}

Circle.prototype.remove = function() {
    objectContainerDiv.removeChild(this.containerDiv);
};
Circle.prototype.append = function() {
    objectContainerDiv.appendChild(this.containerDiv);
};

Circle.prototype.show = function(offset) {
    HitObject.prototype.show.call(this, offset);
};

Circle.prototype.hit = function(success) {
    this.hittable = false;
    
    this.containerDiv.style.animation = (success) ? "0.15s destroyHitCircle linear forwards" : "0.15s fadeOut linear forwards";
    this.approachCircleCanvas.style.display = "none";
}

Circle.prototype.updateStackPosition = function() {
    this.x += this.stackHeight * -4;
    this.y += this.stackHeight * -4;
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