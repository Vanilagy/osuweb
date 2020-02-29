import { currentWindowDimensions } from "../../visuals/ui";
import { Interactivity } from "../../input/interactivity";
import { gameState } from "../game_state";

export class PauseScreen {
    public container: PIXI.Container;

    constructor() {
        this.container = new PIXI.Container();
        this.container.visible = false;

        let bg = new PIXI.Sprite(PIXI.Texture.WHITE);
        bg.tint = 0x000000;
        bg.alpha = 0.666;
        bg.width = currentWindowDimensions.width;
        bg.height = currentWindowDimensions.height;
        this.container.addChild(bg);

        let shit = new PIXI.Container();
        this.container.addChild(shit);

        let resumeContainer = new PIXI.Container();
        let resumeBg = new PIXI.Sprite(PIXI.Texture.WHITE);
        resumeBg.tint = 0xff0000;
        resumeBg.width = 300;
        resumeBg.height = 50;
        let resumeText = new PIXI.Text("resume");
        resumeContainer.addChild(resumeBg);
        resumeContainer.addChild(resumeText);

        let restartContainer = new PIXI.Container();
        let restartBg = new PIXI.Sprite(PIXI.Texture.WHITE);
        restartBg.tint = 0x00ff00;
        restartBg.width = 300;
        restartBg.height = 50;
        let restartText = new PIXI.Text("restart");
        restartContainer.addChild(restartBg);
        restartContainer.addChild(restartText);
        restartContainer.y = 50;

        let quitContainer = new PIXI.Container();
        let quitBg = new PIXI.Sprite(PIXI.Texture.WHITE);
        quitBg.tint = 0x0000ff;
        quitBg.width = 300;
        quitBg.height = 50;
        let quitText = new PIXI.Text("quit");
        quitContainer.addChild(quitBg);
        quitContainer.addChild(quitText);
        quitContainer.y = 100;

        shit.addChild(resumeContainer);
        shit.addChild(restartContainer);
        shit.addChild(quitContainer);

        shit.pivot.x = Math.floor(shit.width/2);
        shit.pivot.y = Math.floor(shit.height/2);
        shit.position.set(currentWindowDimensions.width/2, currentWindowDimensions.height/2);

        Interactivity.registerDisplayObject(resumeContainer).addListener('mouseClick', () => {
            gameState.currentPlay.unpause();
		});
		
		Interactivity.registerDisplayObject(restartContainer).addListener('mouseClick', () => {
			gameState.currentPlay.reset();
			gameState.currentPlay.start();

			this.hide();
		});
    }

    show() {
        this.container.visible = true;
    }

    hide() {
        this.container.visible = false;
    }
}