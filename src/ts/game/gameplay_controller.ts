import { Hud } from "./hud/hud";
import { Beatmap } from "../datamodel/beatmap";
import { ProcessedBeatmap } from "../datamodel/processed/processed_beatmap";
import { IGNORE_BEATMAP_SKIN } from "./skin/skin";
import { Play } from "./play";
import { PauseScreen } from "../menu/gameplay/pause_screen";
import { InteractionGroup, InteractionRegistration } from "../input/interactivity";
import { enableRenderTimeInfoLog } from "../visuals/rendering";
import { globalState } from "../global_state";
import { Interpolator } from "../util/interpolation";
import { EaseType } from "../util/math_util";
import { KeyCode } from "../input/input";
import { Mod } from "../datamodel/mods";
import { ModHelper } from "./mods/mod_helper";
import { assert } from "../util/misc_util";
import { currentWindowDimensions } from "../visuals/ui";
import { GameplayInputController } from "../input/gameplay_input_controller";

export class GameplayController {
	public container: PIXI.Container;
	public hud: Hud;
	public pauseScreen: PauseScreen;

	public interactionGroup: InteractionGroup;
	public interactionTarget: PIXI.Container;
	public interactionRegistration: InteractionRegistration;
	public inputController: GameplayInputController;

    public hitObjectContainer: PIXI.Container;  
    public approachCircleContainer: PIXI.Container;
    public followPointContainer: PIXI.Container;
    public lowerScorePopupContainer: PIXI.Container; // The parts of score popups shown BELOW hit objects
	public upperScorePopupContainer: PIXI.Container; // The parts of score popups shown ABOVE hit objects
	public autoCursor: PIXI.Sprite;
	
	public currentPlay: Play = null;

	private fadeInterpolator: Interpolator;

    constructor() {
		this.container = new PIXI.Container();
		this.interactionGroup = new InteractionGroup();
		this.hud = new Hud(this);
		this.pauseScreen = new PauseScreen(this);

        this.hitObjectContainer = new PIXI.Container();
        this.hitObjectContainer.sortableChildren = true;
        this.approachCircleContainer = new PIXI.Container();
        this.followPointContainer = new PIXI.Container();
        this.lowerScorePopupContainer = new PIXI.Container();
		this.upperScorePopupContainer = new PIXI.Container();

		this.autoCursor = new PIXI.Sprite(PIXI.Texture.from("./assets/img/cursor.png"));
		this.autoCursor.anchor.set(0.5, 0.5);
		this.autoCursor.scale.set(1.0, 1.0);
		this.autoCursor.visible = false;

        // The order of these is important, 'cause z-index 'n' stuff.
        this.container.addChild(this.lowerScorePopupContainer);
        this.container.addChild(this.followPointContainer);
        this.container.addChild(this.hitObjectContainer);
        this.container.addChild(this.approachCircleContainer);
		this.container.addChild(this.upperScorePopupContainer);
		this.container.addChild(this.autoCursor);
		this.container.addChild(this.hud.container);
		this.container.addChild(this.pauseScreen.container);

		this.interactionGroup.add(this.hud.interactionGroup);
		this.interactionGroup.add(this.pauseScreen.interactionGroup);

		this.fadeInterpolator = new Interpolator({
			duration: 300,
			ease: EaseType.EaseOutQuad,
			reverseEase: EaseType.EaseInQuad,
			beginReversed: true,
			defaultToFinished: true
		});

		this.interactionTarget = new PIXI.Container();

		this.interactionRegistration = new InteractionRegistration(this.interactionTarget);
		this.interactionRegistration.passThrough = true;
		this.interactionGroup.add(this.interactionRegistration);
		this.interactionRegistration.addListener('keyDown', (e) => {
			switch (e.keyCode) {
				case KeyCode.Escape: {
					if (!this.currentPlay || this.currentPlay.completed) break;

					if (this.currentPlay.paused) this.unpause();
					else this.pause();
				}; break;
				case KeyCode.Space: {
					if (!this.currentPlay) break;

					this.hud.skipButton.trigger();
				}; break;
			}
		});

		// TODO get rid of these:
		this.interactionRegistration.addListener('mouseMove', () => {
			if (!this.currentPlay) return;
			this.currentPlay.handleMouseMove();
		});

		this.inputController = new GameplayInputController(this.interactionRegistration);
		this.inputController.addListener('gameButtonDown', () => this.currentPlay && this.currentPlay.handleButtonDown());
		
		this.resize();
		this.hide();
	}
	
	async startPlayFromBeatmap(beatmap: Beatmap, mods: Set<Mod>) {
		assert(ModHelper.validateModSelection(mods));

		this.hitObjectContainer.removeChildren();
		this.approachCircleContainer.removeChildren();
		this.followPointContainer.removeChildren();
		this.lowerScorePopupContainer.removeChildren();
		this.upperScorePopupContainer.removeChildren();
		this.autoCursor.visible = false;
		this.pauseScreen.reset();

		let processedBeatmap = new ProcessedBeatmap(beatmap, !IGNORE_BEATMAP_SKIN);
	
		let newPlay = new Play(this, processedBeatmap, mods);
		this.currentPlay = newPlay;
	
		await newPlay.init();
		this.hud.init();
		this.onPlayBegin();
		enableRenderTimeInfoLog();
		
		await newPlay.start();

		this.resize();
		this.show();
	}

	private onPlayBegin() {
		globalState.backgroundManager.setGameplayState(true, 1000, EaseType.Linear);
		globalState.backgroundManager.setBlurState(false, 600, EaseType.EaseInQuart);

		this.hud.setFade(true, 0);
		this.hud.interactionGroup.enable();
	}

	endPlay() {
		if (!this.currentPlay) return;

		this.currentPlay.stop();
		this.currentPlay = null;
		this.hide();

		globalState.songSelect.show();
		globalState.backgroundManager.setGameplayState(false, 500, EaseType.EaseInQuad);
		globalState.backgroundManager.setBlurState(true, 400, EaseType.EaseOutQuart);
	}

	async completePlay() {
		if (!this.currentPlay) return;

		this.currentPlay.complete();
		this.hud.setFade(false, 300);

		await new Promise((resolve) => setTimeout(resolve, 600));

		this.hide();
		globalState.backgroundManager.setGameplayState(false, 1500, EaseType.Linear);
		globalState.backgroundManager.setBlurState(true, 1500, EaseType.EaseInOutQuad);

		let beatmap = this.currentPlay.processedBeatmap.beatmap;
		let imageFile = await beatmap.getBackgroundImageFile();

		await globalState.scoreScreen.load(this.currentPlay.scoreCounter.score, beatmap, imageFile);
		globalState.scoreScreen.show();
	}

	render(now: number) {
		let fadeValue = this.fadeInterpolator.getCurrentValue(now);
		this.container.alpha = fadeValue;
		this.container.visible = fadeValue !== 0;

		if (this.currentPlay) {
			this.currentPlay.render();
			this.pauseScreen.update(now);
		}

		this.hud.update(now);
	}

	tick() {
		if (this.currentPlay) this.currentPlay.tick();
	}

	resize() {
		if (!this.currentPlay) return;

		this.hud.resize();
		this.pauseScreen.resize();
		this.interactionTarget.hitArea = new PIXI.Rectangle(0, 0, currentWindowDimensions.width, currentWindowDimensions.height);
	}

	pause() {
		if (!this.currentPlay || this.currentPlay.paused) return;

		this.pauseScreen.show();
		this.currentPlay.pause();
		this.hud.interactionGroup.disable();
	}

	unpause() {
		if (!this.currentPlay || !this.currentPlay.paused) return;

		this.pauseScreen.hide();
		this.currentPlay.unpause();
		this.hud.interactionGroup.enable();
	}

	restart() {
		if (!this.currentPlay) return;
		
		this.pauseScreen.hide();
		this.currentPlay.restart();
		this.hud.reset();
		this.onPlayBegin();

		this.show();
	}
	
	show() {
		this.fadeInterpolator.setReversedState(false, performance.now());
		this.interactionGroup.enable();
	}

	hide() {
		this.fadeInterpolator.setReversedState(true, performance.now());
		this.interactionGroup.disable();
	}
}