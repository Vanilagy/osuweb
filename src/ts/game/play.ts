import { PLAYFIELD_DIMENSIONS, STANDARD_SCREEN_DIMENSIONS, SCREEN_COORDINATES_X_FACTOR, SCREEN_COORDINATES_Y_FACTOR, FOLLOW_CIRCLE_THICKNESS_FACTOR } from "../util/constants";
import { Point, lerpPoints } from "../util/point";
import { MathUtil, EaseType } from "../util/math_util";
import { last, assert } from "../util/misc_util";
import { DrawableHeadedHitObject } from "./drawables/drawable_headed_hit_object";
import { joinSkins, IGNORE_BEATMAP_SKIN, IGNORE_BEATMAP_HIT_SOUNDS, DEFAULT_COLORS, Skin } from "./skin/skin";
import { AutoInstruction, ModHelper, HALF_TIME_PLAYBACK_RATE, DOUBLE_TIME_PLAYBACK_RATE, AutoInstructionType } from "./mods/mod_helper";
import { DrawableBeatmap } from "./drawable_beatmap";
import { ProcessedBeatmap, getBreakMidpoint, getBreakLength } from "../datamodel/processed/processed_beatmap";
import { ProcessedSlider } from "../datamodel/processed/processed_slider";
import { Color } from "../util/graphics_util";
import { REFERENCE_SCREEN_HEIGHT, currentWindowDimensions } from "../visuals/ui";
import { GameplayController } from "./gameplay_controller";
import { globalState } from "../global_state";
import { ScoringValue } from "../datamodel/scoring/score";
import { Mod } from "../datamodel/mods";
import { SKIP_BUTTON_MIN_BREAK_LENGTH, SKIP_BUTTON_FADE_TIME, SKIP_BUTTON_END_TIME } from "./hud/skip_button";
import { audioContext } from "../audio/audio";
import { HudMode } from "./hud/hud";
import { PauseScreenMode } from "../menu/gameplay/pause_screen";
import { HealthProcessor } from "../datamodel/scoring/health_processor";
import { DrawableScoreProcessor } from "./scoring/drawable_score_processor";
import { Judgement } from "../datamodel/scoring/judgement";
import { HitSoundInfo, calculatePanFromOsuCoordinates } from "./skin/hit_sound";
import { Replay } from "./replay";

const BREAK_FADE_TIME = 1000; // In ms
const BACKGROUND_DIM = 0.85; // To figure out dimmed backgorund image opacity, that's equal to: (1 - BACKGROUND_DIM) * DEFAULT_BACKGROUND_OPACITY
const DISABLE_VIDEO = false;
const VIDEO_FADE_IN_DURATION = 1000; // In ms
const GAMEPLAY_WARNING_ARROWS_FLICKER_START = -1000; // Both of these are relative to the end of the break
const GAMEPLAY_WARNING_ARROWS_FLICKER_END = 400;
const FAIL_ANIMATION_DURATION = 2000;

export class Play {
	public controller: GameplayController;
	public processedBeatmap: ProcessedBeatmap;
	public drawableBeatmap: DrawableBeatmap;
	public preludeTime: number;
	public playbackRate: number = 1.0;
	public effectiveBackgroundDim: number;
	private hasVideo: boolean = false;
	public paused: boolean = false;
	private playing: boolean = false;
	private initted: boolean = false;
	public completed: boolean = false;

	public scoreProcessor: DrawableScoreProcessor;
	public healthProcessor: HealthProcessor;
	public activeMods: Set<Mod>;
	public colorArray: Color[];
	public remainingLives: number;

	private lastTickTime: number = null;
	private currentBreakIndex = 0;
	private breakEndWarningTimes: number[] = [];
	
	// Draw stuffz:
	public skin: Skin;
	public hitObjectPixelRatio: number;
	public screenPixelRatio: number;
	public circleDiameterOsuPx: number;
	public circleDiameter: number;
	public circleRadiusOsuPx: number;
	public circleRadius: number;
	public headedHitObjectTextureFactor: number;
	public approachTime: number;

	// Fail stuffz:
	public failTime: number = null;
	private currentTimeAtFail: number = null;
	private failAnimationEndTriggered = false;

	constructor(controller: GameplayController, processedBeatmap: ProcessedBeatmap, mods: Set<Mod>) {
		this.controller = controller;
		this.processedBeatmap = processedBeatmap;
		this.drawableBeatmap = new DrawableBeatmap(this, this.processedBeatmap);
		this.scoreProcessor = new DrawableScoreProcessor(this);
		this.activeMods = mods;
	}
	
	async init() {
		if (this.initted) return;

		console.time("Beatmap process");
		this.processedBeatmap.init();
		console.timeEnd("Beatmap process");

		if (this.activeMods.has(Mod.Easy)) ModHelper.applyEz(this.processedBeatmap);
		if (this.activeMods.has(Mod.HardRock)) ModHelper.applyHr(this.processedBeatmap);

		this.approachTime = this.processedBeatmap.difficulty.getApproachTime();
		this.circleDiameterOsuPx = this.processedBeatmap.difficulty.getCirclePixelSize();
		this.circleRadiusOsuPx = this.circleDiameterOsuPx / 2;

		console.time('Stack shift');
		this.processedBeatmap.applyStackShift();
		console.timeEnd('Stack shift');

		console.time("Beatmap draw");
		this.drawableBeatmap.init();
		this.drawableBeatmap.draw();
		console.timeEnd("Beatmap draw");

		this.scoreProcessor.hookBeatmap(this.processedBeatmap, this.activeMods);

		this.healthProcessor = new HealthProcessor();
		this.healthProcessor.simulateAutoplay(this.drawableBeatmap.playEvents);
		this.healthProcessor.hookBeatmap(this.processedBeatmap);
		this.healthProcessor.calculateDrainRate();

		// Compute break end warning times
		for (let i = 0; i < this.processedBeatmap.breaks.length; i++) {
			let osuBreak = this.processedBeatmap.breaks[i];
			if (!isFinite(getBreakMidpoint(osuBreak))) continue; // It has to be a bounded break

			let warningTime = Math.max(osuBreak.startTime, osuBreak.endTime + GAMEPLAY_WARNING_ARROWS_FLICKER_START);
			this.breakEndWarningTimes.push(warningTime);
		}

		this.reset();

		let mediaPlayer = globalState.gameplayAudioPlayer,
		    backgroundManager = globalState.backgroundManager;

		console.time("Audio load");
		let songFile = await this.processedBeatmap.beatmap.getAudioFile();
		await mediaPlayer.loadFromVirtualFile(songFile);

		console.timeEnd("Audio load");

		let backgroundImageFile = await this.processedBeatmap.beatmap.getBackgroundImageFile();
		backgroundManager.setImage(backgroundImageFile, true);
		
		let backgroundVideoFile = await this.processedBeatmap.beatmap.getBackgroundVideoFile();
		if (backgroundVideoFile && !DISABLE_VIDEO) {
			try {
				await backgroundManager.setVideo(backgroundVideoFile);
				this.hasVideo = true;
			} catch (e) {
				console.error("Video load error", e);
			}
		}

		// TODO: Add nightcore percussion

		if (this.activeMods.has(Mod.HalfTime) || this.activeMods.has(Mod.Daycore)) this.playbackRate = HALF_TIME_PLAYBACK_RATE;
		if (this.activeMods.has(Mod.DoubleTime) || this.activeMods.has(Mod.Nightcore)) this.playbackRate = DOUBLE_TIME_PLAYBACK_RATE;

		mediaPlayer.setTempo(this.playbackRate);
		mediaPlayer.setPitch(1.0);

		if (this.activeMods.has(Mod.Nightcore)) mediaPlayer.setPitch(DOUBLE_TIME_PLAYBACK_RATE);
		if (this.activeMods.has(Mod.Daycore)) mediaPlayer.setPitch(HALF_TIME_PLAYBACK_RATE);

		this.preludeTime = this.processedBeatmap.getPreludeTime();

		if (this.activeMods.has(Mod.Flashlight)) this.controller.flashlightOccluder.show();
		else this.controller.flashlightOccluder.hide();

		this.controller.hud.setMode((() => {
			if (this.activeMods.has(Mod.Relax)) return HudMode.Relax;
			if (this.activeMods.has(Mod.Autopilot)) return HudMode.Autopilot;
			if (this.activeMods.has(Mod.Cinema)) return HudMode.Cinema;
			return HudMode.Normal;
		})());

		this.effectiveBackgroundDim = this.activeMods.has(Mod.Cinema)? 0.0 : BACKGROUND_DIM;

		await this.compose(true, true);

		this.initted = true;
	}

	async compose(updateSkin: boolean, triggerInstantly = false) {
		let screenHeight = currentWindowDimensions.height * 1; // The factor was determined through experimentation. Makes sense it's 1.

		this.hitObjectPixelRatio = screenHeight / STANDARD_SCREEN_DIMENSIONS.height;
		this.screenPixelRatio = screenHeight / REFERENCE_SCREEN_HEIGHT;
		this.circleDiameter = Math.round(this.circleDiameterOsuPx * this.hitObjectPixelRatio);
		this.circleRadius = this.circleDiameter / 2;
		this.headedHitObjectTextureFactor = this.circleDiameter / 128;

		if (updateSkin) {
			if (IGNORE_BEATMAP_SKIN && IGNORE_BEATMAP_HIT_SOUNDS) {
				this.skin = globalState.baseSkin;
			} else {
				let beatmapSkin = await this.processedBeatmap.beatmap.beatmapSet.getBeatmapSkin();
				this.skin = joinSkins([globalState.baseSkin, beatmapSkin], !IGNORE_BEATMAP_SKIN, !IGNORE_BEATMAP_HIT_SOUNDS);
			}

			let colorArray: Color[];
			if (IGNORE_BEATMAP_SKIN) {
				colorArray = this.skin.colors;
				if (colorArray.length === 0) colorArray = DEFAULT_COLORS;
			} else {
				colorArray = this.processedBeatmap.beatmap.colors.comboColors;
				if (colorArray.length === 0) colorArray = this.skin.colors;
				if (colorArray.length === 0) colorArray = DEFAULT_COLORS;
			}
			this.colorArray = colorArray;
		}

		this.drawableBeatmap.compose(updateSkin, triggerInstantly);
		this.scoreProcessor.compose();
	}

	async start(when?: number) {
		if (this.paused || this.playing) throw new Error("Can't start when paused or playing.");

		let minimumStartDuration = 0;
		if (this.processedBeatmap.hitObjects.length > 0) {
			minimumStartDuration = this.processedBeatmap.hitObjects[0].startTime / 1000; // When the first hit object starts. This way, we can be sure that we can skip the intro of the song without further audio decoding delay.
		}
		globalState.gameplayAudioPlayer.setMinimumBeginningSliceDuration(minimumStartDuration);

		if (when === undefined) when = 0 || -this.preludeTime / 1000;
		await globalState.gameplayAudioPlayer.start(when);

		this.playing = true;
		this.tick();
	}

	render() {
		if (!this.initted) return;

		let currentTime = this.getCurrentSongTime();
		let hudTime = this.toPlaybackRateIndependentTime(currentTime);
		const hud = this.controller.hud;
		const backgroundManager = globalState.backgroundManager;

		// Run a game tick right before rendering
		this.tick(currentTime);

		this.drawableBeatmap.render(currentTime);
		this.scoreProcessor.update(currentTime);

		hud.scorebar.setAmount(this.healthProcessor.health, currentTime);
		hud.scorebar.update(currentTime);
		hud.sectionStateDisplayer.update(currentTime);
		if (this.playing) hud.skipButton.update(currentTime);
		hud.accuracyMeter.update(hudTime);
		hud.keyCounter.update(hudTime);

		// Update the progress indicator
		let firstHitObject = this.processedBeatmap.hitObjects[0];
		if (firstHitObject) {
			let start = firstHitObject.startTime,
				end = this.processedBeatmap.getEndTime();
			let diff = currentTime - start;

			if (diff < 0) {
				let completion = (currentTime + this.preludeTime) / (start + this.preludeTime);
				completion = MathUtil.clamp(completion, 0, 1);

				hud.progressIndicator.draw(completion, true);
			} else {
				let completion = (currentTime - start) / (end - start);
				completion = MathUtil.clamp(completion, 0, 1);

				hud.progressIndicator.draw(completion, false); 
			}
		}

		// Update the gameplay warning arrows
		let currentGameplayWarningArrowsStartTime: number = null;
		for (let i = 0; i < this.breakEndWarningTimes.length; i++) {
			let startTime = this.breakEndWarningTimes[i];
			if (startTime > currentTime) break;

			let flickerDuration = GAMEPLAY_WARNING_ARROWS_FLICKER_END - GAMEPLAY_WARNING_ARROWS_FLICKER_START;
			let endTime = startTime + flickerDuration;

			if (currentTime >= startTime && currentTime < endTime) {
				currentGameplayWarningArrowsStartTime = startTime;
				break;
			}
		}
		hud.gameplayWarningArrows.update(currentTime, currentGameplayWarningArrowsStartTime);

		if (this.hasVideo) {
			// Take care of the video fading in in the first second of the audio
			let videoFadeInCompletion = currentTime / VIDEO_FADE_IN_DURATION;
			videoFadeInCompletion = MathUtil.clamp(videoFadeInCompletion, 0, 1);
			backgroundManager.setVideoOpacity(videoFadeInCompletion);

			// Sync the video to the audio
			let offsetDifference = Math.abs((backgroundManager.getVideoCurrentTime() * 1000) - currentTime);
			if (offsetDifference >= 30 && currentTime >= 0) {
				backgroundManager.setVideoCurrentTime(currentTime / 1000);
			}

			// Start the video when it's due
			if (currentTime >= 0 && backgroundManager.videoIsPaused()) backgroundManager.playVideo();

			let videoPlaybackRate = this.playbackRate * this.calculateFailPlaybackRateFactor();
			backgroundManager.setVideoPlaybackRate(MathUtil.clamp(videoPlaybackRate, 0.1, 10));
		}

		// Handle breaks
		let breakiness = 0;
		while (this.currentBreakIndex < this.processedBeatmap.breaks.length) {
			// Can't call this variable "break" because reserved keyword, retarded.
			let breakEvent = this.processedBeatmap.breaks[this.currentBreakIndex];
			if (currentTime >= breakEvent.endTime) {
				this.currentBreakIndex++;
				continue;
			}

			/** How much "break-iness" we have. Idk how to name this. 0 means not in the break, 1 means completely in the break, and anything between means *technically in the break*, but we're currently fading shit in. Or out. */
			breakiness = 0;

			// Comment this.
			// Nah so basically, this takes care of the edge case that a break is shorter than BREAK_FADE_TIME*2. Since we don't want the animation to "jump", we tell it to start the fade in the very middle of the break, rather than at endTime - BREAK_FADE_TIME. This might cause x to go, like, 0.0 -> 0.6 -> 0.0, instead of the usual 0.0 -> 1.0 -> 0.0.
			let breakFadeOutStart = Math.max(breakEvent.endTime - BREAK_FADE_TIME, (breakEvent.startTime + breakEvent.endTime)/2);

			if (currentTime >= breakEvent.startTime) {
				// If we arrive here, we should current be in a break (if I'm not mistaken)

				if (currentTime >= breakFadeOutStart) {
					let completion = (currentTime - (breakEvent.endTime - BREAK_FADE_TIME)) / BREAK_FADE_TIME;
					completion = MathUtil.clamp(completion, 0, 1);
					breakiness = 1 - completion;
				} else if (currentTime >= breakEvent.startTime) {
					let completion = (currentTime - breakEvent.startTime) / BREAK_FADE_TIME;
					completion = MathUtil.clamp(completion, 0, 1);
					breakiness = completion;
				}
			}

			let brightness = MathUtil.lerp(1 - this.effectiveBackgroundDim, 1 - this.effectiveBackgroundDim/2, MathUtil.ease(EaseType.EaseInOutQuad, breakiness));
			backgroundManager.setGameplayBrightness(brightness);

			hud.setBreakiness(breakiness);

			if (isFinite(breakEvent.endTime) && getBreakLength(breakEvent) >= SKIP_BUTTON_MIN_BREAK_LENGTH) {
				let fadeIn = MathUtil.clamp((currentTime - breakEvent.startTime) / SKIP_BUTTON_FADE_TIME, 0, 1);
				let fadeOut = 1 - MathUtil.clamp((currentTime - (breakEvent.endTime - SKIP_BUTTON_END_TIME - SKIP_BUTTON_FADE_TIME)) / SKIP_BUTTON_FADE_TIME, 0, 1);

				hud.skipButton.setVisibility(fadeIn * fadeOut);
			} else {
				hud.skipButton.setVisibility(0);
			}

			break;
		}

		if (this.controller.playbackReplay) {
			let screenCoordinates = this.toScreenCoordinates(this.controller.inputState.getMousePosition());
			this.controller.autoCursor.position.set(screenCoordinates.x, screenCoordinates.y);
		}
		
		if (this.activeMods.has(Mod.Flashlight)) {
			let screenCoordinates = this.toScreenCoordinates(this.controller.inputState.getMousePosition());
			this.controller.flashlightOccluder.update(screenCoordinates, this.screenPixelRatio, breakiness, this.drawableBeatmap.heldSliderRightNow());
		}
	}

	tick(currentTimeOverride?: number) {
		//console.log(this.completed);
		if (!this.playing || !this.initted || this.completed) return;

		let currentTime = (currentTimeOverride !== undefined)? currentTimeOverride : this.getCurrentSongTime();
		const hud = this.controller.hud;

		if (this.lastTickTime === null) this.lastTickTime = -this.preludeTime;
		/** Time since the last tick */
		let dt = currentTime - this.lastTickTime;
		this.lastTickTime = currentTime;

		this.drawableBeatmap.tick(currentTime, dt);

		// Update health
		if (!this.hasFailed()) this.healthProcessor.update(currentTime);
		if (this.healthProcessor.health <= 0) {
			this.fail();
			this.healthProcessor.health = 0;
		}

		// Show section pass/pass when necessary
		let currentBreak = this.getCurrentBreak();
		if (currentBreak) {
			let midpoint = getBreakMidpoint(currentBreak);
			let length = getBreakLength(currentBreak);

			if (isFinite(midpoint) && length >= 3000 && currentTime >= midpoint && hud.sectionStateDisplayer.getLastPopUpTime() < midpoint) {
				let isPass = this.healthProcessor.health >= 0.5;
				hud.sectionStateDisplayer.popUp(isPass, midpoint);
			}
		}

		// Check if the map has been completed
		if (this.drawableBeatmap.playEventsCompleted() && !this.hasFailed()) {
			this.controller.completePlay();
		}

		let failAnimationCompletion = this.calculateFailAnimationCompletion();
		if (this.hasFailed()) {
			globalState.gameplayAudioPlayer.setPlaybackRate(this.calculateFailPlaybackRateFactor());

			if (failAnimationCompletion === 1 && !this.failAnimationEndTriggered) {
				this.controller.pauseScreen.show(PauseScreenMode.Failed);
				globalState.gameplayAudioPlayer.pause();
				globalState.gameplayAudioPlayer.disablePlaybackRateChangerNode();

				this.failAnimationEndTriggered = true;
			}
		}
		
		this.drawableBeatmap.setFailAnimationCompletion(failAnimationCompletion);
		this.controller.setFailAnimationCompletion(failAnimationCompletion);
	}

	complete() {
		assert(!this.hasFailed());
		if (this.completed) return;

		this.completed = true;
	}

	pause() {
		if (this.paused || this.hasFailed()) return;

		this.render();

		this.paused = true;
		this.playing = false;

		globalState.gameplayAudioPlayer.pause();
		this.drawableBeatmap.stopHitObjectSounds();
		if (this.hasVideo) globalState.backgroundManager.pauseVideo();
	}

	unpause() {
		if (!this.paused) return;
		
		this.paused = false;
		this.playing = true;

		globalState.gameplayAudioPlayer.unpause();
	}

	reset() {
		this.drawableBeatmap.reset();
		this.scoreProcessor.reset();
		this.healthProcessor.reset();
		this.remainingLives = this.getTotalLives();

		this.lastTickTime = null;
		this.currentBreakIndex = 0;
		this.paused = false;
		this.playing = false;
		this.completed = false;
		this.failTime = null;
		this.currentTimeAtFail = null;
		this.failAnimationEndTriggered = false;
		globalState.gameplayAudioPlayer.pause();
		globalState.gameplayAudioPlayer.disablePlaybackRateChangerNode();

		if (this.controller.playbackReplay) this.controller.playbackReplay.resetPlayback();
	}

	async restart() {
		this.reset();
		await this.start();
	}

	// Instance should be discarded after this is called.
	stop() {
		this.playing = false;
		this.drawableBeatmap.dispose();

		globalState.gameplayAudioPlayer.stop();
		globalState.gameplayAudioPlayer.disablePlaybackRateChangerNode();
		this.drawableBeatmap.stopHitObjectSounds();
		if (this.hasVideo) globalState.backgroundManager.removeVideo();
	}

	processJudgement(judgement: Judgement) {
		if (this.hasFailed()) return;

		this.healthProcessor.update(judgement.time);
		if (this.healthProcessor.health <= 0 && !this.cannotFail()) return; // Don't process the judgement; the player has failed.

		this.healthProcessor.process(judgement);
		this.scoreProcessor.process(judgement);

		// Handle SD and PF insta-fail on miss
		if ((this.activeMods.has(Mod.SuddenDeath) || this.activeMods.has(Mod.Perfect)) && judgement.value === ScoringValue.Miss) {
			this.fail();
		}

		// Handle PF insta-fail on a non-perfect hit
		if (this.activeMods.has(Mod.Perfect) && (judgement.value === ScoringValue.Hit100 || judgement.value === ScoringValue.Hit50)) {
			this.fail();
		}
	}

	handleButtonDown(currentTime?: number) {
		if (!this.handlesInputRightNow() || this.activeMods.has(Mod.Relax)) return;

		if (currentTime === undefined) currentTime = this.getCurrentSongTime();
		this.drawableBeatmap.handleButtonDown(currentTime);
	}

	handleMouseMove(osuPosition: Point, currentTime?: number) {
		if (!this.handlesInputRightNow()) return;

		if (currentTime === undefined) currentTime = this.getCurrentSongTime();
		this.drawableBeatmap.handleMouseMove(currentTime);
	}

	handlesInputRightNow() {
		return this.initted && !this.paused && !this.completed && !this.hasFailed();
	}

	async skipBreak() {
		if (this.hasFailed() || !this.playing || this.activeMods.has(Mod.Cinema)) return;

		let currentTime = this.getCurrentSongTime();
		let currentBreak = this.processedBeatmap.breaks[this.currentBreakIndex];

		if (isFinite(currentBreak.endTime) && currentTime >= currentBreak.startTime) {
			let skipToTime = currentBreak.endTime - SKIP_BUTTON_END_TIME;

			if (currentTime < skipToTime) {
				await globalState.gameplayAudioPlayer.start(skipToTime / 1000);
				this.controller.hud.skipButton.doFlash();
			}
		}
	}

	private calculateFailAnimationCompletion() {
		if (!this.hasFailed()) return 0.0;
		return MathUtil.clamp((performance.now() - this.failTime) / FAIL_ANIMATION_DURATION, 0, 1);
	}

	private calculateFailPlaybackRateFactor() {
		return 1 - this.calculateFailAnimationCompletion();
	}

	private getTotalLives() {
		return this.activeMods.has(Mod.Easy)? 3 : 1;
	}

	getCurrentSongTime() {
		if (!this.initted) return null;

		if (this.hasFailed()) {
			let elapsed = MathUtil.clamp(performance.now() - this.failTime, 0, FAIL_ANIMATION_DURATION);
			let currentSongTime = this.currentTimeAtFail + elapsed - elapsed**2 / (2 * FAIL_ANIMATION_DURATION);

			return currentSongTime;
		}

		if (globalState.gameplayAudioPlayer.isPlaying() === false) return -this.preludeTime;
		return globalState.gameplayAudioPlayer.getCurrentTime() * 1000 - audioContext.baseLatency*1000; // The shift by baseLatency seems to make more input more correct, for now.
	}

	toPlaybackRateIndependentTime(time: number) {
		return time / this.playbackRate;
	}

	toScreenCoordinatesX(osuCoordinateX: number, floor = true) {
		let coord = currentWindowDimensions.width*SCREEN_COORDINATES_X_FACTOR + (osuCoordinateX - PLAYFIELD_DIMENSIONS.width/2) * this.hitObjectPixelRatio;

		return floor? (coord | 0) : coord; // "Cast" to int
	}

	toScreenCoordinatesY(osuCoordinateY: number, floor = true) {
		let coord = currentWindowDimensions.height*SCREEN_COORDINATES_Y_FACTOR + (osuCoordinateY - PLAYFIELD_DIMENSIONS.height/2) * this.hitObjectPixelRatio; // The innerHeight factor is the result of eyeballing and comparing to stable osu!

		return floor? (coord | 0) : coord;
	}

	toScreenCoordinates(osuCoordiate: Point, floor = true): Point {
		return {
			x: this.toScreenCoordinatesX(osuCoordiate.x, floor),
			y: this.toScreenCoordinatesY(osuCoordiate.y, floor)
		};
	}

	// Inverse of toScreenCoordinatesX
	toOsuCoordinatesX(screenCoordinateX: number) {
		return (screenCoordinateX - currentWindowDimensions.width*0.5) / this.hitObjectPixelRatio + PLAYFIELD_DIMENSIONS.width/2;
	}
	
	// Inverse of toScreenCoordinatesY
	toOsuCoordinatesY(screenCoordinateY: number) {
		return (screenCoordinateY - currentWindowDimensions.height*0.510) / this.hitObjectPixelRatio + PLAYFIELD_DIMENSIONS.height/2;
	}

	toOsuCoordinates(screenCoordinate: Point) {
		return {
			x: this.toOsuCoordinatesX(screenCoordinate.x),
			y: this.toOsuCoordinatesY(screenCoordinate.y)
		};
	}

	/** Headed hit objects can only be hit when the previous one has already been assigned a scoring value. If it has not, the hit object remains 'locked' and doesn't allow input, also known as note locking. */
	hitObjectIsInputLocked(hitObject: DrawableHeadedHitObject) {
		let objectBefore = this.drawableBeatmap.drawableHitObjects[hitObject.parent.index - 1];
		if (!objectBefore || !(objectBefore instanceof DrawableHeadedHitObject)) return false;

		return objectBefore.scoring.head.hit === ScoringValue.None;
	}

	getCurrentBreak() {
		return this.processedBeatmap.breaks[this.currentBreakIndex] || null;
	}

	private getHitSoundPlaybackRate() {
		if (!this.processedBeatmap.beatmap.samplesMatchPlaybackRate) return 1.0;
		if (this.activeMods.has(Mod.Nightcore) || this.activeMods.has(Mod.Daycore)) return this.playbackRate;
		return 1.0;
	}

	playHitSound(info: HitSoundInfo) {
		let skin = this.skin;
		let pan = calculatePanFromOsuCoordinates(info.position);
		let playbackRate = this.getHitSoundPlaybackRate();

		let baseSound = skin.hitSounds[info.base];
        baseSound.play(info.volume, info.sampleIndex, pan, playbackRate);

        if (info.additions) {
            for (let i = 0; i < info.additions.length; i++) {
                let additionSound = skin.hitSounds[info.additions[i]];
                additionSound.play(info.volume, info.sampleIndex, pan, playbackRate);
            }
        }
    }

	fail() {
		if (this.completed) return;
		if (this.hasFailed()) return;
		if (this.cannotFail()) return;

		this.remainingLives--;
		if (this.remainingLives > 0) {
			// Heal back to full health
			this.healthProcessor.health = 1.0;
			return;
		}

		this.currentTimeAtFail = this.getCurrentSongTime();
		this.failTime = performance.now();

		globalState.gameplayAudioPlayer.enablePlaybackRateChangerNode();

		this.drawableBeatmap.stopHitObjectSounds();
	}

	hasFailed() {
		return this.failTime !== null;
	}

	cannotFail() {
		return this.activeMods.has(Mod.Auto) || this.activeMods.has(Mod.Cinema) || this.activeMods.has(Mod.Relax) || this.activeMods.has(Mod.Autopilot) || this.activeMods.has(Mod.NoFail);
	}
}