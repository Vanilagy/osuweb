"use strict";

import {SceneBase} from "./scenebase";

export class SceneSongSelect extends SceneBase {
    constructor() {
        super();

        this.elements["songpanelsDiv"] = document.getElementById("songpanels");
    }
}