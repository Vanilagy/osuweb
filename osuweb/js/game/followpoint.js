function FollowPoint(obj1, obj2) {
    this.startTime = obj1.endTime;
    this.endTime = obj2.time;
    this.startPos = {
        x: obj1.basePoint.x - obj1.stackHeight * 4,
        y: obj1.basePoint.y - obj1.stackHeight * 4
    };
    this.endPos = {
        x: obj2.startPoint.x - obj2.stackHeight * 4,
        y: obj2.startPoint.y - obj2.stackHeight * 4
    };
    
    this.length = Math.hypot(this.startPos.x - this.endPos.x, this.startPos.y - this.endPos.y) * pixelRatio;
    this.height = 2 * pixelRatio;
    this.angle = Math.atan2(this.endPos.y - this.startPos.y, this.endPos.x - this.startPos.x);
    this.centerPoint = {
        x: (this.startPos.x + this.endPos.x) / 2,
        y: (this.startPos.y + this.endPos.y) / 2
    }
    
    this.canvas = document.createElement("canvas");
    this.canvas.className = "followPoint";
    this.canvas.setAttribute("height", this.height);
    this.canvas.setAttribute("width", this.length);
    this.canvas.style.zIndex = 0;
    this.canvas.style.left = (this.centerPoint.x + currentPlay.marginWidth) * pixelRatio + "px";
    this.canvas.style.top = (this.centerPoint.y + currentPlay.marginHeight) * pixelRatio + "px";
    this.canvas.style.transform = "translate(-50%, -50%) rotate(" + this.angle + "rad)";
}

FollowPoint.prototype.spawn = function() {
    currentScene.elements["objectContainerDiv"].appendChild(this.canvas);
    var ctx = this.canvas.getContext("2d");

    this.update = function() {
        var shouldEnd = audioCurrentTime >= this.endTime + 300;
        if (shouldEnd) {
            currentScene.elements["objectContainerDiv"].removeChild(this.canvas);
        } else {
            var timeDif = this.endTime - this.startTime;
            var startingPointX = Math.max(0, Math.min(1, (audioCurrentTime - (this.startTime + 300)) / timeDif)) * this.length;
            var endPointX = Math.max(0, Math.min(1, (audioCurrentTime - (this.startTime - 450)) / timeDif)) * this.length;
            ctx.clearRect(0, 0, this.length, this.height);
            ctx.beginPath();
            ctx.rect(startingPointX, 0, endPointX, this.height);
            ctx.fillStyle = "white";
            ctx.globalCompositeOperation = "source-over";
            ctx.fill();

            ctx.globalCompositeOperation = "destination-out";
            var fadeInLength = 90 * pixelRatio;

            if(isNaN(startingPointX) && !shouldEnd) {
                //requestAnimationFrame(this.update.bind(this));
                return;
            }
            
            var leftGradient = ctx.createLinearGradient(startingPointX, 0, startingPointX + fadeInLength, 0);
            leftGradient.addColorStop(0, "rgba(255, 255, 255, 1.0)");
            leftGradient.addColorStop(1, "rgba(255, 255, 255, 0.0)");

            ctx.beginPath();
            ctx.rect(startingPointX, 0, fadeInLength, this.height);
            ctx.fillStyle = leftGradient;
            ctx.fill();

            var rightGradient = ctx.createLinearGradient(this.length - fadeInLength, 0, this.length, 0);
            rightGradient.addColorStop(0, "rgba(255, 255, 255, 0.0)");
            rightGradient.addColorStop(1, "rgba(255, 255, 255, 1.0)");

            ctx.beginPath();
            ctx.rect(this.length - fadeInLength, 0, fadeInLength, this.height);
            ctx.fillStyle = rightGradient;
            ctx.fill();
            
            requestAnimationFrame(this.update.bind(this));
        }
    };
    this.update.bind(this)();
};