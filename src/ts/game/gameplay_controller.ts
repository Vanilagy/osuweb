import { Hud } from "./hud/hud";
import { Beatmap } from "../datamodel/beatmap";
import { ProcessedBeatmap } from "../datamodel/processed/processed_beatmap";
import { IGNORE_BEATMAP_SKIN } from "./skin/skin";
import { Play } from "./play";
import { PauseScreen } from "../menu/gameplay/pause_screen";
import { InteractionGroup, Interactivity } from "../input/interactivity";
import { BackgroundManager } from "../visuals/background";
import { enableRenderTimeInfoLog } from "../visuals/rendering";
import { globalState } from "../global_state";
import { Interpolator } from "../util/interpolation";
import { EaseType } from "../util/math_util";
import { inputEventEmitter, KeyCode } from "../input/input";

export class GameplayController {
	public container: PIXI.Container;
	public interactionGroup: InteractionGroup;
	public hud: Hud;
	public pauseScreen: PauseScreen;

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
		this.interactionGroup = Interactivity.createGroup();
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

		this.interactionGroup.add(this.pauseScreen.interactionGroup);

		this.fadeInterpolator = new Interpolator({
			duration: 300,
			ease: EaseType.EaseOutQuad,
			reverseEase: EaseType.EaseInQuad,
			beginReversed: true,
			defaultToFinished: true
		});

		inputEventEmitter.addListener('keyDown', (e) => {
			switch (e.keyCode) {
				case KeyCode.Escape: {
					if (!this.currentPlay || this.currentPlay.completed) break;

					if (this.currentPlay.paused) this.unpause();
					else this.pause();
				}; break;
			}
		});

		inputEventEmitter.addListener('mouseMove', () => {
			if (!this.currentPlay) return;
			this.currentPlay.handleMouseMove();
		});
		inputEventEmitter.addListener('gameButtonDown', () => {
			if (!this.currentPlay) return;
			this.currentPlay.handleButtonDown();
		});
		
		this.resize();
		this.hide();
	}
	
	async startPlayFromBeatmap(beatmap: Beatmap) {
		this.hitObjectContainer.removeChildren();
		this.approachCircleContainer.removeChildren();
		this.followPointContainer.removeChildren();
		this.lowerScorePopupContainer.removeChildren();
		this.upperScorePopupContainer.removeChildren();
		this.autoCursor.visible = false;
		this.pauseScreen.reset();

		let processedBeatmap = new ProcessedBeatmap(beatmap, !IGNORE_BEATMAP_SKIN);
	
		let newPlay = new Play(this, processedBeatmap);
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
	}

	pause() {
		if (!this.currentPlay || this.currentPlay.paused) return;

		this.pauseScreen.show();
		this.currentPlay.pause();
	}

	unpause() {
		if (!this.currentPlay || !this.currentPlay.paused) return;

		this.pauseScreen.hide();
		this.currentPlay.unpause();
	}

	restart() {
		if (!this.currentPlay) return;
		
		this.pauseScreen.hide();
		this.currentPlay.restart();
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