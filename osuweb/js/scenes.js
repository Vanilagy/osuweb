/**
 * Created by Sebastian on 07.06.2017.
 */

function SceneBase() {
    this.backgroundDiv = document.getElementById("background");
    this.foregroundDiv = document.getElementById("foreground");
    this.osuwebCanvas = document.getElementById("osuweb");

    this.visible = true;

    this.toggle = function(object, fade, transition) {
        this.visible = !this.visible;

        if(fade) {
            object.style.transition = transition != undefined ? "opacity 1s linear" : transition;

            object.style.opacity = this.visible ? "1" : "0";

            setTimeout((function() {
                object.style.display = this.visible ? "inline" : "none";
            }).bind(this), 1000)
        }
        else {
            object.style.display = this.visible ? "inline" : "none";
        }
    }

    return this;
}

function SceneLoading() {
    SceneBase.call(this);

    this.loadingDiv = document.getElementById("loading");
}

///// MENU SCENES /////

function SceneMenu() {
    SceneBase.call(this);
}

///// GAME SCENES /////

function SceneGame() {
    SceneBase.call(this);

    this.backgroundDimDiv = document.getElementById("background-dim");
}

function SceneGameOsu() {
    SceneGame.call(this);

    this.playfieldCanvas = document.getElementById("playfield");
    this.objectContainerDiv = document.getElementById("objectContainer");
}
