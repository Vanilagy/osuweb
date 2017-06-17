function SceneGameOsu() {
    SceneGame.call(this);

    this.elements["playareaDiv"] =  document.getElementById("playarea");
    this.elements["objectContainerDiv"] =  document.getElementById("objectContainer");
    this.elements["ingameContainerSection"] = document.getElementById("ingameContainer");
    this.elements["scoreDisplayP"] = document.getElementById("scoreDisplay");
    this.elements["accuracyDisplayP"] = document.getElementById("accuracyDisplay");
    this.elements["comboDisplayP"] = document.getElementById("comboDisplay");
}

SceneGameOsu.prototype = Object.create(SceneGame.prototype);
SceneGameOsu.prototype.constructor = SceneGameOsu;