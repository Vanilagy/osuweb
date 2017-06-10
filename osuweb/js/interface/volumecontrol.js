/**
 * Created by Sebastian on 07.06.2017.
 */

function VolumeControl() {
    this.canvas = currentScene.osuwebCanvas;
    this.ctx = this.canvas.getContext("2d");
    this.radius = 0;
    this.targetRadius = 80;
    this.alpha = 0;

    this.entranceAnimation = 0;
    this.entranceEnd = 30;
    this.lastFrame = window.performance.now();

    // The time this will fade away after no changes
    this.fadeOutStart = 2000;
    this.lastChange = window.performance.now();

    this.targetMaster = settingsData.master;

    this.animationLoop = (function() {
        var frameModifier = (window.performance.now() - this.lastFrame) / (1000/60.0);
        this.lastFrame = window.performance.now();

        // entrance animation
        if(this.entranceAnimation <= this.entranceEnd) {
            this.entranceAnimation += frameModifier;

            var t = this.entranceAnimation * 1 / 10;

            var amplitudeNow = -0.3 * Math.pow(Math.E, -1.8*t) * Math.cos(2*Math.PI*t) + 1;
            console.log(amplitudeNow);
            this.radius = this.targetRadius * amplitudeNow;
            this.alpha = Math.min(1.0, Math.pow(this.entranceAnimation / this.entranceEnd, 0.25));
        }

        if(this.targetMaster != settingsData.master) {
            this

            settings.setMaster(settingsData.master + (Math.pow(Math.abs(this.targetMaster - settingsData.master), 1.5) * (this.targetMaster > settingsData.master ? 1 : -1)) * frameModifier);

            if(Math.abs(this.targetMaster - settingsData.master) < 0.01) {
                settings.setMaster(this.targetMaster);
            }
        }

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        var lastChangeDiff = window.performance.now() - this.lastChange;

        if(lastChangeDiff > 1500) {
            lastChangeDiff -= 1500;

            this.alpha = Math.max(0.0, this.alpha - 1/15 * frameModifier);
            this.radius = Math.max(0.0, this.radius - 2 * frameModifier);

            if(this.alpha <= 0.00001) {
                controls.volumeControl = null;
                return;
            }
        }
        else if(this.entranceAnimation > this.entranceEnd) {
            this.alpha = Math.min(1.0, this.alpha + 1/15 * frameModifier);
            this.radius = Math.min(this.targetRadius, this.radius + 2 * frameModifier);
        }

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

        this.lastChange = window.performance.now();
    };

    this.drawTextMaster = function() {
        this.ctx.save();
        this.ctx.globalAlpha = this.alpha;
        this.ctx.font = Math.round((this.radius / 80.0) * 30)+"px Calibri";
        this.ctx.fillStyle = "white";

        var text = Math.round(settingsData.master*100)+"%";
        var textSize = this.ctx.measureText(text);

        this.ctx.fillText(text, this.canvas.width - 125 - textSize.width / 2, this.canvas.height - 125 + 8);
        this.ctx.restore();
    };

    this.drawVolumeBarMaster = function() {
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.globalAlpha = this.alpha;
        if(settingsData.master >= 0.9999999) {
            this.ctx.arc(this.canvas.width - 125, this.canvas.height - 125, Math.round((this.radius / 80.0) * 61), 0, 2*Math.PI);
        }
        else if(settingsData.master <= 0.0000001) {
            this.ctx.arc(this.canvas.width - 125, this.canvas.height - 125, Math.round((this.radius / 80.0) * 61), 0, 2*Math.PI);
        }
        else {
            this.ctx.arc(this.canvas.width - 125, this.canvas.height - 125, Math.round((this.radius / 80.0) * 61), 2*Math.PI*settingsData.master-0.5*Math.PI, -0.5*Math.PI);
        }
        this.ctx.lineWidth = 10;
        this.ctx.strokeStyle = "rgba(60,80,91,0.95)";
        this.ctx.shadowColor = "#0069a0";
        this.ctx.shadowBlur = 20;
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.arc(this.canvas.width - 125, this.canvas.height - 125, Math.round((this.radius / 80.0) * 61), -0.5*Math.PI, 2*Math.PI*settingsData.master-0.5*Math.PI);
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
        this.ctx.globalAlpha = this.alpha;
        this.ctx.arc(this.canvas.width - 125, this.canvas.height - 125, this.radius, 0, 2*Math.PI);
        this.ctx.fill();
        this.ctx.restore();
    };
}
