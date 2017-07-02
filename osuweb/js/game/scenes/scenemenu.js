"use strict";

import {SceneBase} from "./scenebase";

export class SceneMenu extends SceneBase {
    constructor() {
        super();

        this.elements["osuInput"] = document.getElementById("osu");
    }
}