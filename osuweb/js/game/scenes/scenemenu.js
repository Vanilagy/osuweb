function SceneMenu() {
    SceneBase.call(this);

    this.elements["osuInput"] = document.getElementById("osu");
}

SceneMenu.prototype = Object.create(SceneBase.prototype);
SceneMenu.prototype.constructor = SceneMenu;