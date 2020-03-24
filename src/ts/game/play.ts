import { DrawableSlider, FOLLOW_CIRCLE_HITBOX_CS_RATIO } from "./drawables/drawable_slider";
import { DrawableHitObject } from "./drawables/drawable_hit_object";
import { PLAYFIELD_DIMENSIONS, STANDARD_SCREEN_DIMENSIONS, SCREEN_COORDINATES_X_FACTOR, SCREEN_COORDINATES_Y_FACTOR } from "../util/constants";
import { DrawableSpinner } from "./drawables/drawable_spinner";
import { Point, pointDistance, lerpPoints } from "../util/point";
import { FollowPoint } from "./drawables/follow_point";
import { ScoreCounter } from "./score/score_counter";
import { getCurrentMousePosition } from "../input/input";
import { MathUtil, EaseType } from "../util/math_util";
import { last } from "../util/misc_util";
import { DrawableHeadedHitObject } from "./drawables/drawable_headed_hit_object";
import { joinSkins, IGNORE_BEATMAP_SKIN, IGNORE_BEATMAP_HIT_SOUNDS, DEFAULT_COLORS, Skin } from "./skin/skin";
import { HitCirclePrimitive } from "./drawables/hit_circle_primitive";
import { AutoInstruction, ModHelper, HALF_TIME_PLAYBACK_RATE, DOUBLE_TIME_PLAYBACK_RATE, AutoInstructionType } from "./mods/mod_helper";
import { calculatePanFromOsuCoordinates, HitSoundInfo } from "./skin/sound";
import { DrawableBeatmap } from "./drawable_beatmap";
import { ProcessedBeatmap, getBreakMidpoint, getBreakLength } from "../datamodel/processed/processed_beatmap";
import { PlayEvent, PlayEventType } from "../datamodel/play_events";
import { ProcessedSlider } from "../datamodel/processed/processed_slider";
import { Color } from "../util/graphics_util";
import { REFERENCE_SCREEN_HEIGHT, currentWindowDimensions } from "../visuals/ui";
import { addTickingTask } from "../util/ticker";
import { GameplayController } from "./gameplay_controller";
import { globalState } from "../global_state";
import { ScorePopup } from "./score/score_popup";
import { ScoringValue } from "../datamodel/score";
import { Mod } from "../datamodel/mods";
import { SKIP_BUTTON_MIN_BREAK_LENGTH, SKIP_BUTTON_FADE_TIME, SKIP_BUTTON_END_TIME } from "./hud/skip_button";

const AUTOHIT_OVERRIDE = false; // Just hits everything perfectly, regardless of using AT or not. This is NOT auto, it doesn't do fancy cursor stuff. Furthermore, having this one does NOT disable manual user input.
const BREAK_FADE_TIME = 1750; // In ms
const BACKGROUND_DIM = 0.85; // To figure out dimmed backgorund image opacity, that's equal to: (1 - BACKGROUND_DIM) * DEFAULT_BACKGROUND_OPACITY
const DEFAULT_BACKGROUND_OPACITY = 0.333;
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

	private currentHitObjectIndex: number;
	private onscreenHitObjects: DrawableHitObject[];
	private currentFollowPointIndex = 0;
	private onscreenFollowPoints: FollowPoint[];
	private showHitObjectsQueue: DrawableHitObject[]; // New hit objects that have to get added to the scene next frame
	private scorePopups: ScorePopup[];

	private passiveHealthDrain: number = 0.00005; // In health/ms
	public currentHealth: number;
	public scoreCounter: ScoreCounter;
	public activeMods: Set<Mod>;
	public colorArray: Color[];

	private lastTickTime: number = null;
	private playEvents: PlayEvent[] = [];
	private currentSustainedEvents: PlayEvent[];
	private currentPlayEvent: number = 0;
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
	private autohit: boolean;

	constructor(controller: GameplayController, processedBeatmap: ProcessedBeatmap, mods: Set<Mod>) {
		this.controller = controller;
		this.processedBeatmap = processedBeatmap;
		this.drawableBeatmap = new DrawableBeatmap(this, this.processedBeatmap);
		this.scoreCounter = new ScoreCounter(this, this.processedBeatmap);
		this.activeMods = mods;
	}
	
	async init() {
		if (this.initted) return;

		let screenHeight = currentWindowDimensions.height * 1; // The factor was determined through experimentation. Makes sense it's 1.
		this.hitObjectPixelRatio = screenHeight / STANDARD_SCREEN_DIMENSIONS.height;
		this.screenPixelRatio = screenHeight / REFERENCE_SCREEN_HEIGHT;

		if (IGNORE_BEATMAP_SKIN && IGNORE_BEATMAP_HIT_SOUNDS) {
			this.skin = globalState.baseSkin;
		} else {
			let beatmapSkin = await this.processedBeatmap.beatmap.beatmapSet.getBeatmapSkin();
			this.skin = joinSkins([globalState.baseSkin, beatmapSkin], !IGNORE_BEATMAP_SKIN, !IGNORE_BEATMAP_HIT_SOUNDS);
		}

		if (this.activeMods.has(Mod.Easy)) ModHelper.applyEz(this.processedBeatmap);
		if (this.activeMods.has(Mod.HardRock)) ModHelper.applyHrFirstPass(this.processedBeatmap);

		this.approachTime = this.processedBeatmap.difficulty.getApproachTime();
		this.circleDiameterOsuPx = this.processedBeatmap.difficulty.getCirclePixelSize();
		this.circleDiameter = Math.round(this.circleDiameterOsuPx * this.hitObjectPixelRatio);
		this.circleRadiusOsuPx = this.circleDiameterOsuPx / 2;
		this.circleRadius = this.circleDiameter / 2;
		this.headedHitObjectTextureFactor = this.circleDiameter / 128;

		console.time("Beatmap process");
		this.processedBeatmap.init();
		console.timeEnd("Beatmap process");

		if (this.activeMods.has(Mod.HardRock)) ModHelper.applyHrSecondPass(this.processedBeatmap);

		console.time('Stack shift');
		this.processedBeatmap.applyStackShift();
		console.timeEnd('Stack shift');

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

		console.time("Beatmap draw");
		this.drawableBeatmap.init();
		this.drawableBeatmap.draw();
		console.timeEnd("Beatmap draw");

		console.time("Play event generation");
		this.playEvents = this.processedBeatmap.getAllPlayEvents();
		console.timeEnd("Play event generation");

		this.scoreCounter.init();

		this.drawableBeatmap.generateFollowPoints();

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
		if (backgroundImageFile) backgroundManager.setImage(backgroundImageFile);
		
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

		this.initted = true;
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

		// Show new hit objects
		for (let i = 0; i < this.showHitObjectsQueue.length; i++) {
			this.showHitObjectsQueue[i].show(currentTime);
		}
		this.showHitObjectsQueue.length = 0;

		// Update hit objects on screen, or remove them if necessary
		for (let i = 0; i < this.onscreenHitObjects.length; i++) {
			let hitObject = this.onscreenHitObjects[i];

			hitObject.update(currentTime);

			if (hitObject.renderFinished) {
				// Hit object can now safely be removed from the screen

				hitObject.remove();
				this.onscreenHitObjects.splice(i--, 1);

				continue;
			}
		}

		// Update the score display
		this.scoreCounter.updateDisplay(currentTime);

		// Update scorebar
		hud.scorebar.update(currentTime);

		// Update section state displayer (MAN, THESE COMMENTS ARE SO USEFUL, OMG)
		hud.sectionStateDisplayer.update(currentTime);

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

		// Update the accuracy meter
		hud.accuracyMeter.update(currentTime);

		// Update score popups
		for (let i = 0; i < this.scorePopups.length; i++) {
			let popup = this.scorePopups[i];

			popup.update(currentTime);

			if (popup.renderingFinished) {
				popup.remove();
				this.scorePopups.splice(i, 1); // I hope this won't be slow
				i--;
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

		if (!this.playing) return;
		// Don't run the following code if not playing

		// Render follow points
		for (let i = this.currentFollowPointIndex; i < this.drawableBeatmap.followPoints.length; i++) {
			let followPoint = this.drawableBeatmap.followPoints[i];
			if (currentTime < followPoint.renderStartTime) break;

			this.onscreenFollowPoints.push(followPoint);
			followPoint.show();

			this.currentFollowPointIndex++;
		}

		for (let i = 0; i < this.onscreenFollowPoints.length; i++) {
			let followPoint = this.onscreenFollowPoints[i];

			followPoint.update(currentTime);

			if (followPoint.renderFinished) {
				followPoint.remove();
				this.onscreenFollowPoints.splice(i--, 1);
			}
		}

		// Skip button
		hud.skipButton.update(currentTime);

		// Handle breaks
		while (this.currentBreakIndex < this.processedBeatmap.breaks.length) {
			// Can't call this variable "break" because reserved keyword, retarded.
			let breakEvent = this.processedBeatmap.breaks[this.currentBreakIndex];
			if (currentTime >= breakEvent.endTime) {
				this.currentBreakIndex++;
				continue;
			}

			/** How much "break-iness" we have. Idk how to name this. 0 means not in the break, 1 means completely in the break, and anything between means *technically in the break*, but we're currently fading shit in. Or out. */
			let breakiness = 0;

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

			// Go from 1.0 brightness to (1 - background dim) brightness
			let brightness = MathUtil.ease(EaseType.EaseInOutQuad, breakiness) * DEFAULT_BACKGROUND_OPACITY + (1 - breakiness)*((1 - BACKGROUND_DIM) * DEFAULT_BACKGROUND_OPACITY);
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
		if (this.activeMods.has(Mod.Auto)) this.handlePlaythroughInstructions(currentTime);
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

		let osuMouseCoordinates = this.getOsuMouseCoordinatesFromCurrentMousePosition();
		let buttonPressed = this.controller.inputController.isAnyButtonPressed();

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

		// Add new hit objects to screen
		for (this.currentHitObjectIndex; this.currentHitObjectIndex < this.drawableBeatmap.drawableHitObjects.length; this.currentHitObjectIndex++) {
			let hitObject = this.drawableBeatmap.drawableHitObjects[this.currentHitObjectIndex];
			if (currentTime < hitObject.renderStartTime) break;

			this.onscreenHitObjects.push(hitObject);
			this.showHitObjectsQueue.push(hitObject);
		}
		
		for (this.currentPlayEvent; this.currentPlayEvent < this.playEvents.length; this.currentPlayEvent++) {
			let playEvent = this.playEvents[this.currentPlayEvent];
			if (playEvent.time > currentTime) break;

			if (playEvent.endTime !== undefined) {
				this.currentSustainedEvents.push(playEvent);
				continue;
			}
			
			let drawable = this.drawableBeatmap.processedToDrawable.get(playEvent.hitObject);

			switch (playEvent.type) {
				case PlayEventType.HeadHitWindowEnd: {
					let hitObject = drawable as DrawableHeadedHitObject;
					if (hitObject.scoring.head.hit !== ScoringValue.NotHit) break;

					hitObject.hitHead(playEvent.time, 0);
				}; break;
				case PlayEventType.PerfectHeadHit: {
					if (drawable instanceof DrawableSlider) {
						let slider = drawable;

						slider.beginSliderSlideSound(currentTime);

						let distance = pointDistance(osuMouseCoordinates, playEvent.position);
						let hit = (buttonPressed && distance <= this.circleRadiusOsuPx * FOLLOW_CIRCLE_HITBOX_CS_RATIO) || this.autohit;

						if (!hit) {
							slider.releaseFollowCircle(playEvent.time);
						}
					}

					if (!this.autohit) break;

					let hitObject = drawable as DrawableHeadedHitObject;
					hitObject.hitHead(playEvent.time);
				}; break;
				case PlayEventType.SliderEndCheck: { // Checking if the player hit the slider end happens slightly before the end of the slider
					let slider = drawable as DrawableSlider;

					let distance = pointDistance(osuMouseCoordinates, playEvent.position);
					let hit = (buttonPressed && distance <= this.circleRadiusOsuPx * FOLLOW_CIRCLE_HITBOX_CS_RATIO) || this.autohit;

					if (hit) {
						slider.scoring.end = true;
					} else {
						slider.scoring.end = false;
						slider.releaseFollowCircle(playEvent.time);
					}

					if (slider.scoring.head.hit === ScoringValue.NotHit) {
						// If the slider ended before the player managed to click its head, the head is automatically "missed".
						slider.hitHead(playEvent.time, 0);
					}
				}; break;
				case PlayEventType.SliderEnd: {
					let slider = drawable as DrawableSlider;

					slider.stopSliderSlideSound();

					// If the slider end was hit, score it now.
					let hit = slider.scoring.end === true;
					if (hit) {
						this.scoreCounter.add(30, true, true, false, slider, playEvent.time);
						
						// The hit sound is played in the .score method. (at least when this comment was writtem)
					}

					let primitive = last(slider.sliderEnds);
					// The if here ie because there is not always a slider end primitive (like for invisible sliders)
					if (primitive) HitCirclePrimitive.fadeOutBasedOnHitState(primitive, playEvent.time, hit);

					// Score the slider, no matter if the end was hit or not (obviously) 
					slider.score(playEvent.time);
				}; break;
				case PlayEventType.SliderRepeat: {
					let slider = drawable as DrawableSlider;

					let hit: boolean = null;
					if (slider.scoring.end !== null) {
						// If the slider end has already been checked, 'hit' takes on the success state of the slider end scoring.
						hit = slider.scoring.end;
					} else {
						let distance = pointDistance(osuMouseCoordinates, playEvent.position);
						hit = (buttonPressed && distance <= this.circleRadiusOsuPx * FOLLOW_CIRCLE_HITBOX_CS_RATIO) || this.autohit;
					}

					if (hit) {
						slider.scoring.repeats++;
						this.scoreCounter.add(30, true, true, false, slider, playEvent.time);
						slider.pulseFollowCircle(playEvent.time);
						
						let hitSound = slider.hitSounds[playEvent.index + 1];
						this.playHitSound(hitSound);
					} else {
						this.scoreCounter.add(0, true, true, true, slider, playEvent.time);
						slider.releaseFollowCircle(playEvent.time);
					}

					let primitive = slider.sliderEnds[playEvent.index];
					HitCirclePrimitive.fadeOutBasedOnHitState(primitive, playEvent.time, hit);
				}; break;
				case PlayEventType.SliderTick: {
					let slider = drawable as DrawableSlider;

					let hit: boolean = null;
					if (slider.scoring.end !== null) {
						// If the slider end has already been checked, 'hit' takes on the success state of the slider end scoring.
						hit = slider.scoring.end;
					} else {
						let distance = pointDistance(osuMouseCoordinates, playEvent.position);
						hit = (buttonPressed && distance <= this.circleRadiusOsuPx * FOLLOW_CIRCLE_HITBOX_CS_RATIO) || this.autohit;
					}

					if (hit) {
						slider.scoring.ticks++;
						this.scoreCounter.add(10, true, true, false, slider, playEvent.time);
						slider.pulseFollowCircle(playEvent.time);

						let hitSound = slider.tickSounds[playEvent.index];
						this.playHitSound(hitSound);
					} else {
						this.scoreCounter.add(0, true, true, true, slider, playEvent.time);
						slider.releaseFollowCircle(playEvent.time);
					}
				}; break;
				case PlayEventType.SpinnerEnd: {
					let spinner = drawable as DrawableSpinner;

					spinner.score();
				}; break;
			}
		}

		for (let i = 0; i < this.currentSustainedEvents.length; i++) {
			let playEvent = this.currentSustainedEvents[i];
			if (currentTime >= playEvent.endTime) {
				this.currentSustainedEvents.splice(i--, 1);
				continue;
			}
			
			let drawable = this.drawableBeatmap.processedToDrawable.get(playEvent.hitObject);

			switch (playEvent.type) {
				case PlayEventType.SliderSlide: {
					let slider = drawable as DrawableSlider;
					let currentPosition = slider.drawablePath.getPosFromPercentage(MathUtil.mirror(slider.calculateCompletionAtTime(currentTime)));
					let pan = calculatePanFromOsuCoordinates(currentPosition);

					// Update the pan on the slider slide emitters
					for (let i = 0; i < slider.slideEmitters.length; i++) {
						let emitter = slider.slideEmitters[i];
						emitter.setPan(pan);
					}
					
					let distanceToCursor = pointDistance(osuMouseCoordinates, currentPosition);
					if ((buttonPressed && distanceToCursor <= this.circleRadiusOsuPx * FOLLOW_CIRCLE_HITBOX_CS_RATIO) || this.autohit) {
						slider.holdFollowCircle(currentTime);
					}
				}; break;
				case PlayEventType.SpinnerSpin: {
					let spinner = drawable as DrawableSpinner;
					spinner.tick(currentTime, dt);

					// Spin counter-clockwise as fast as possible. Clockwise just looks shit.
					if (this.autohit || this.activeMods.has(Mod.SpunOut)) spinner.spin(-1e9, currentTime, 1);
				}; break;
			}
		}

		// Check if the map has been completed
		if (this.currentPlayEvent >= this.playEvents.length) {
			this.controller.completePlay();
		}
	}

	complete() {
		if (this.completed) return;
		this.completed = true;
	}

	pause() {
		if (this.paused) return;

		this.paused = true;
		this.playing = false;

		globalState.gameplayMediaPlayer.pause();
		this.stopHitObjectSounds();
		if (this.hasVideo) globalState.backgroundManager.pauseVideo();
	}

	private stopHitObjectSounds() {
		for (let hitObject of this.onscreenHitObjects) {
			if (hitObject instanceof DrawableSlider) {
				hitObject.stopSliderSlideSound();
			} else if (hitObject instanceof DrawableSpinner) {
				hitObject.stopSpinningSound();
			}
		}
	}

	unpause() {
		if (!this.paused) return;
		
		this.paused = false;
		this.playing = true;

		let currentTime = this.getCurrentSongTime();

		for (let hitObject of this.onscreenHitObjects) {
			if (hitObject instanceof DrawableSlider) {
				hitObject.beginSliderSlideSound(currentTime);
			}
		}

		globalState.gameplayMediaPlayer.unpause();
	}

	reset() {
		this.drawableBeatmap.reset();
		this.currentHitObjectIndex = 0;

		if (this.onscreenHitObjects) {
			for (let hitObject of this.onscreenHitObjects) {
				hitObject.remove();
			}
		}
		this.onscreenHitObjects = [];

		if (this.onscreenFollowPoints) {
			for (let followPoint of this.onscreenFollowPoints) {
				followPoint.remove();
			}
		}
		this.onscreenFollowPoints = [];

		this.showHitObjectsQueue = [];

		if (this.scorePopups) {
			for (let scorePopup of this.scorePopups) {
				scorePopup.remove();
			}
		}
		this.scorePopups = [];

		this.currentHealth = 1.0;
		this.lastTickTime = null;
		this.currentPlayEvent = 0;
		this.currentSustainedEvents = [];
		this.currentFollowPointIndex = 0;
		this.currentBreakIndex = 0;
		this.paused = false;
		this.playing = false;
		this.completed = false;

		if (this.activeMods.has(Mod.Auto)) {
			this.currentPlaythroughInstruction = 0;
		}

		this.scoreCounter.reset();
	}

	async restart() {
		this.reset();
		await this.start();
	}

	// Instance should be discarded after this is called.
	stop() {
		this.playing = false;

		globalState.gameplayMediaPlayer.stop();
		this.stopHitObjectSounds();
		if (this.hasVideo) globalState.backgroundManager.removeVideo();
	}

	handleButtonDown() {
		if (!this.shouldHandleInputRightNow()) return;

		let currentTime = this.getCurrentSongTime();
		let osuMouseCoordinates = this.getOsuMouseCoordinatesFromCurrentMousePosition();

		for (let i = 0; i < this.onscreenHitObjects.length; i++) {
			let hitObject = this.onscreenHitObjects[i];
			let handled = hitObject.handleButtonDown(osuMouseCoordinates, currentTime);

			if (handled) break; // One button press can only affect one hit object.
		}
	}

	handleMouseMove() {
		if (!this.shouldHandleInputRightNow()) return;

		let currentTime = this.getCurrentSongTime();
		let osuMouseCoordinates = this.getOsuMouseCoordinatesFromCurrentMousePosition();

		for (let i = 0; i < this.onscreenHitObjects.length; i++) {
			let hitObject = this.onscreenHitObjects[i];

			if (hitObject instanceof DrawableSpinner && !this.activeMods.has(Mod.SpunOut)) {
				let spinner = hitObject as DrawableSpinner;
				spinner.handleMouseMove(osuMouseCoordinates, currentTime);
			}
		}
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
		return globalState.gameplayMediaPlayer.getCurrentTime() * 1000;
	}

	toScreenCoordinatesX(osuCoordinateX: number, floor = true) {
		let coord = currentWindowDimensions.width*SCREEN_COORDINATES_X_FACTOR + (osuCoordinateX - PLAYFIELD_DIMENSIONS.width/2) * this.hitObjectPixelRatio;

		return floor? (coord | 0) : coord; // "Cast" to int
	}

	toScreenCoordinatesY(osuCoordinateY: number, floor = true) {
		let coord = currentWindowDimensions.height*SCREEN_COORDINATES_Y_FACTOR + (osuCoordinateY - PLAYFIELD_DIMENSIONS.height/2) * this.hitObjectPixelRatio; // The innerHeight factor is the result of eyeballing and comparing to stable osu!

		return floor? (coord | 0) : coord;
	}

	toScreenCoordinates(osuCoordiate: Point, floor = true) {
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

	addScorePopup(popup: ScorePopup) {
		this.scorePopups.push(popup);
		popup.show();
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
		if (currentInstruction.time > currentTime) return;

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
		this.controller.autoCursor.position.set(screenCoordinates.x, screenCoordinates.y);
	}
}