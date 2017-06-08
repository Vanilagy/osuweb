/**
 * Created by Sebastian on 07.06.2017.
 */

function VolumeControl() {
    this.canvas = currentScene.osuwebCanvas;
    this.ctx = this.canvas.getContext("2d");

    this.targetMaster = settings.master;

    this.animationLoop = (function() {
            if(this.targetMaster != settings.master) {
                settings.setMaster(settings.master + Math.pow(Math.abs(this.targetMaster - settings.master), 1.5) * (this.targetMaster > settings.master ? 1 : -1));

                if(Math.abs(this.targetMaster - settings.master) < 0.01) {
                    settings.setMaster(this.targetMaster);
                }
            }

            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

            this.drawBackgroundMaster();

            this.drawVolumeBarMaster();

            this.drawTextMaster();

            requestAnimationFrame(this.animationLoop);
    }).bind(this);

    requestAnimationFrame(this.animationLoop);

    this.animateMaster = function(value) {
        this.targetMaster += value;

        if(this.targetMaster > 1.0) this.targetMaster = 1.0;
        if(this.targetMaster < 0.0) this.targetMaster = 0.0;
    };

    this.drawTextMaster = function() {
        this.ctx.save();
        this.ctx.font = "30px Calibri";
        this.ctx.fillStyle = "white";

        var text = Math.round(settings.master*100)+"%";
        var textSize = this.ctx.measureText(text);

        this.ctx.fillText(text, this.canvas.width - 125 - textSize.width / 2, this.canvas.height - 125 + 8);
        this.ctx.restore();
    };

    this.drawVolumeBarMaster = function() {
        this.ctx.save();
        this.ctx.beginPath();
        if(settings.master >= 0.9999999) {
            this.ctx.arc(this.canvas.width - 125, this.canvas.height - 125, 61, 0, 2*Math.PI);
        }
        else if(settings.master <= 0.0000001) {
            this.ctx.arc(this.canvas.width - 125, this.canvas.height - 125, 61, 0, 2*Math.PI);
        }
        else {
            this.ctx.arc(this.canvas.width - 125, this.canvas.height - 125, 61, 2*Math.PI*settings.master-0.5*Math.PI, -0.5*Math.PI);
        }
        this.ctx.lineWidth = 10;
        this.ctx.strokeStyle = "rgba(60,80,91,0.95)";
        this.ctx.shadowColor = "#0069a0";
        this.ctx.shadowBlur = 20;
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.arc(this.canvas.width - 125, this.canvas.height - 125, 61, -0.5*Math.PI, 2*Math.PI*settings.master-0.5*Math.PI);
        this.ctx.lineWidth = 10;
        this.ctx.strokeStyle = "white";
        this.ctx.shadowColor = "#35b5ff";
        this.ctx.shadowBlur = 20;
        this.ctx.stroke();
        this.ctx.restore();
    };

    this.drawBackgroundMaster = function() {
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.arc(this.canvas.width - 125, this.canvas.height - 125, 80, 0, 2*Math.PI);
        this.ctx.fill();
        this.ctx.restore();
    };


}
