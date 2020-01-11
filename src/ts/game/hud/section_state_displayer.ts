import { gameState } from "../game_state";
import { OsuTexture } from "../skin/texture";
import { OsuSound, OsuSoundType } from "../skin/sound";
import { TAU, MathUtil } from "../../util/math_util";

const SECTION_STATE_DISPLAY_FLICKER_DURATION = 250; // In ms
const SECTION_STATE_DISPLAY_FLICKER_AMOUNT = 2;

// Displays the section pass and section fail thing you see in breaks.
export class SectionStateDisplayer {
	public container: PIXI.Container;
	private sprite: PIXI.Sprite;
	private lastPopUpTime: number = -Infinity;

	constructor() {
		this.container = new PIXI.Container();
		this.sprite = new PIXI.Sprite();
		this.container.addChild(this.sprite);

		this.sprite.anchor.set(0.5, 0.5);
		this.container.position.set(window.innerWidth/2, window.innerHeight/2);
	}

	getLastPopUpTime() {
		return this.lastPopUpTime;
	}

	popUp(pass: boolean, currentTime: number) {
		this.lastPopUpTime = currentTime;

		let { screenPixelRatio } = gameState.currentPlay;
		let osuTexture: OsuTexture, osuSound: OsuSound;

		if (pass) {
			osuTexture = gameState.currentGameplaySkin.textures["sectionPass"];
			osuSound = gameState.currentGameplaySkin.sounds[OsuSoundType.SectionPass];
		} else {
			osuTexture = gameState.currentGameplaySkin.textures["sectionFail"];
			osuSound = gameState.currentGameplaySkin.sounds[OsuSoundType.SectionFail];
		}

		osuTexture.applyToSprite(this.sprite, screenPixelRatio);
		osuSound.play(100);        
	}

	update(currentTime: number) {
		let elapsedTime = currentTime - this.lastPopUpTime;

		if (elapsedTime < SECTION_STATE_DISPLAY_FLICKER_DURATION) {
			let flickerCompletion = elapsedTime / SECTION_STATE_DISPLAY_FLICKER_DURATION;
			let sine = Math.sin((SECTION_STATE_DISPLAY_FLICKER_AMOUNT * flickerCompletion) * TAU);

			this.container.visible = sine >= 0;
			this.container.alpha = 1;
		} else {
			this.container.visible = true;

			let fadeOutCompletion = (elapsedTime - 1200) / 400;
			fadeOutCompletion = MathUtil.clamp(fadeOutCompletion, 0, 1);
			this.container.alpha = 1 - fadeOutCompletion;
		}
	}
}