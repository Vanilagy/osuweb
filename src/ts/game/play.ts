import { ProcessedBeatmap } from "./processed_beatmap";
import { Beatmap } from "../datamodel/beatmap";
import { DrawableCircle } from "./drawable_circle";
import { DrawableSlider, FOLLOW_CIRCLE_HITBOX_CS_RATIO, SpecialSliderBehavior } from "./drawable_slider";
import { mainRender, followPointContainer, scorePopupContainer, softwareCursor, sliderBodyContainer } from "../visuals/rendering";
import { gameState } from "./game_state";
import { DrawableHitObject } from "./drawable_hit_object";
import { PLAYFIELD_DIMENSIONS, STANDARD_SCREEN_DIMENSIONS, DEFAULT_HIT_OBJECT_FADE_IN_TIME, SCREEN_COORDINATES_X_FACTOR, SCREEN_COORDINATES_Y_FACTOR } from "../util/constants";
import { readFileAsArrayBuffer, readFileAsLocalResourceUrl, readFileAsDataUrl } from "../util/file_util";
import { loadMainBackgroundImage, setMainBackgroundImageOpacity } from "../visuals/ui";
import { DrawableSpinner } from "./drawable_spinner";
import { pointDistanceSquared, Point, pointDistance, lerpPoints } from "../util/point";
import { FOLLOW_POINT_DISTANCE_THRESHOLD_SQUARED, FollowPoint } from "./follow_point";
import { PlayEvent, PlayEventType } from "./play_events";
import "./hud";
import "../input/input";
import { ScoreCounter, ScorePopup } from "./score";
import { currentMousePosition, anyGameButtonIsPressed } from "../input/input";
import { progressIndicator, accuracyMeter } from "./hud";
import { MathUtil, EaseType } from "../util/math_util";
import { last } from "../util/misc_util";
import { HeadedDrawableHitObject } from "./headed_drawable_hit_object";
import { baseSkin, joinSkins, IGNORE_BEATMAP_SKIN, IGNORE_BEATMAP_HIT_SOUNDS, calculatePanFromOsuCoordinates } from "./skin";
import { mainMusicMediaPlayer } from "../audio/media_player";
import { HitCirclePrimitiveFadeOutType, HitCirclePrimitive } from "./hit_circle_primitive";
import { ScoringValue } from "./scoring_value";
import { Mod } from "./mods";
import { AutoInstruction, ModHelper, HALF_TIME_PLAYBACK_RATE, DOUBLE_TIME_PLAYBACK_RATE, AutoInstructionType } from "./mod_helper";
import { processJobs, processJob } from "../multithreading/job_system";
import { JobTask, DrawSliderByIndexJob } from "../multithreading/job";

const LOG_RENDER_INFO = true;
const LOG_RENDER_INFO_INTERVAL = 5000; // In ms
const AUTOHIT_OVERRIDE = false; // Just hits everything perfectly, regardless of using AT or not. This is NOT auto, it doesn't do fancy cursor stuff. Furthermore, having this one does NOT disable manual user input.
const MODCODE_OVERRIDE = '';
const BREAK_FADE_TIME = 1250; // In ms
const BACKGROUND_DIM = 0.8; // To figure out dimmed backgorund image opacity, that's equal to: (1 - BACKGROUND_DIM) * DEFAULT_BACKGROUND_OPACITY
const DEFAULT_BACKGROUND_OPACITY = 0.333;
const SPINNER_REFERENCE_SCREEN_HEIGHT = 768;
const STREAM_BEAT_THRESHHOLD = 155; // For ease types in AT instruction

export class Play {
    public processedBeatmap: ProcessedBeatmap;
    public preludeTime: number;
    public currentHitObjectId: number;
    public onscreenObjects: { [s: string]: DrawableHitObject };
    public followPoints: FollowPoint[];
    public onscreenFollowPoints: FollowPoint[];
    public scorePopups: ScorePopup[];
    public pixelRatio: number;
    public spinnerPixelRatio: number;
    public circleDiameterOsuPx: number;
    public circleDiameter: number;
    public circleRadiusOsuPx: number;
    public circleRadius: number;
    public headedHitObjectTextureFactor: number;
    public approachTime: number;

    public frameTimes: number[] = [];
    public inbetweenFrameTimes: number[] = [];
    public lastFrameTime: number = null;
    public lastRenderInfoLogTime: number = null;

    public playEvents: PlayEvent[] = [];
    public currentSustainedEvents: PlayEvent[] = [];
    public currentPlayEvent: number = 0;
    public scoreCounter: ScoreCounter;
    public activeMods: Set<Mod>;
    private currentFollowPointIndex = 0; // is this dirty? idk
    private currentBreakIndex = 0;

    // AT stuffz:
    private playthroughInstructions: AutoInstruction[];
    private currentPlaythroughInstruction: number;
    private autohit: boolean;

    constructor(beatmap: Beatmap) {
        this.processedBeatmap = new ProcessedBeatmap(beatmap);
        this.scoreCounter = new ScoreCounter(this.processedBeatmap);

        this.preludeTime = 0;
        this.currentHitObjectId = 0;
        this.onscreenObjects = {};
        this.followPoints = [];
        this.onscreenFollowPoints = [];
        this.scorePopups = [];
        this.activeMods = new Set();

        this.pixelRatio = null;
        this.circleDiameter = null;
    }
    
    async init() {
        let screenHeight = window.innerHeight * 1; // The factor was determined through experimentation. Makes sense it's 1.
        let screenWidth = screenHeight * (STANDARD_SCREEN_DIMENSIONS.width / STANDARD_SCREEN_DIMENSIONS.height);
        this.pixelRatio = screenHeight / STANDARD_SCREEN_DIMENSIONS.height;
        this.spinnerPixelRatio = screenHeight / SPINNER_REFERENCE_SCREEN_HEIGHT;

        if (IGNORE_BEATMAP_SKIN && IGNORE_BEATMAP_HIT_SOUNDS) {
            gameState.currentGameplaySkin = baseSkin;
        } else {
            let beatmapSkin = await this.processedBeatmap.beatmap.beatmapSet.getBeatmapSkin();
            gameState.currentGameplaySkin = joinSkins([baseSkin, beatmapSkin], !IGNORE_BEATMAP_SKIN, !IGNORE_BEATMAP_HIT_SOUNDS);
        }

        this.activeMods = ModHelper.getModsFromModCode(MODCODE_OVERRIDE || prompt("Enter mod code:"));

        if (this.activeMods.has(Mod.Easy)) ModHelper.applyEz(this.processedBeatmap);
        if (this.activeMods.has(Mod.HardRock)) ModHelper.applyHrFirstPass(this.processedBeatmap);

        this.approachTime = this.processedBeatmap.difficulty.getApproachTime();
        this.circleDiameterOsuPx = this.processedBeatmap.difficulty.getCirclePixelSize();
        this.circleDiameter = Math.round(this.circleDiameterOsuPx * this.pixelRatio);
        this.circleRadiusOsuPx = this.circleDiameterOsuPx / 2;
        this.circleRadius = this.circleDiameter / 2;
        this.headedHitObjectTextureFactor = this.circleDiameter / 128;

        console.time("Beatmap process");
        this.processedBeatmap.init();
        console.timeEnd("Beatmap process");

        if (this.activeMods.has(Mod.HardRock)) ModHelper.applyHrSecondPass(this.processedBeatmap);

        console.time('Stack shift');
        this.processedBeatmap.applyStackShift(false);
        console.timeEnd('Stack shift');

        console.time("Beatmap draw");
        this.processedBeatmap.draw();
        console.timeEnd("Beatmap draw");

        console.time("Play event generation");
        this.playEvents = this.processedBeatmap.getAllPlayEvents();
        console.timeEnd("Play event generation");

        this.scoreCounter.init();

        this.generateFollowPoints();

        accuracyMeter.init();

        this.autohit = AUTOHIT_OVERRIDE;
        if (this.activeMods.has(Mod.Auto)) {
            this.playthroughInstructions = ModHelper.generateAutoPlaythroughInstructions(this);
            this.currentPlaythroughInstruction = 0;
            this.autohit = true;
        }
    }

    private generateFollowPoints() {
        for (let i = 1; i < this.processedBeatmap.hitObjects.length; i++) {
            let objA = this.processedBeatmap.hitObjects[i - 1];
            let objB = this.processedBeatmap.hitObjects[i];

            // No follow points to spinners!
            if (objA instanceof DrawableSpinner || objB instanceof DrawableSpinner) continue;

            if (objA.comboInfo.comboNum === objB.comboInfo.comboNum && objA.comboInfo.n !== objB.comboInfo.n) {
                let distSquared = pointDistanceSquared(objA.endPoint, objB.startPoint);

                if (distSquared < FOLLOW_POINT_DISTANCE_THRESHOLD_SQUARED) continue;
                this.followPoints.push(new FollowPoint(objA, objB));
            }
        }
    }

    async start() {
        console.time("Audio load");
        
        let songFile = await this.processedBeatmap.beatmap.getAudioFile();
        let url = await songFile.readAsResourceUrl();
        await mainMusicMediaPlayer.loadUrl(url);

        let backgroundImageFile = await this.processedBeatmap.beatmap.getBackgroundImageFile();
        if (backgroundImageFile) {
            let url = await backgroundImageFile.readAsResourceUrl();
            loadMainBackgroundImage(url);
        }

        // TODO: Apply pitch changes and percussion
        if (this.activeMods.has(Mod.HalfTime) || this.activeMods.has(Mod.Daycore)) mainMusicMediaPlayer.setPlaybackRate(HALF_TIME_PLAYBACK_RATE);
        if (this.activeMods.has(Mod.DoubleTime) || this.activeMods.has(Mod.Nightcore)) mainMusicMediaPlayer.setPlaybackRate(DOUBLE_TIME_PLAYBACK_RATE);

        this.preludeTime = this.processedBeatmap.getPreludeTime();
        mainMusicMediaPlayer.start(0 || -this.preludeTime / 1000);

        console.timeEnd("Audio load");

        if (this.activeMods.has(Mod.Auto)) softwareCursor.visible = true;

        this.render();
        setInterval(this.tick.bind(this), 0);
    }

    render() {
        let startTime = performance.now();
        let currentTime = this.getCurrentSongTime();

        // Run a game tick right before rendering
        this.tick(currentTime);

        // Update hit objects on screen, or remove them if necessary
        for (let id in this.onscreenObjects) {
            let hitObject = this.onscreenObjects[id];

            hitObject.update(currentTime);

            // TEMP! DIRTY! REMOVE THIS! TODO!
            if (hitObject instanceof DrawableSpinner) {
                let spinner = hitObject as DrawableSpinner;
                
                // Spin counter-clockwise as fast as possible. Clockwise just looks shit.
                if (this.autohit || this.activeMods.has(Mod.SpunOut)) spinner.spin(-1e9, currentTime);
            }

            if (hitObject.renderFinished) {
                // Hit object can now safely be removed from the screen

                hitObject.remove();
                delete this.onscreenObjects[id];

                continue;
            }
        }

        // Add new hit objects to screen
        for (this.currentHitObjectId; this.currentHitObjectId < this.processedBeatmap.hitObjects.length; this.currentHitObjectId++) {
            let hitObject = this.processedBeatmap.hitObjects[this.currentHitObjectId];
            if (currentTime < hitObject.renderStartTime) break;

            this.onscreenObjects[this.currentHitObjectId] = hitObject;
            hitObject.show(currentTime);
        }

        // Render follow points
        //followPointContainer.removeChildren(); // Families in Syria be like
        for (let i = this.currentFollowPointIndex; i < this.followPoints.length; i++) {
            let followPoint = this.followPoints[i];
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

        // Update the score display
        this.scoreCounter.updateDisplay(currentTime);

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

                progressIndicator.draw(completion, true);
            } else {
                let completion = (currentTime - start) / (end - start);
                completion = MathUtil.clamp(completion, 0, 1);

                progressIndicator.draw(completion, false); 
            }
        }
        
        // Update the accuracy meter
        accuracyMeter.update(currentTime);

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

        // Handle breaks
        while (this.currentBreakIndex < this.processedBeatmap.breaks.length) {
            // Can't call this variable "break" because reserved keyword, retarded.
            let breakEvent = this.processedBeatmap.breaks[this.currentBreakIndex];
            if (currentTime >= breakEvent.endTime) {
                this.currentBreakIndex++;
                continue;
            }

            /** How much "break-iness" we have. Idk how to name this. 0 means not in the break, 1 means completely in the break, and anything between means *technically in the break*, but we're currently fading shit in. Or out. */
            let x = 0;

            // Comment this.
            // Nah so basically, this takes care of the edge case that a break is shorter than BREAK_FADE_TIME*2. Since we don't want the animation to "jump", we tell it to start the fade in the very middle of the break, rather than at endTime - BREAK_FADE_TIME. This might cause x to go, like, 0.0 -> 0.6 -> 0.0, instead of the usual 0.0 -> 1.0 -> 0.0.
            let breakFadeOutStart = Math.max(breakEvent.endTime - BREAK_FADE_TIME, (breakEvent.startTime + breakEvent.endTime)/2);

            if (currentTime >= breakEvent.startTime) {
                // If we arrive here, we should current be in a break (if I'm not mistaken)

                if (currentTime >= breakFadeOutStart) {
                    let completion = (currentTime - (breakEvent.endTime - BREAK_FADE_TIME)) / BREAK_FADE_TIME;
                    completion = MathUtil.clamp(completion, 0, 1);
                    x = 1 - completion;
                } else if (currentTime >= breakEvent.startTime) {
                    let completion = (currentTime - breakEvent.startTime) / BREAK_FADE_TIME;
                    completion = MathUtil.clamp(completion, 0, 1);
                    x = completion;
                }
            }

            x = MathUtil.ease(EaseType.EaseInOutQuad, x);

            // Go from 1.0 opacity to (1 - background dim) opacity
            setMainBackgroundImageOpacity(x * DEFAULT_BACKGROUND_OPACITY + (1 - x)*((1 - BACKGROUND_DIM) * DEFAULT_BACKGROUND_OPACITY));

            break;
        }

        // Update the cursor position if rocking AT
        if (this.activeMods.has(Mod.Auto)) this.handlePlaythroughInstructions(currentTime);

        // Let PIXI draw it all to the canvas
        mainRender();

        requestAnimationFrame(this.render.bind(this));

        if (!LOG_RENDER_INFO) return;

        // Frame time logger:
        let now = performance.now();
        let elapsedTime = now - startTime;
        this.frameTimes.push(elapsedTime);
        if (this.lastFrameTime !== null) {
            this.inbetweenFrameTimes.push(now - this.lastFrameTime);
        }
        this.lastFrameTime = now;

        if ((now - this.lastRenderInfoLogTime) >= LOG_RENDER_INFO_INTERVAL && this.frameTimes.length > 0 && this.inbetweenFrameTimes.length > 0) {
            let data1 = MathUtil.getAggregateValuesFromArray(this.frameTimes),
                data2 = MathUtil.getAggregateValuesFromArray(this.inbetweenFrameTimes);
                
            console.log("---");
            console.log(`Frame time info: Average: ${data1.avg.toFixed(3)}ms, Shortest: ${data1.min.toFixed(3)}ms, Longest: ${data1.max.toFixed(3)}ms`);
            console.log(`Frame period info: Average: ${data2.avg.toFixed(3)}ms, Shortest: ${data2.min.toFixed(3)}ms, Longest: ${data2.max.toFixed(3)}ms`);

            this.frameTimes.length = 0;
            this.inbetweenFrameTimes.length = 0;
            this.lastRenderInfoLogTime = now;
        }

        if (this.lastRenderInfoLogTime === null) this.lastRenderInfoLogTime = now;
    }

    tick(currentTimeOverride?: number) {
        let currentTime = (currentTimeOverride !== undefined)? currentTimeOverride : this.getCurrentSongTime();
        let osuMouseCoordinates = this.getOsuMouseCoordinatesFromCurrentMousePosition();
        let buttonPressed = anyGameButtonIsPressed();
        
        for (this.currentPlayEvent; this.currentPlayEvent < this.playEvents.length; this.currentPlayEvent++) {
            let playEvent = this.playEvents[this.currentPlayEvent];
            if (playEvent.time > currentTime) break;

            if (playEvent.endTime !== undefined) {
                this.currentSustainedEvents.push(playEvent);
                continue;
            }

            switch (playEvent.type) {
                case PlayEventType.HeadHitWindowEnd: {
                    let hitObject = playEvent.hitObject as HeadedDrawableHitObject;
                    if (hitObject.scoring.head.hit !== ScoringValue.NotHit) break;

                    hitObject.hitHead(playEvent.time, 0);
                }; break;
                case PlayEventType.PerfectHeadHit: {
                    if (playEvent.hitObject instanceof DrawableSlider) {
                        let slider = playEvent.hitObject;

                        slider.beginSliderSlideSound();

                        let distance = pointDistance(osuMouseCoordinates, playEvent.position);
                        let hit = (buttonPressed && distance <= this.circleRadiusOsuPx * FOLLOW_CIRCLE_HITBOX_CS_RATIO) || this.autohit;

                        if (!hit) {
                            slider.releaseFollowCircle(playEvent.time);
                        }
                    }

                    if (!this.autohit) break;
 
                    let hitObject = playEvent.hitObject as HeadedDrawableHitObject;
                    hitObject.hitHead(playEvent.time);
                }; break;
                case PlayEventType.SliderEndCheck: { // Checking if the player hit the slider end happens slightly before the end of the slider
                    let slider = playEvent.hitObject as DrawableSlider;

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
                    let slider = playEvent.hitObject as DrawableSlider;

                    slider.stopSliderSlideSound();

                    // If the slider end was hit, score it now.
                    let hit = slider.scoring.end === true;
                    if (hit) {
                        this.scoreCounter.add(30, true, true, false, slider, playEvent.time);

                        // gameState.currentGameplaySkin.playHitSound(playEvent.hitSound);
                        // This is commented out because the hit sound should be played in the .score method.
                    }

                    let primitive = slider.sliderEnds[playEvent.i];
                    // The if here ie because there is not always a slider end primitive (like for invisible sliders)
                    if (primitive) HitCirclePrimitive.fadeOutBasedOnHitState(primitive, playEvent.time, hit);

                    // Score the slider, no matter if the end was hit or not (obviously) 
                    slider.score(playEvent.time);
                }; break;
                case PlayEventType.SliderRepeat: {
                    let slider = playEvent.hitObject as DrawableSlider;

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

                        gameState.currentGameplaySkin.playHitSound(playEvent.hitSound);
                    } else {
                        this.scoreCounter.add(0, true, true, true, slider, playEvent.time);
                        slider.releaseFollowCircle(playEvent.time);
                    }

                    let primitive = slider.sliderEnds[playEvent.i];
                    HitCirclePrimitive.fadeOutBasedOnHitState(primitive, playEvent.time, hit);
                }; break;
                case PlayEventType.SliderTick: {
                    let slider = playEvent.hitObject as DrawableSlider;

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

                        gameState.currentGameplaySkin.playHitSound(playEvent.hitSound);
                    } else {
                        this.scoreCounter.add(0, true, true, true, slider, playEvent.time);
                        slider.releaseFollowCircle(playEvent.time);
                    }
                }; break;
                case PlayEventType.SpinnerEnd: {
                    let spinner = playEvent.hitObject as DrawableSpinner;

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

            switch (playEvent.type) {
                case PlayEventType.SliderSlide: {
                    let slider = playEvent.hitObject as DrawableSlider;
                    let currentPosition = slider.path.getPosFromPercentage(MathUtil.mirror(slider.calculateCompletionAtTime(currentTime)));
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
            }
        }
    }

    handleButtonDown() {
        if (this.activeMods.has(Mod.Auto)) return;

        let currentTime = this.getCurrentSongTime();
        let osuMouseCoordinates = this.getOsuMouseCoordinatesFromCurrentMousePosition();

        for (let id in this.onscreenObjects) {
            let hitObject = this.onscreenObjects[id];
            let handled = hitObject.handleButtonDown(osuMouseCoordinates, currentTime);

            if (handled) break; // One button press can only affect one hit object.
        }
    }

    handleMouseMove() {
        if (this.activeMods.has(Mod.Auto)) return;

        let currentTime = this.getCurrentSongTime();
        let osuMouseCoordinates = this.getOsuMouseCoordinatesFromCurrentMousePosition();

        for (let id in this.onscreenObjects) {
            let hitObject = this.onscreenObjects[id];

            if (hitObject instanceof DrawableSpinner && !this.activeMods.has(Mod.SpunOut)) {
                let spinner = hitObject as DrawableSpinner;
                spinner.handleMouseMove(osuMouseCoordinates, currentTime);
            }
        }
    }

    getCurrentSongTime() {
        return mainMusicMediaPlayer.getCurrentTime() * 1000;
    }

    toScreenCoordinatesX(osuCoordinateX: number, floor = true) {
        let coord = window.innerWidth*SCREEN_COORDINATES_X_FACTOR + (osuCoordinateX - PLAYFIELD_DIMENSIONS.width/2) * this.pixelRatio;

        return floor? (coord | 0) : coord; // "Cast" to int
    }

    toScreenCoordinatesY(osuCoordinateY: number, floor = true) {
        let coord = window.innerHeight*SCREEN_COORDINATES_Y_FACTOR + (osuCoordinateY - PLAYFIELD_DIMENSIONS.height/2) * this.pixelRatio; // The innerHeight factor is the result of eyeballing and comparing to stable osu!

        return floor? (coord | 0) : coord;
    }

    // Inverse of toScreenCoordinatesX
    toOsuCoordinatesX(screenCoordinateX: number) {
        return (screenCoordinateX - window.innerWidth*0.5) / this.pixelRatio + PLAYFIELD_DIMENSIONS.width/2;
    }
    
    // Inverse of toScreenCoordinatesY
    toOsuCoordinatesY(screenCoordinateY: number) {
        return (screenCoordinateY - window.innerHeight*0.510) / this.pixelRatio + PLAYFIELD_DIMENSIONS.height/2;
    }

    getOsuMouseCoordinatesFromCurrentMousePosition(): Point {
        return {
            x: this.toOsuCoordinatesX(currentMousePosition.x),
            y: this.toOsuCoordinatesY(currentMousePosition.y)
        };
    }

    addScorePopup(popup: ScorePopup) {
        this.scorePopups.push(popup);
        scorePopupContainer.addChild(popup.container);
    }

    /** Headed hit objects can only be hit when the previous one has already been assigned a judgement. If it has not, the hit object remains 'locked' and doesn't allow input, also known as note locking. */
    hitObjectIsInputLocked(hitObject: HeadedDrawableHitObject) {
        let objectBefore = this.processedBeatmap.hitObjects[hitObject.index - 1];
        if (!objectBefore || !(objectBefore instanceof HeadedDrawableHitObject)) return false;

        return objectBefore.scoring.head.hit === ScoringValue.NotHit;
    }

    /** Handles playthrough instructions for AT. */
    handlePlaythroughInstructions(currentTime: number) {
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
            let slider = currentInstruction.hitObject as DrawableSlider;

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

        softwareCursor.x = this.toScreenCoordinatesX(cursorPlayfieldPos.x, false);
        softwareCursor.y = this.toScreenCoordinatesY(cursorPlayfieldPos.y, false);
    }
}

export async function startPlay(beatmap: Beatmap) {
    let newPlay = new Play(beatmap);
    gameState.currentPlay = newPlay;

    await newPlay.init();
    await newPlay.start();
}