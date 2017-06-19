function SceneLoading() {
    SceneBase.call(this);

    this.elements["loadingDiv"] = document.getElementById("loading");
}

SceneLoading.prototype = Object.create(SceneBase.prototype);
SceneLoading.prototype.constructor = SceneLoading;