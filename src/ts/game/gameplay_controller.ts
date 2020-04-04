import { Hud } from "./hud/hud";
import { Beatmap } from "../datamodel/beatmap";
import { ProcessedBeatmap } from "../datamodel/processed/processed_beatmap";
import { IGNORE_BEATMAP_SKIN } from "./skin/skin";
import { Play } from "./play";
import { PauseScreen, PauseScreenMode } from "../menu/gameplay/pause_screen";
import { InteractionGroup, InteractionRegistration } from "../input/interactivity";
import { enableRenderTimeInfoLog } from "../visuals/rendering";
import { globalState } from "../global_state";
import { Interpolator } from "../util/interpolation";
import { EaseType, MathUtil } from "../util/math_util";
import { KeyCode } from "../input/input";
import { Mod } from "../datamodel/mods";
import { ModHelper } from "./mods/mod_helper";
import { assert } from "../util/misc_util";
import { currentWindowDimensions } from "../visuals/ui";
import { GameplayInputController } from "../input/gameplay_input_controller";
import { FlashlightOccluder } from "./mods/flashlight_occluder";

export class GameplayController {
	public container: PIXI.Container;
	public hud: Hud;
	public pauseScreen: PauseScreen;
	public flashlightOccluder: FlashlightOccluder;

	public interactionGroup: InteractionGroup;
	public interactionTarget: PIXI.Container;
	public interactionRegistration: InteractionRegistration;
	public inputController: GameplayInputController;

	public gameplayContainer: PIXI.Container;
	private desaturationFilter: PIXI.filters.ColorMatrixFilter;

    public hitObjectContainer: PIXI.Container;  
    public approachCircleContainer: PIXI.Container;
    public followPointContainer: PIXI.Container;
    public lowerDrawableJudgementContainer: PIXI.Container; // The parts of drawable judgements shown BELOW hit objects
	public upperDrawableJudgementContainer: PIXI.Container; // The parts of drawable judgements shown ABOVE hit objects
	public autoCursor: PIXI.Sprite;
	
	public currentPlay: Play = null;

	private fadeInterpolator: Interpolator;
	private preScoreScreenTimeout: ReturnType<typeof setTimeout> = null;

	private failAnimationCompletion = 0.0;

    constructor() {
		this.container = new PIXI.Container();
		this.interactionGroup = new InteractionGroup();
		this.hud = new Hud(this);
		this.pauseScreen = new PauseScreen(this);
		this.flashlightOccluder = new FlashlightOccluder();

		this.gameplayContainer = new PIXI.Container();
		this.desaturationFilter = new PIXI.filters.ColorMatrixFilter();
		this.gameplayContainer.filters = [this.desaturationFilter];

        this.hitObjectContainer = new PIXI.Container();
        this.hitObjectContainer.sortableChildren = true;
        this.approachCircleContainer = new PIXI.Container();
        this.followPointContainer = new PIXI.Container();
        this.lowerDrawableJudgementContainer = new PIXI.Container();
		this.upperDrawableJudgementContainer = new PIXI.Container();

		this.autoCursor = new PIXI.Sprite(PIXI.Texture.from("./assets/img/cursor.png"));
		this.autoCursor.anchor.set(0.5, 0.5);
		this.autoCursor.scale.set(1.0, 1.0);
		this.autoCursor.visible = false;

        // The order of these is important, 'cause z-index 'n' stuff.
        this.gameplayContainer.addChild(this.lowerDrawableJudgementContainer);
        this.gameplayContainer.addChild(this.followPointContainer);
		this.gameplayContainer.addChild(this.hitObjectContainer);
        this.gameplayContainer.addChild(this.approachCircleContainer);
		this.gameplayContainer.addChild(this.upperDrawableJudgementContainer);

		this.container.addChild(this.gameplayContainer);
		this.container.addChild(this.flashlightOccluder.container);
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
					if (!this.currentPlay) break;

					if (this.currentPlay.completed) {
						if (this.preScoreScreenTimeout !== null) this.showScoreScreen(true);
						break;
					}

					if (this.pauseScreen.shown()) {
						if (this.currentPlay.hasFailed()) this.endPlay();
						else this.unpause();
					} else {
						if (this.currentPlay.hasFailed()) this.pauseScreen.show(PauseScreenMode.Failed);
						else this.pause();
					}
				}; break;
				case KeyCode.Space: {
					if (!this.currentPlay) break;

					this.hud.skipButton.trigger();
				}; break;
			}
		});

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
		this.lowerDrawableJudgementContainer.removeChildren();
		this.upperDrawableJudgementContainer.removeChildren();
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

		this.resize(false);
		this.show();
	}

	private onPlayBegin() {
		globalState.backgroundManager.setGameplayState(true, 1000, EaseType.Linear);
		globalState.backgroundManager.setBlurState(false, 600, EaseType.EaseInQuart);

		this.hud.setFade(true, 0);
		this.hud.interactionGroup.enable();

		this.inputController.reset(); // eh for safety?
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

		this.preScoreScreenTimeout = setTimeout(() => this.showScoreScreen(), 600);
	}

	async showScoreScreen(spedUp = false) {
		clearTimeout(this.preScoreScreenTimeout);
		this.preScoreScreenTimeout = null;

		let beatmap = this.currentPlay.processedBeatmap.beatmap;
		let imageFile = await beatmap.getBackgroundImageFile();

		await globalState.scoreScreen.load(this.currentPlay.scoreProcessor.score, beatmap, imageFile);
		globalState.scoreScreen.show();

		this.hide();
		globalState.backgroundManager.setGameplayState(false, 1500, EaseType.Linear);
		globalState.backgroundManager.setBlurState(true, 1500, EaseType.EaseInOutQuad);

		if (spedUp) globalState.scoreScreen.skipForward();
	}

	render(now: number) {
		let fadeValue = this.fadeInterpolator.getCurrentValue(now);
		this.container.alpha = fadeValue;
		this.container.visible = fadeValue !== 0;
		if (!this.container.visible) return;

		if (this.currentPlay) {
			this.currentPlay.render();
			this.pauseScreen.update(now);
			this.hud.update(now);
		}

		let easedFailAnimationCompletion = MathUtil.ease(EaseType.EaseInOutQuad, this.failAnimationCompletion);

		this.gameplayContainer.scale.set(MathUtil.lerp(1.0, 1.13, easedFailAnimationCompletion));
		this.gameplayContainer.rotation = MathUtil.lerp(0, -0.35, easedFailAnimationCompletion);
		this.gameplayContainer.alpha = 1 - MathUtil.ease(EaseType.EaseInQuad, this.failAnimationCompletion);

		globalState.backgroundManager.setFailAnimationCompletion(this.failAnimationCompletion);

		this.desaturationFilter.enabled = this.failAnimationCompletion > 0;
		this.desaturationFilter.saturate(MathUtil.lerp(0, -0.9, this.failAnimationCompletion), false);
	}

	tick() {
		if (this.currentPlay) this.currentPlay.tick();
	}

	resize(recompose = true) {
		if (!this.currentPlay) return;

		this.gameplayContainer.pivot.x = currentWindowDimensions.width / 2;
		this.gameplayContainer.pivot.y = currentWindowDimensions.height / 2;
		this.gameplayContainer.position.copyFrom(this.gameplayContainer.pivot);

		if (recompose) this.currentPlay.compose(false);
		this.hud.resize();
		this.pauseScreen.resize();
		this.interactionTarget.hitArea = new PIXI.Rectangle(0, 0, currentWindowDimensions.width, currentWindowDimensions.height);
		this.flashlightOccluder.resize();
	}

	pause() {
		if (!this.currentPlay || this.currentPlay.paused) return;

		this.pauseScreen.show(PauseScreenMode.Paused);
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

	setFailAnimationCompletion(completion: number) {
		this.failAnimationCompletion = completion;
	}
 }