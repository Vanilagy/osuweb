import { gameState } from "../game_state";
import { TAU } from "../../util/math_util";
import { colorToHexNumber, Colors } from "../../util/graphics_util";

const GAMEPLAY_WARNING_ARROWS_FLICKER_FREQUENCY = 5; // In Hertz

// The arrows that appear at the end of breaks
export class GameplayWarningArrows {
	public container: PIXI.Container;
	private sprites: PIXI.Sprite[]; // Do we really need this array?

	constructor() {
		let { screenPixelRatio } = gameState.currentPlay;

		this.container = new PIXI.Container();
		this.container.position.set(window.innerWidth/2, window.innerHeight/2);
		this.container.visible = false;
		
		let arrowTexture = gameState.currentGameplaySkin.textures["arrowWarning"];
		let doTint = false;

		if (arrowTexture.isEmpty()) {
			arrowTexture = gameState.currentGameplaySkin.textures["playWarningArrow"];
			if (gameState.currentGameplaySkin.getVersionNumber() >= 2.0) doTint = true;
		}

		this.sprites = [];
		// Create a sprite for each corner
		for (let i = 0; i < 4; i++) {
			let sprite = new PIXI.Sprite();
			sprite.anchor.set(0.5, 0.5);
			sprite.x = 556 * screenPixelRatio;
			sprite.y = 224 * screenPixelRatio;
			
			arrowTexture.applyToSprite(sprite, screenPixelRatio);

			if (i >= 2) sprite.x *= -1;
			else sprite.rotation = Math.PI;
			if (i % 2 === 0) sprite.y *= -1;

			if (doTint) sprite.tint = colorToHexNumber(Colors.Red);

			this.container.addChild(sprite);
			this.sprites.push(sprite);
		}
	}

	update(currentTime: number, flickerStartTime: number) {
		if (flickerStartTime === null) {
			this.container.visible = false;
			return;
		}

		let elapsedTime = Math.max(0, currentTime - flickerStartTime);
		let sine = Math.sin((GAMEPLAY_WARNING_ARROWS_FLICKER_FREQUENCY * (elapsedTime / 1000)) * TAU);
		this.container.visible = sine > 0;
	}
}