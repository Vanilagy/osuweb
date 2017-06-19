function SceneGame() {
    SceneBase.call(this);

    this.elements["backgroundDimDiv"] = document.getElementById("background-dim");
}

SceneGame.prototype = Object.create(SceneBase.prototype);
SceneGame.prototype.constructor = SceneGame;