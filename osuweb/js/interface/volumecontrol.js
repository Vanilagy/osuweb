"use strict";

import {GAME_STATE, SETTINGS, SCENE_MANAGER} from "../main";

export class VolumeControl {
    constructor() {
        // The canvas and context to draw on
        this.canvas = SCENE_MANAGER.getCanvas();
        this.ctx = this.canvas.getContext("2d");

        // The radius of the master control
        this.radius = 0;
        // The radius to approach to frame-independently
        this.targetRadius = 80;
        // The opacity of this control
        this.alpha = 0;

        // The progression of the fade-in animation in frames
        this.entranceAnimation = 0;
        // The number of frames after which the entrance animation should be complete
        this.entranceEnd = 30;
        // The time of the last frame to frame-independently calculate the progress
        this.lastFrame = window.performance.now();

        // The time this will fade away after no changes
        this.fadeOutStart = 2000;
        // The time the user last made an input into this control
        this.lastChange = window.performance.now();

        // The value of master to approach to
        this.targetMaster = SETTINGS.data.master;
    }

    render() {
        // The progression made last call relative to a stable 60 fps (3 = 3 frames on 60 fps passed since last call)
        let frameModifier = (window.performance.now() - this.lastFrame) / (1000 / 60.0);
        // Update last frame time
        this.lastFrame = window.performance.now();

        // entrance animation
        if (this.entranceAnimation <= this.entranceEnd) {
            // Add the amount of passed frames
            this.entranceAnimation += frameModifier;


            let t = this.entranceAnimation * 1 / 10;

            // A decreasing sinuoidal curve to use for the bouncing animation
            // f(x) = -0.3 * e^(1.8*t) * cos(2*pi*t) + 1
            let amplitudeNow = -0.3 * Math.pow(Math.E, -1.8 * t) * Math.cos(2 * Math.PI * t) + 1;

            // Set radius according to curve
            this.radius = this.targetRadius * amplitudeNow;
            // Set alpha according to entrance animation progress
            this.alpha = Math.min(1.0, Math.pow(this.entranceAnimation / this.entranceEnd, 0.25));
        }

        // Approach the target value
        if (this.targetMaster !== SETTINGS.data.master) {
            SETTINGS.setMaster(SETTINGS.data.master + (Math.pow(Math.abs(this.targetMaster - SETTINGS.data.master), 1.5) * (this.targetMaster > SETTINGS.data.master ? 1 : -1)) * frameModifier);

            if (Math.abs(this.targetMaster - SETTINGS.data.master) < 0.01) {
                SETTINGS.setMaster(this.targetMaster);
            }
        }

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Calculate time since last user input
        let lastChangeDiff = window.performance.now() - this.lastChange;

        // After some time of not changing anything make the control fade out
        if (lastChangeDiff > 1500) {
            this.alpha = Math.max(0.0, this.alpha - 1 / 15 * frameModifier);
            this.radius = Math.max(0.0, this.radius - 2 * frameModifier);

            // Destroy this object when alpha reaches (close to) 0
            if (this.alpha <= 0.00001) {
                GAME_STATE.controls.volumeControl = null;
                return;
            }
        }
        // When sound was changed while fading out fade it in again
        else if (this.entranceAnimation > this.entranceEnd) {
            this.alpha = Math.min(1.0, this.alpha + 1 / 15 * frameModifier);
            this.radius = Math.min(this.targetRadius, this.radius + 2 * frameModifier);
        }

        this.drawBackgroundMaster();

        this.drawVolumeBarMaster();

        this.drawTextMaster();
    }

    animateMaster(value) {
        this.targetMaster += value;

        if (this.targetMaster > 1.0) this.targetMaster = 1.0;
        if (this.targetMaster < 0.0) this.targetMaster = 0.0;

        this.lastChange = window.performance.now();
    };

    drawTextMaster() {
        this.ctx.save();
        this.ctx.globalAlpha = this.alpha;
        this.ctx.font = Math.round((this.radius / 80.0) * 30) + "px Calibri";
        this.ctx.fillStyle = "white";

        let text = Math.round(SETTINGS.data.master * 100) + "%";
        let textSize = this.ctx.measureText(text);

        this.ctx.fillText(text, this.canvas.width - 125 - textSize.width / 2, this.canvas.height - 125 + 8);
        this.ctx.restore();
    };

    drawVolumeBarMaster() {
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.globalAlpha = this.alpha;
        if (SETTINGS.data.master >= 0.9999999) {
            // Render glowing ring at 100%
            this.ctx.arc(this.canvas.width - 125, this.canvas.height - 125, Math.round((this.radius / 80.0) * 61), 0, 2 * Math.PI);
        }
        else if (SETTINGS.data.master <= 0.0000001) {
            // Render full empty circle at 0%
            this.ctx.arc(this.canvas.width - 125, this.canvas.height - 125, Math.round((this.radius / 80.0) * 61), 0, 2 * Math.PI);
        }
        else {
            // Render the unfilled part of the gauge
            this.ctx.arc(this.canvas.width - 125, this.canvas.height - 125, Math.round((this.radius / 80.0) * 61), 2 * Math.PI * SETTINGS.data.master - 0.5 * Math.PI, -0.5 * Math.PI);
        }
        this.ctx.lineWidth = 10;
        this.ctx.strokeStyle = "rgba(60,80,91,0.95)";
        this.ctx.shadowColor = "#0069a0";
        this.ctx.shadowBlur = 20;
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.arc(this.canvas.width - 125, this.canvas.height - 125, Math.round((this.radius / 80.0) * 61), -0.5 * Math.PI, 2 * Math.PI * SETTINGS.data.master - 0.5 * Math.PI);
        this.ctx.lineWidth = 10;
        this.ctx.strokeStyle = "white";
        this.ctx.shadowColor = "#35b5ff";
        this.ctx.shadowBlur = 20;
        this.ctx.stroke();
        this.ctx.restore();
    };

    drawBackgroundMaster() {
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.globalAlpha = this.alpha;
        this.ctx.arc(this.canvas.width - 125, this.canvas.height - 125, this.radius, 0, 2 * Math.PI);
        this.ctx.fill();
        this.ctx.restore();
    };
}