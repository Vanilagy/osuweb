"use strict";

import {SceneBase} from "./scenebase";

export class SceneLoading extends SceneBase {
    constructor() {
        super();

        this.elements["loadingDiv"] = document.getElementById("loading");
    }
}