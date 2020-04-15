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
import { FlashlightOccluder } from "./mods/flashlight_occluder";
import { GameplayInputState } from "../input/gameplay_input_state";
import { GameplayInputListener } from "../input/gameplay_input_listener";
import { Replay } from "./replay";
import { StoryboardPlayer } from "./storyboard/storyboard_player";
import { StoryboardParser } from "./storyboard/storyboard_parser";
import { ENABLE_STORYBOARD } from "./storyboard/storyboard";
import { SmokeCanvas } from "./hud/smoke_canvas";

export class GameplayController {
	public container: PIXI.Container;
	public hud: Hud;
	public pauseScreen: PauseScreen;
	public flashlightOccluder: FlashlightOccluder;
	public backgroundDimmer: PIXI.Sprite;
	public smokeCanvas: SmokeCanvas;

	public interactionGroup: InteractionGroup;
	public interactionTarget: PIXI.Container;
	public interactionRegistration: InteractionRegistration;
	public inputState: GameplayInputState;
	public userInputListener: GameplayInputListener;

	public storyboardContainer: PIXI.Container;
	public gameplayContainer: PIXI.Container;
	private desaturationFilter: PIXI.filters.ColorMatrixFilter;

    public hitObjectContainer: PIXI.Container;  
    public approachCircleContainer: PIXI.Container;
    public followPointContainer: PIXI.Container;
    public lowerDrawableJudgementContainer: PIXI.Container; // The parts of drawable judgements shown BELOW hit objects
	public upperDrawableJudgementContainer: PIXI.Container; // The parts of drawable judgements shown ABOVE hit objects
	public autoCursor: PIXI.Sprite;
	
	public currentPlay: Play = null;
	public currentStoryboard: StoryboardPlayer = null;
	public playbackReplay: Replay = null;
	public playbackReplayIsAutopilot = false;
	public recordingReplay: Replay = null;

	private fadeInterpolator: Interpolator;
	private preScoreScreenTimeout: ReturnType<typeof setTimeout> = null;

	private failAnimationCompletion = 0.0;

    constructor() {
		this.container = new PIXI.Container();
		this.interactionGroup = new InteractionGroup();
		this.hud = new Hud(this);
		this.pauseScreen = new PauseScreen(this);
		this.flashlightOccluder = new FlashlightOccluder();
		this.smokeCanvas = new SmokeCanvas(this);

		this.backgroundDimmer = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.backgroundDimmer.tint = 0x000000;
		this.backgroundDimmer.alpha = 0;

		this.storyboardContainer = new PIXI.Container();
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
		
		this.container.addChild(this.storyboardContainer);
		this.container.addChild(this.backgroundDimmer);
		this.container.addChild(this.smokeCanvas.container);
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

					this.pauseScreen.trigger();
				}; break;
				case KeyCode.Space: {
					if (!this.currentPlay) break;

					this.hud.skipButton.trigger();
				}; break;
			}
		});

		this.inputState = new GameplayInputState(this);
		this.userInputListener = new GameplayInputListener(this, this.interactionRegistration);
		
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
		this.storyboardContainer.removeChildren();
		this.autoCursor.visible = false;
		this.pauseScreen.reset();

		let processedBeatmap = new ProcessedBeatmap(beatmap, !IGNORE_BEATMAP_SKIN);
	
		let newPlay = new Play(this, processedBeatmap, mods);
		this.currentPlay = newPlay;
	
		await newPlay.init();
		this.hud.init();
		this.onPlayBegin();
		enableRenderTimeInfoLog();

		if (mods.has(Mod.Auto) || mods.has(Mod.Cinema) || mods.has(Mod.Autopilot)) {
			let autoReplay = ModHelper.createAutoReplay(newPlay, mods.has(Mod.Autopilot));
			this.setReplay(autoReplay, mods.has(Mod.Autopilot));
		} else {
			this.setReplay(null);
		}

		await newPlay.start();

		this.resize(false);
		this.show();
	}

	async initStoryboard() {
		let beatmap = this.currentPlay.processedBeatmap.beatmap;
		let text = beatmap.eventsString;

		let osbFile = beatmap.beatmapSet.getStoryboardFile();
		if (osbFile) {
			console.time("Storyboard file read");
			let osbText = await osbFile.readAsText();
			console.timeEnd("Storyboard file read");

			console.time("Storyboard text preprocessing");
			let preprocessedText = StoryboardParser.preprocessText(osbText);
			console.timeEnd("Storyboard text preprocessing");

			// Append the .osb file contents to the [Events] section of the beatmap file
			text += '\n' + preprocessedText;
		}

		console.time("Storyboard parsing");
		let storyboard = StoryboardParser.parse(text, ENABLE_STORYBOARD); // If storyboards are disabled, their audio component (sample playback) stays active nonetheless.
		console.timeEnd("Storyboard parsing");

		// Create an array of directories the storyboard player will have access to. The directories will be used for file loopup in array order.
		let directories = [beatmap.beatmapSet.directory];
		if (beatmap.useSkinSprites) {
			directories.unshift(...this.currentPlay.skin.parentDirectories.slice().reverse(), this.currentPlay.skin.directory);
		}

		console.time("Storyboard init");
		this.currentStoryboard = new StoryboardPlayer(storyboard, directories, this.storyboardContainer);
		await this.currentStoryboard.init();
		console.timeEnd("Storyboard init");
	}

	setReplay(replay: Replay, isAutopilotReplay = false) {
		this.playbackReplayIsAutopilot = false;

		if (replay === null) {
			if (this.playbackReplay) this.playbackReplay.unhook();
			this.playbackReplay = null;
			this.userInputListener.hookMouse(this.inputState);
			this.userInputListener.hookButtons(this.inputState);
			
			this.autoCursor.visible = false;
		} else {
			this.playbackReplay = replay;
			this.playbackReplay.hook(this.inputState);
			this.userInputListener.unhook();

			if (isAutopilotReplay) {
				// Make the player "take over" button input
				this.playbackReplay.unhookButtons();
				this.userInputListener.hookButtons(this.inputState);

				this.playbackReplayIsAutopilot = true;
			}
			
			this.autoCursor.visible = !this.currentPlay.activeMods.has(Mod.Cinema);
		}

		if (!replay || isAutopilotReplay) {
			this.recordingReplay = new Replay();
			this.inputState.bindReplayRecording(this.recordingReplay);
		} else {
			this.recordingReplay = null;
			this.inputState.unbindReplayRecording();
		}
	}

	private onPlayBegin() {
		globalState.backgroundManager.setGameplayState(true, 1000, EaseType.Linear);
		globalState.backgroundManager.setBlurState(false, 600, EaseType.EaseInQuart);

		this.hud.setFade(true, 0);
		this.hud.interactionGroup.enable();

		this.inputState.reset();
		this.smokeCanvas.reset();
	}

	endPlay() {
		if (!this.currentPlay) return;

		this.currentPlay.stop();
		this.currentPlay = null;
		this.hide();

		globalState.songSelect.show();
		globalState.backgroundManager.setGameplayState(false, 500, EaseType.EaseInQuad);
		globalState.backgroundManager.setBlurState(true, 400, EaseType.EaseOutQuart);

		this.pauseScreen.turnOffSound();

		this.recordingReplay = null;
		this.inputState.unbindReplayRecording();

		this.currentStoryboard?.pause();
		this.currentStoryboard?.dispose();
		this.currentStoryboard = null;
	}

	async completePlay() {
		if (!this.currentPlay || this.currentPlay.completed) return;

		this.currentPlay.complete();
		this.hud.setFade(false, 300);

		this.preScoreScreenTimeout = setTimeout(() => this.showScoreScreen(), 1000);

		this.inputState.unbindReplayRecording();
		if (this.recordingReplay) this.recordingReplay.finalize();
	}

	async showScoreScreen(spedUp = false) {
		if (this.currentPlay.activeMods.has(Mod.Cinema)) {
			// Don't show a score screen with cinema
			this.endPlay();
			return;
		}

		let scr = globalState.scoreScreen;

		clearTimeout(this.preScoreScreenTimeout);
		this.preScoreScreenTimeout = null;

		let beatmap = this.currentPlay.processedBeatmap.beatmap;
		let imageFile = await beatmap.getBackgroundImageFile();
		let replay = (this.playbackReplay && !this.playbackReplayIsAutopilot)? this.playbackReplay : this.recordingReplay;

		await scr.load(this.currentPlay.scoreProcessor.score, beatmap, imageFile, replay);
		scr.show();
		
		let activeButtons = (replay === this.playbackReplay)? [scr.closeButton, scr.watchReplayButton] : [scr.closeButton, scr.retryButton, scr.watchReplayButton];
		scr.setActiveButtons(activeButtons);

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
		if (!this.currentPlay) return;

		this.currentPlay.render();
		this.pauseScreen.update(now);
		this.hud.update(now);

		let easedFailAnimationCompletion = MathUtil.ease(EaseType.EaseInOutQuad, this.failAnimationCompletion);
		let defaultGameplayContainerAlpha = this.currentPlay.activeMods.has(Mod.Cinema)? 0.01 : 1.0; // Gameplay elements are BARELY visible with Cinema

		this.gameplayContainer.scale.set(MathUtil.lerp(1.0, 1.13, easedFailAnimationCompletion));
		this.gameplayContainer.rotation = MathUtil.lerp(0, -0.35, easedFailAnimationCompletion);
		this.gameplayContainer.alpha = MathUtil.lerp(defaultGameplayContainerAlpha, 0, MathUtil.ease(EaseType.EaseInQuad, this.failAnimationCompletion));

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
		this.smokeCanvas.resize();

		this.backgroundDimmer.width = currentWindowDimensions.width;
		this.backgroundDimmer.height = currentWindowDimensions.height;
	}

	pause() {
		if (!this.currentPlay || this.currentPlay.paused) return;

		this.pauseScreen.show((this.playbackReplay && !this.playbackReplayIsAutopilot)? PauseScreenMode.PausedReplay : PauseScreenMode.Paused);
		this.currentPlay.pause();
		this.hud.interactionGroup.disable();
		this.currentStoryboard?.pause();
	}

	unpause() {
		if (!this.currentPlay || !this.currentPlay.paused) return;

		this.pauseScreen.hide();
		this.currentPlay.unpause();
		this.hud.interactionGroup.enable();
		this.currentStoryboard?.unpause();
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

	setDim(dim: number) {
		this.backgroundDimmer.alpha = dim;
	}
 }