function SceneGameOsu() {
    SceneGame.call(this);

    this.elements["playareaDiv"] =  document.getElementById("playarea");
    this.elements["objectContainerDiv"] =  document.getElementById("objectContainer");
    this.elements["progressCanvas"] = document.getElementById("progress");
    this.elements["spinnerContainerContainer"] = document.getElementById("spinnerContainerContainer");
    this.elements["ingameContainerSection"] = document.getElementById("ingameContainer");

    // Accmeter (bottom-middle)
    this.elements["accarrowImg"] = document.getElementById("accarrow");
    this.elements["accmeterDiv"] = document.getElementById("accmeter");
    this.elements["accstrip50Div"] = document.getElementById("accstrip-50");
    this.elements["accstrip100Div"] = document.getElementById("accstrip-100");
    this.elements["accstrip300Div"] = document.getElementById("accstrip-300");
    this.elements["acctickXDiv"] = document.getElementById("acctick-X");

    // Score display (top-right)
    this.elements["scoreDisplayP"] = document.getElementById("scoreDisplay");
    this.elements["accuracyDisplayP"] = document.getElementById("accuracyDisplay");
    this.elements["comboDisplayP"] = document.getElementById("comboDisplay");
    this.elements["accContainerDiv"] = document.getElementById("accContainer");
    this.elements["accWrapperDiv"] = document.getElementById("accWrapper");
}

SceneGameOsu.prototype = Object.create(SceneGame.prototype);
SceneGameOsu.prototype.constructor = SceneGameOsu;