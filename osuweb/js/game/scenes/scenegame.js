"use strict";

import {SceneBase} from "./scenebase";

export class SceneGame extends SceneBase {
    constructor() {
        super();

        this.elements["backgroundDimDiv"] = document.getElementById("background-dim");
    }
}