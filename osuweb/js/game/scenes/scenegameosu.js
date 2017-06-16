var ingameContainer = document.getElementById("ingameContainer");
var playareaDiv = document.getElementById("playarea");
var objectContainerDiv = document.getElementById("objectContainer");

function SceneGameOsu() {
    SceneGame.call(this);

    this.playareaDiv = document.getElementById("playarea");
    this.objectContainerDiv = document.getElementById("objectContainer");
    
    this.scoreDisplay = document.getElementById("scoreDisplay");
    this.accuracyDisplay = document.getElementById("accuracyDisplay");
    this.comboDisplay = document.getElementById("comboDisplay");
}