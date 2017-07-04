"use strict";

import {SceneLoading} from "./sceneloading";

export class SceneManager {
    constructor(initialScene) {
        this._currentScene = initialScene || new SceneLoading();
        this._currentCanvas = document.getElementById("osuweb");
    }

    switchScene(newScene, callback) {
        this._currentScene.transition(newScene, (result) => {
            if (!result) {
                let oldScene = this._currentScene;

                oldScene.preClose((result) => {});

                newScene.preOpen((result) => {});

                this._currentScene = newScene;

                oldScene.postClose((result) => {});

                newScene.postOpen((result) => {});
            }

            callback();
        });
    }

    /**
     * Only to be called from Scene classes. Use switchScene instead to transition between
     * scenes.
     * @param newScene
     */
    setScene(newScene) {
        this._currentScene = newScene;
    }

    getScene() {
        return this._currentScene;
    }

    getCanvas() {
        return this._currentCanvas;
    }
}