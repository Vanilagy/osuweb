import { ProcessedBeatmap } from "./processed_beatmap";
import { Beatmap } from "../datamodel/beatmap";
import { DrawableCircle } from "./drawable_circle";
import { DrawableSlider, FOLLOW_CIRCLE_HITBOX_CS_RATIO } from "./drawable_slider";
import { mainRender, followPointContainer, scorePopupContainer } from "../visuals/rendering";
import { gameState } from "./game_state";
import { DrawableHitObject } from "./drawable_hit_object";
import { PLAYFIELD_DIMENSIONS, STANDARD_SCREEN_DIMENSIONS } from "../util/constants";
import { readFileAsArrayBuffer, readFileAsLocalResourceUrl, readFileAsDataUrl } from "../util/file_util";
import { loadMainBackgroundImage, setMainBackgroundImageOpacity } from "../visuals/ui";
import { DrawableSpinner } from "./drawable_spinner";
import { pointDistanceSquared, Point, pointDistance } from "../util/point";
import { FOLLOW_POINT_DISTANCE_THRESHOLD_SQUARED, FollowPoint } from "./follow_point";
import { PlayEvent, PlayEventType } from "./play_events";
import "./hud";
import "../input/input";
import { ScoreCounter, ScorePopup, ScoringValue } from "./score";
import { currentMousePosition, anyGameButtonIsPressed } from "../input/input";
import { progressIndicator, accuracyMeter } from "./hud";
import { MathUtil, EaseType } from "../util/math_util";
import { last } from "../util/misc_util";
import { HeadedDrawableHitObject } from "./headed_drawable_hit_object";
import { baseSkin, joinSkins, IGNORE_BEATMAP_SKIN, IGNORE_BEATMAP_HIT_SOUNDS } from "./skin";
import { mainMusicMediaPlayer } from "../audio/media_player";
import { HitCirclePrimitiveFadeOutType, HitCirclePrimitive } from "./hit_circle_primitive";

const LOG_RENDER_INFO = true;
const LOG_RENDER_INFO_SAMPLE_SIZE = 60 * 5; // 5 seconds @60Hz
const AUTOHIT = true; // Just hits everything perfectly. This is NOT auto, it doesn't do fancy cursor stuff. Furthermore, having this one does NOT disable manual user input.
const BREAK_FADE_TIME = 1250; // In ms
const BACKGROUND_DIM = 0.8; // To figure out dimmed backgorund image opacity, that's equal to: (1 - BACKGROUND_DIM) * DEFAULT_BACKGROUND_OPACITY
const DEFAULT_BACKGROUND_OPACITY = 0.333;
const SPINNER_REFERENCE_SCREEN_HEIGHT = 768;

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
    public ARMs: number;
    public frameTimes: number[] = [];
    public playEvents: PlayEvent[] = [];
    public currentPlayEvent: number = 0;
    public scoreCounter: ScoreCounter;
    private currentFollowPointIndex = 0; // is this dirty? idk
    private currentBreakIndex = 0;

    constructor(beatmap: Beatmap) {
        this.processedBeatmap = new ProcessedBeatmap(beatmap);
        this.scoreCounter = new ScoreCounter(this.processedBeatmap);

        this.preludeTime = 0;
        this.currentHitObjectId = 0;
        this.onscreenObjects = {};
        this.followPoints = [];
        this.onscreenFollowPoints = [];
        this.scorePopups = [];

        this.pixelRatio = null;
        this.circleDiameter = null;
        this.ARMs = this.processedBeatmap.beatmap.difficulty.getApproachTime();
    }
    
    async init() {
        let screenHeight = window.innerHeight * 1; // The factor was determined through experimentation. Makes sense it's 1.
        let screenWidth = screenHeight * (STANDARD_SCREEN_DIMENSIONS.width / STANDARD_SCREEN_DIMENSIONS.height);
        this.pixelRatio = screenHeight / STANDARD_SCREEN_DIMENSIONS.height;
        this.spinnerPixelRatio = screenHeight / SPINNER_REFERENCE_SCREEN_HEIGHT;

        this.circleDiameterOsuPx = this.processedBeatmap.beatmap.difficulty.getCirclePixelSize();
        this.circleDiameter = Math.round(this.circleDiameterOsuPx * this.pixelRatio);
        this.circleRadiusOsuPx = this.circleDiameterOsuPx / 2;
        this.circleRadius = this.circleDiameter / 2;

        this.headedHitObjectTextureFactor = this.circleDiameter / 128;

        if (IGNORE_BEATMAP_SKIN && IGNORE_BEATMAP_HIT_SOUNDS) {
            gameState.currentGameplaySkin = baseSkin;
        } else {
            let beatmapSkin = await this.processedBeatmap.beatmap.beatmapSet.getBeatmapSkin();
            gameState.currentGameplaySkin = joinSkins([baseSkin, beatmapSkin], !IGNORE_BEATMAP_SKIN, !IGNORE_BEATMAP_HIT_SOUNDS);
        }

        console.time("Beatmap process");
        this.processedBeatmap.init();
        console.timeEnd("Beatmap process");

        console.time("Beatmap draw");
        this.processedBeatmap.draw();
        console.timeEnd("Beatmap draw");

        console.time("Play event generation");
        this.playEvents = this.processedBeatmap.getAllPlayEvents();
        console.timeEnd("Play event generation");

        this.scoreCounter.init();

        this.generateFollowPoints();

        accuracyMeter.init();
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

        this.preludeTime = this.processedBeatmap.getPreludeTime();
        mainMusicMediaPlayer.start(-this.preludeTime / 1000);

        console.timeEnd("Audio load");

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
                if (AUTOHIT) spinner.spin(-1e9, currentTime);
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

        // Let PIXI draw it all to the canvas
        mainRender();

        requestAnimationFrame(this.render.bind(this));

        if (!LOG_RENDER_INFO) return;

        // Frame time logger:
        let elapsedTime = performance.now() - startTime;
        this.frameTimes.push(elapsedTime);

        if (this.frameTimes.length >= LOG_RENDER_INFO_SAMPLE_SIZE) {
            let min = Infinity, max = 0, total = 0;

            for (let time of this.frameTimes) {
                total += time;
                if (time < min) min = time;
                if (time > max) max = time;
            }

            let avg = total / this.frameTimes.length;
            console.log(`Frame time info: Average: ${avg.toFixed(3)}ms, Best: ${min.toFixed(3)}ms, Worst: ${max.toFixed(3)}ms`);

            this.frameTimes.length = 0;
        }
    }

    tick(currentTimeOverride?: number) {
        let currentTime = (currentTimeOverride !== undefined)? currentTimeOverride : this.getCurrentSongTime();
        let osuMouseCoordinates = this.getOsuMouseCoordinatesFromCurrentMousePosition();
        
        for (this.currentPlayEvent; this.currentPlayEvent < this.playEvents.length; this.currentPlayEvent++) {
            let playEvent = this.playEvents[this.currentPlayEvent];
            if (playEvent.time > currentTime) break;

            switch (playEvent.type) {
                case PlayEventType.HeadHitWindowEnd: {
                    let hitObject = playEvent.hitObject as HeadedDrawableHitObject;
                    if (hitObject.scoring.head.hit !== ScoringValue.NotHit) break;

                    hitObject.hitHead(playEvent.time, 0);
                }; break;
                case PlayEventType.PerfectHeadHit: {
                    if (playEvent.hitObject instanceof DrawableSlider) {
                        playEvent.hitObject.beginSliderSlideSound();
                    }

                    if (!AUTOHIT) break;
 
                    let hitObject = playEvent.hitObject as HeadedDrawableHitObject;
                    hitObject.hitHead(playEvent.time);
                }; break;
                case PlayEventType.SliderEndCheck: { // Checking if the player hit the slider end happens slightly before the end of the slider
                    let slider = playEvent.hitObject as DrawableSlider;

                    let distance = pointDistance(osuMouseCoordinates, playEvent.position);
                    if ((anyGameButtonIsPressed() && distance <= this.circleRadiusOsuPx * FOLLOW_CIRCLE_HITBOX_CS_RATIO) || AUTOHIT) {
                        slider.scoring.end = true;
                    } else {
                        slider.scoring.end = false;
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

                        gameState.currentGameplaySkin.playHitSound(playEvent.hitSound);
                    }

                    let primitive = slider.sliderEnds[playEvent.i];
                    HitCirclePrimitive.fadeOutBasedOnHitState(primitive, playEvent.time, hit);

                    // Score the slider, no matter if the end was hit or not (obviously) 
                    slider.score();
                }; break;
                case PlayEventType.SliderRepeat: {
                    let slider = playEvent.hitObject as DrawableSlider;

                    let hit: boolean = null;
                    if (slider.scoring.end !== null) {
                        // If the slider end has already been checked, 'hit' takes on the success state of the slider end scoring.
                        hit = slider.scoring.end;
                    } else {
                        let distance = pointDistance(osuMouseCoordinates, playEvent.position);
                        hit = (anyGameButtonIsPressed() && distance <= this.circleRadiusOsuPx * FOLLOW_CIRCLE_HITBOX_CS_RATIO) || AUTOHIT;
                    }

                    if (hit) {
                        slider.scoring.repeats++;
                        this.scoreCounter.add(30, true, true, false, slider, playEvent.time);

                        gameState.currentGameplaySkin.playHitSound(playEvent.hitSound);
                    } else {
                        this.scoreCounter.add(0, true, true, true, slider, playEvent.time);
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
                        hit = (anyGameButtonIsPressed() && distance <= this.circleRadiusOsuPx * FOLLOW_CIRCLE_HITBOX_CS_RATIO) || AUTOHIT;
                    }

                    if (hit) {
                        slider.scoring.ticks++;
                        this.scoreCounter.add(10, true, true, false, slider, playEvent.time);

                        gameState.currentGameplaySkin.playHitSound(playEvent.hitSound);
                    } else {
                        this.scoreCounter.add(0, true, true, true, slider, playEvent.time);
                    }
                }; break;
                case PlayEventType.SpinnerEnd: {
                    let spinner = playEvent.hitObject as DrawableSpinner;

                    spinner.score();
                }; break;
            }
        }
    }

    handleButtonPress() {
        let currentTime = this.getCurrentSongTime();
        let osuMouseCoordinates = this.getOsuMouseCoordinatesFromCurrentMousePosition();

        for (let id in this.onscreenObjects) {
            let hitObject = this.onscreenObjects[id];
            let handled = hitObject.handleButtonPress(osuMouseCoordinates, currentTime);

            if (handled) break; // One button press can only affect one hit object.
        }
    }

    handleMouseMove() {
        let currentTime = this.getCurrentSongTime();
        let osuMouseCoordinates = this.getOsuMouseCoordinatesFromCurrentMousePosition();

        for (let id in this.onscreenObjects) {
            let hitObject = this.onscreenObjects[id];

            if (hitObject instanceof DrawableSpinner) {
                let spinner = hitObject as DrawableSpinner;
                spinner.handleMouseMove(osuMouseCoordinates, currentTime);
            }
        }
    }

    getCurrentSongTime() {
        return mainMusicMediaPlayer.getCurrentTime() * 1000;
    }

    toScreenCoordinatesX(osuCoordinateX: number) {
        let coord = window.innerWidth*0.5 + (osuCoordinateX - PLAYFIELD_DIMENSIONS.width/2) * this.pixelRatio;

        return coord | 0; // "Cast" to int
    }

    toScreenCoordinatesY(osuCoordinateY: number) {
        let coord = window.innerHeight*0.510 + (osuCoordinateY - PLAYFIELD_DIMENSIONS.height/2) * this.pixelRatio; // The innerHeight factor is the result of eyeballing and comparing to stable osu!

        return coord | 0;
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
        let objectBefore = this.processedBeatmap.hitObjects[hitObject.id - 1];
        if (!objectBefore || !(objectBefore instanceof HeadedDrawableHitObject)) return false;

        return objectBefore.scoring.head.hit === ScoringValue.NotHit;
    }
}

export async function startPlay(beatmap: Beatmap) {
    let newPlay = new Play(beatmap);
    gameState.currentPlay = newPlay;

    await newPlay.init();
    await newPlay.start();
}