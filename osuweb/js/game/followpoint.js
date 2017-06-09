function FollowPoint(obj1, obj2) {
    this.startTime = obj1.endTime;
    this.endTime = obj2.time;
    this.startPos = obj1.basePoint;
    this.endPos = obj2.startPoint;
}

FollowPoint.prototype.spawn = function() {
    this.length = Math.hypot(this.startPos.x - this.endPos.x, this.startPos.y - this.endPos.y) * currentPlay.pixelRatio;
    this.height = 2 * currentPlay.pixelRatio;
    var angle = Math.atan2(this.endPos.y - this.startPos.y, this.endPos.x - this.startPos.x);
    var centerPoint = {
        x: (this.startPos.x + this.endPos.x) / 2,
        y: (this.startPos.y + this.endPos.y) / 2
    };

    this.canvas = document.createElement("canvas");
    this.canvas.className = "followPoint";
    this.canvas.setAttribute("height", this.height);
    this.canvas.setAttribute("width", this.length);
    this.canvas.style.zIndex = 0;
    this.canvas.style.left = (centerPoint.x + currentPlay.marginWidth) * currentPlay.pixelRatio + "px";
    this.canvas.style.top = (centerPoint.y + currentPlay.marginHeight) * currentPlay.pixelRatio + "px";
    this.canvas.style.transform = "translate(-50%, -50%) rotate(" + angle + "rad)";

    var ctx = this.canvas.getContext("2d");

    this.update = function() {
        var shouldEnd = currentPlay.audioCurrentTime >= this.endTime + 300;
        if (shouldEnd) {
            if(this.canvas.parentNode != null) this.canvas.parentNode.removeChild(this.canvas);
        } else {
            var timeDif = this.endTime - this.startTime;
            var startingPointX = Math.max(0, Math.min(1, (currentPlay.audioCurrentTime - (this.startTime + 0)) / timeDif)) * this.length;
            var endPointX = Math.max(0, Math.min(1, (currentPlay.audioCurrentTime - (this.startTime - 450)) / timeDif)) * this.length;
            ctx.clearRect(0, 0, this.length, 3);
            ctx.beginPath();
            ctx.rect(startingPointX, 0, endPointX, this.height);
            ctx.fillStyle = "white";
            ctx.globalCompositeOperation = "source-over";
            ctx.fill();

            ctx.globalCompositeOperation = "destination-out";
            var fadeInLength = 90 * currentPlay.pixelRatio;

            var leftGradient = ctx.createLinearGradient(0, 0, fadeInLength, 0);
            leftGradient.addColorStop(0, "rgba(255, 255, 255, 1.0)");
            leftGradient.addColorStop(1, "rgba(255, 255, 255, 0.0)");

            ctx.beginPath();
            ctx.rect(0, 0, fadeInLength, this.height);
            ctx.fillStyle = leftGradient;
            ctx.fill();

            var rightGradient = ctx.createLinearGradient(this.length - fadeInLength, 0, this.length, 0);
            rightGradient.addColorStop(0, "rgba(255, 255, 255, 0.0)");
            rightGradient.addColorStop(1, "rgba(255, 255, 255, 1.0)");

            ctx.beginPath();
            ctx.rect(this.length - fadeInLength, 0, fadeInLength, this.height);
            ctx.fillStyle = rightGradient;
            ctx.fill();
        }

        if (!shouldEnd) {
            requestAnimationFrame(this.update.bind(this));
        }
    };
    this.update.bind(this)();

    currentScene.objectContainerDiv.appendChild(this.canvas);
};