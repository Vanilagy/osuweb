import { PLAYFIELD_DIMENSIONS, STANDARD_SCREEN_DIMENSIONS, SCREEN_COORDINATES_X_FACTOR, SCREEN_COORDINATES_Y_FACTOR } from "../util/constants";
import { Point, lerpPoints } from "../util/point";
import { ScoreCounter } from "./score/score_counter";
import { getCurrentMousePosition } from "../input/input";
import { MathUtil, EaseType } from "../util/math_util";
import { last } from "../util/misc_util";
import { DrawableHeadedHitObject } from "./drawables/drawable_headed_hit_object";
import { joinSkins, IGNORE_BEATMAP_SKIN, IGNORE_BEATMAP_HIT_SOUNDS, DEFAULT_COLORS, Skin } from "./skin/skin";
import { AutoInstruction, ModHelper, HALF_TIME_PLAYBACK_RATE, DOUBLE_TIME_PLAYBACK_RATE, AutoInstructionType } from "./mods/mod_helper";
import { calculatePanFromOsuCoordinates, HitSoundInfo } from "./skin/sound";
import { DrawableBeatmap } from "./drawable_beatmap";
import { ProcessedBeatmap, getBreakMidpoint, getBreakLength } from "../datamodel/processed/processed_beatmap";
import { ProcessedSlider } from "../datamodel/processed/processed_slider";
import { Color } from "../util/graphics_util";
import { REFERENCE_SCREEN_HEIGHT, currentWindowDimensions } from "../visuals/ui";
import { GameplayController } from "./gameplay_controller";
import { globalState } from "../global_state";
import { ScoringValue } from "../datamodel/score";
import { Mod } from "../datamodel/mods";
import { SKIP_BUTTON_MIN_BREAK_LENGTH, SKIP_BUTTON_FADE_TIME, SKIP_BUTTON_END_TIME } from "./hud/skip_button";
import { audioContext } from "../audio/audio";

const AUTOHIT_OVERRIDE = false; // Just hits everything perfectly, regardless of using AT or not. This is NOT auto, it doesn't do fancy cursor stuff. Furthermore, having this one does NOT disable manual user input.
const BREAK_FADE_TIME = 1000; // In ms
const BACKGROUND_DIM = 0.85; // To figure out dimmed backgorund image opacity, that's equal to: (1 - BACKGROUND_DIM) * DEFAULT_BACKGROUND_OPACITY
const STREAM_BEAT_THRESHHOLD = 155; // For ease types in AT instruction
const DISABLE_VIDEO = false;
const VIDEO_FADE_IN_DURATION = 1000; // In ms
const GAMEPLAY_WARNING_ARROWS_FLICKER_START = -1000; // Both of these are relative to the end of the break
const GAMEPLAY_WARNING_ARROWS_FLICKER_END = 400;

export class Play {
	public controller: GameplayController;
	public processedBeatmap: ProcessedBeatmap;
	public drawableBeatmap: DrawableBeatmap;
	public preludeTime: number;
	private playbackRate: number = 1.0;
	private hasVideo: boolean = false;
	public paused: boolean = false;
	private playing: boolean = false;
	private initted: boolean = false;
	public completed: boolean = false;

	private passiveHealthDrain: number = 0.00005; // In health/ms
	public currentHealth: number;
	public scoreCounter: ScoreCounter;
	public activeMods: Set<Mod>;
	public colorArray: Color[];

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

	// AT stuffz:
	private playthroughInstructions: AutoInstruction[];
	private currentPlaythroughInstruction: number;
	private lastAutoCursorPosition: Point = null;
	public autohit: boolean;

	constructor(controller: GameplayController, processedBeatmap: ProcessedBeatmap, mods: Set<Mod>) {
		this.controller = controller;
		this.processedBeatmap = processedBeatmap;
		this.drawableBeatmap = new DrawableBeatmap(this, this.processedBeatmap);
		this.scoreCounter = new ScoreCounter(this, this.processedBeatmap);
		this.activeMods = mods;
	}
	
	async init() {
		if (this.initted) return;

		if (this.activeMods.has(Mod.Easy)) ModHelper.applyEz(this.processedBeatmap);
		if (this.activeMods.has(Mod.HardRock)) ModHelper.applyHrFirstPass(this.processedBeatmap);

		this.approachTime = this.processedBeatmap.difficulty.getApproachTime();
		this.circleDiameterOsuPx = this.processedBeatmap.difficulty.getCirclePixelSize();
		this.circleRadiusOsuPx = this.circleDiameterOsuPx / 2;

		console.time("Beatmap process");
		this.processedBeatmap.init();
		console.timeEnd("Beatmap process");

		if (this.activeMods.has(Mod.HardRock)) ModHelper.applyHrSecondPass(this.processedBeatmap);

		console.time('Stack shift');
		this.processedBeatmap.applyStackShift();
		console.timeEnd('Stack shift');

		console.time("Beatmap draw");
		this.drawableBeatmap.init();
		this.drawableBeatmap.draw();
		console.timeEnd("Beatmap draw");

		this.scoreCounter.init();

		this.autohit = AUTOHIT_OVERRIDE;
		if (this.activeMods.has(Mod.Auto)) {
			this.playthroughInstructions = ModHelper.generateAutoPlaythroughInstructions(this);
			this.autohit = true;
			this.controller.autoCursor.visible = true;
		}

		// Compute break end warning times
		for (let i = 0; i < this.processedBeatmap.breaks.length; i++) {
			let osuBreak = this.processedBeatmap.breaks[i];
			if (!isFinite(getBreakMidpoint(osuBreak))) continue; // It has to be a bounded break

			let warningTime = Math.max(osuBreak.startTime, osuBreak.endTime + GAMEPLAY_WARNING_ARROWS_FLICKER_START);
			this.breakEndWarningTimes.push(warningTime);
		}

		this.reset();

		let mediaPlayer = globalState.gameplayMediaPlayer,
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
		this.scoreCounter.compose();
	}

	async start(when?: number) {
		if (this.paused || this.playing) throw new Error("Can't start when paused or playing.");

		let minimumStartDuration = 0;
		if (this.processedBeatmap.hitObjects.length > 0) {
			minimumStartDuration = this.processedBeatmap.hitObjects[0].startTime / 1000; // When the first hit object starts. This way, we can be sure that we can skip the intro of the song without further audio decoding delay.
		}
		globalState.gameplayMediaPlayer.setMinimumBeginningSliceDuration(minimumStartDuration);

		if (when === undefined) when = 0 || -this.preludeTime / 1000;
		await globalState.gameplayMediaPlayer.start(when);

		this.playing = true;
		this.tick();
	}

	render() {
		if (!this.initted) return;

		let currentTime = this.getCurrentSongTime();
		const hud = this.controller.hud;
		const backgroundManager = globalState.backgroundManager;

		// Run a game tick right before rendering
		this.tick(currentTime);

		this.drawableBeatmap.render(currentTime);
		this.scoreCounter.update(currentTime);

		hud.scorebar.update(currentTime);
		hud.sectionStateDisplayer.update(currentTime);
		if (this.playing) hud.skipButton.update(currentTime);
		hud.accuracyMeter.update(currentTime);

		// Update the progress indicator
		let firstHitObject = this.processedBeatmap.hitObjects[0],
			lastHitObject = last(this.processedBeatmap.hitObjects);
		if (firstHitObject && lastHitObject) {
			let start = firstHitObject.startTime,
				end = lastHitObject.endTime;
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
			if (currentTime >= 0 && backgroundManager.videoIsPaused()) {
				backgroundManager.setVideoPlaybackRate(this.playbackRate);
				backgroundManager.playVideo();
			}
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

			let brightness = MathUtil.lerp(1 - BACKGROUND_DIM, 1 - BACKGROUND_DIM/2, MathUtil.ease(EaseType.EaseInOutQuad, breakiness));
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

		// Update the cursor position if rocking AT
		let gameCursorPosition: Point;
		if (this.activeMods.has(Mod.Auto)) {
			this.handlePlaythroughInstructions(currentTime);
			this.controller.autoCursor.position.set(this.lastAutoCursorPosition.x, this.lastAutoCursorPosition.y);

			gameCursorPosition = this.lastAutoCursorPosition;
		}
		
		if (this.activeMods.has(Mod.Flashlight)) {
			if (!gameCursorPosition) gameCursorPosition = this.toScreenCoordinates(this.getOsuMouseCoordinatesFromCurrentMousePosition());
			this.controller.flashlightOccluder.update(gameCursorPosition, this.screenPixelRatio, breakiness, this.drawableBeatmap.heldSliderRightNow());
		}
	}

	tick(currentTimeOverride?: number) {
		if (!this.playing || !this.initted || this.completed) return;

		let currentTime = (currentTimeOverride !== undefined)? currentTimeOverride : this.getCurrentSongTime();
		const hud = this.controller.hud;

		if (this.lastTickTime === null) {
			this.lastTickTime = currentTime;
			return;
		}
		/** Time since the last tick */
		let dt = currentTime - this.lastTickTime;
		this.lastTickTime = currentTime;

		this.drawableBeatmap.tick(currentTime, dt);

		// Update health
		if (!this.processedBeatmap.isInBreak(currentTime)) this.gainHealth(-this.passiveHealthDrain * dt, currentTime); // "Gain" negative health

		// Show section pass/pass when necessary
		let currentBreak = this.getCurrentBreak();
		if (currentBreak) {
			let midpoint = getBreakMidpoint(currentBreak);
			let length = getBreakLength(currentBreak);

			if (isFinite(midpoint) && length >= 3000 && currentTime >= midpoint && hud.sectionStateDisplayer.getLastPopUpTime() < midpoint) {
				let isPass = this.currentHealth >= 0.5;
				hud.sectionStateDisplayer.popUp(isPass, midpoint);
			}
		}

		// Check if the map has been completed
		if (this.drawableBeatmap.playEventsCompleted()) {
			this.controller.completePlay();
		}
	}

	complete() {
		if (this.completed) return;
		this.completed = true;
	}

	pause() {
		if (this.paused) return;

		this.render();

		this.paused = true;
		this.playing = false;

		globalState.gameplayMediaPlayer.pause();
		this.drawableBeatmap.stopHitObjectSounds();
		if (this.hasVideo) globalState.backgroundManager.pauseVideo();
	}

	unpause() {
		if (!this.paused) return;
		
		this.paused = false;
		this.playing = true;

		globalState.gameplayMediaPlayer.unpause();
	}

	reset() {
		this.drawableBeatmap.reset();
		this.scoreCounter.reset();

		this.currentHealth = 1.0;
		this.lastTickTime = null;
		this.currentBreakIndex = 0;
		this.paused = false;
		this.playing = false;
		this.completed = false;

		if (this.activeMods.has(Mod.Auto)) {
			this.currentPlaythroughInstruction = 0;
		}
	}

	async restart() {
		this.reset();
		await this.start();
	}

	// Instance should be discarded after this is called.
	stop() {
		this.playing = false;
		this.drawableBeatmap.dispose();

		globalState.gameplayMediaPlayer.stop();
		this.drawableBeatmap.stopHitObjectSounds();
		if (this.hasVideo) globalState.backgroundManager.removeVideo();
	}

	handleButtonDown() {
		if (!this.shouldHandleInputRightNow() || this.activeMods.has(Mod.Relax)) return;
		this.drawableBeatmap.handleButtonDown();
	}

	handleMouseMove() {
		if (!this.shouldHandleInputRightNow()) return;
		this.drawableBeatmap.handleMouseMove();
	}

	private shouldHandleInputRightNow() {
		return this.initted && !this.paused && !this.completed && !this.activeMods.has(Mod.Auto);
	}

	async skipBreak() {
		let currentTime = this.getCurrentSongTime();
		let currentBreak = this.processedBeatmap.breaks[this.currentBreakIndex];

		if (isFinite(currentBreak.endTime) && currentTime >= currentBreak.startTime) {
			let skipToTime = currentBreak.endTime - SKIP_BUTTON_END_TIME;

			if (currentTime < skipToTime) {
				await globalState.gameplayMediaPlayer.start(skipToTime / 1000);
			}
		}
	}

	getCurrentSongTime() {
		if (!this.initted) return null;

		if (globalState.gameplayMediaPlayer.isPlaying() === false) return -this.preludeTime;
		return globalState.gameplayMediaPlayer.getCurrentTime() * 1000 - audioContext.baseLatency*1000; // The shift by baseLatency seems to make more input more correct, for now.
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

	getOsuMouseCoordinatesFromCurrentMousePosition(): Point {
		let currentMousePosition = getCurrentMousePosition();

		return {
			x: this.toOsuCoordinatesX(currentMousePosition.x),
			y: this.toOsuCoordinatesY(currentMousePosition.y)
		};
	}

	gainHealth(gain: number, currentTime: number) {
		this.setHealth(this.currentHealth + gain, currentTime);
	}

	setHealth(to: number, currentTime: number) {
		this.currentHealth = MathUtil.clamp(to, 0, 1);
		this.controller.hud.scorebar.setAmount(this.currentHealth, currentTime);
	}

	/** Headed hit objects can only be hit when the previous one has already been assigned a judgement. If it has not, the hit object remains 'locked' and doesn't allow input, also known as note locking. */
	hitObjectIsInputLocked(hitObject: DrawableHeadedHitObject) {
		let objectBefore = this.drawableBeatmap.drawableHitObjects[hitObject.parent.index - 1];
		if (!objectBefore || !(objectBefore instanceof DrawableHeadedHitObject)) return false;

		return objectBefore.scoring.head.hit === ScoringValue.NotHit;
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

		let baseSound = skin.sounds[info.base];
        baseSound.play(info.volume, info.sampleIndex, pan, playbackRate);

        if (info.additions) {
            for (let i = 0; i < info.additions.length; i++) {
                let additionSound = skin.sounds[info.additions[i]];
                additionSound.play(info.volume, info.sampleIndex, pan, playbackRate);
            }
        }
    }

 	/** Handles playthrough instructions for AT. */
	private handlePlaythroughInstructions(currentTime: number) {
		if (this.currentPlaythroughInstruction >= this.playthroughInstructions.length) return;

		if (this.playthroughInstructions[this.currentPlaythroughInstruction + 1]) {
			while (this.playthroughInstructions[this.currentPlaythroughInstruction + 1].time <= currentTime) {
				this.currentPlaythroughInstruction++;

				if (!this.playthroughInstructions[this.currentPlaythroughInstruction + 1]) {
					break;
				}
			}
		}

		let currentInstruction = this.playthroughInstructions[this.currentPlaythroughInstruction];
		//if (currentInstruction.time > currentTime) return;

		let cursorPlayfieldPos: Point = null;

		outer:
		if (currentInstruction.type === AutoInstructionType.Blink) {
			cursorPlayfieldPos = currentInstruction.to;

			this.currentPlaythroughInstruction++;
		} else if (currentInstruction.type === AutoInstructionType.Move) {
			// Decides on the easing type
			let timeDifference = (currentInstruction.endTime - currentInstruction.time);
			let easingType: EaseType;

			if (timeDifference <= 60000 / STREAM_BEAT_THRESHHOLD / 4) { // Length of 1/4 beats at set BPM
				easingType = EaseType.Linear;
			} else {
				easingType = EaseType.EaseOutQuad;
			}

			let completion = (currentTime - currentInstruction.time) / (currentInstruction.endTime - currentInstruction.time);
			completion = MathUtil.clamp(completion, 0, 1);
			completion = MathUtil.ease(easingType, completion);

			cursorPlayfieldPos = lerpPoints(currentInstruction.startPos, currentInstruction.endPos, completion);

			if (completion === 1) this.currentPlaythroughInstruction++;
		} else if (currentInstruction.type === AutoInstructionType.Follow) {
			let slider = currentInstruction.hitObject as ProcessedSlider;

			if (currentTime >= slider.endTime) {
				this.currentPlaythroughInstruction++;
				cursorPlayfieldPos = slider.endPoint;
				break outer;
			}

			let completion = (slider.velocity * (currentTime - slider.startTime)) / slider.length;
			completion = MathUtil.clamp(completion, 0, slider.repeat);

			cursorPlayfieldPos = slider.path.getPosFromPercentage(MathUtil.mirror(completion));
		} else if (currentInstruction.type === AutoInstructionType.Spin) {
			cursorPlayfieldPos = ModHelper.getSpinPositionFromSpinInstruction(currentInstruction, Math.min(currentInstruction.endTime, currentTime));

			if (currentTime >= currentInstruction.endTime) {
				this.currentPlaythroughInstruction++;
				break outer;
			}
		}

		let screenCoordinates = this.toScreenCoordinates(cursorPlayfieldPos, false);
		this.lastAutoCursorPosition = screenCoordinates;
	}
}