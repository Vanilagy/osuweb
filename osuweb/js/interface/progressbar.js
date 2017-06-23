/**
 * Created by Sebastian on 23.06.2017.
 */
function ProgressBar() {
    // TODO: insert real max width of accuracy text
    currentScene.elements.accContainerDiv.style.width = "calc(5vh + 1vw + 6vw)";

    this.canvas = currentScene.elements.progressCanvas;
    this.ctx = this.canvas.getContext("2d");

    this.prelude = 2000;
    this.mapStartTime = currentPlay.hitObjects[0].time;
    this.mapEndTime = currentPlay.hitObjects[currentPlay.hitObjects.length - 1].endTime;

    this.animationLoop = (function() {
        if(currentScene.elements.progressCanvas.clientWidth > 0) {
            this.canvas.width = currentScene.elements.progressCanvas.clientWidth;
            this.canvas.height = currentScene.elements.progressCanvas.clientHeight;
        }

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.beginPath();
        this.ctx.lineWidth = this.canvas.height / 2.0 + 1;
        if(currentPlay.audioStartTime != null && audioCurrentTime < this.mapStartTime) {
            var preludeProgress = (audioCurrentTime + this.prelude) / (this.mapStartTime + this.prelude);
            
            this.ctx.strokeStyle = "rgba(0,255,0,0.6)";
            this.ctx.arc(this.canvas.width / 2.0, this.canvas.height / 2.0, this.canvas.height / 4.0, Math.PI * 2 * preludeProgress + Math.PI * 1.5, Math.PI * 1.5);
        }
        else if(currentPlay.audioStartTime != null) {
            var songProgress = (audioCurrentTime - this.mapStartTime) / (this.mapEndTime - this.mapStartTime);

            if(songProgress > 1) songProgress = 1;

            this.ctx.strokeStyle = "rgba(200,200,200,0.6)";
            this.ctx.arc(this.canvas.width / 2.0, this.canvas.height / 2.0, this.canvas.height / 4.0, Math.PI * 1.5, Math.PI * 2 * songProgress + Math.PI * 1.5);
        }
        this.ctx.stroke();


        this.ctx.beginPath();
        this.ctx.fillStyle = "white";
        this.ctx.arc(this.canvas.width / 2.0, this.canvas.height / 2.0, 3, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.beginPath();
        this.ctx.strokeStyle = "white";
        this.ctx.lineWidth = 3;
        this.ctx.arc(this.canvas.width / 2.0, this.canvas.height / 2.0, this.canvas.height / 2.0 - 1, 0, Math.PI * 2);
        this.ctx.stroke();

        requestAnimationFrame(this.animationLoop);
    }).bind(this);

    requestAnimationFrame(this.animationLoop);
}