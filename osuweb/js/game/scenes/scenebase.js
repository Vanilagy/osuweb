"use strict";

export class SceneBase {
    constructor() {
        this.elements = {};

        this.elements["backgroundDiv"] = document.getElementById("background");
        this.elements["foregroundDiv"] = document.getElementById("foreground");
        this.elements["osuwebCanvas"] = document.getElementById("osuweb");

        return this;
    }

    setElementVisibility = function (value, fade, transition) {
        this.visible = !this.visible;

        for (let elem in this.elements) {
            let object = this.elements[elem];

            if (fade) {
                object.style.transition = transition !== undefined ? "opacity 1s linear" : transition;

                object.style.opacity = value ? "1" : "0";

                setTimeout((function () {
                    object.style.display = value ? "block" : "none";
                }).bind(this), 1000)
            }
            else {
                object.style.display = value ? "block" : "none";
            }
        }
    }
}