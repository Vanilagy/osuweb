import { ProcessedBeatmap } from "./processed_beatmap";
import { Beatmap } from "../datamodel/beatmap";
import { DrawableCircle } from "./drawable_circle";
import { DrawableSlider } from "./drawable_slider";
import { mainMusicMediaPlayer, normalHitSoundEffect } from "../audio/audio";
import { mainRender, followPointContainer, scorePopupContainer } from "../visuals/rendering";
import { gameState } from "./game_state";
import { DrawableHitObject } from "./drawable_hit_object";
import { PLAYFIELD_DIMENSIONS, HIT_OBJECT_FADE_OUT_TIME } from "../util/constants";
import { readFileAsArrayBuffer, readFileAsDataUrl, readFileAsLocalResourceUrl } from "../util/file_util";
import { loadMainBackgroundImage, setMainBackgroundImageOpacity } from "../visuals/ui";
import { DrawableSpinner } from "./drawable_spinner";
import { pointDistanceSquared, Point, pointDistance } from "../util/point";
import { FOLLOW_POINT_DISTANCE_THRESHOLD_SQUARED, FollowPoint, FOLLOW_POINT_DISTANCE_THRESHOLD } from "./follow_point";
import { PlayEvent, PlayEventType } from "./play_events";
import "./hud";
import "../input/input";
import { ScoreCounter, Score, ScorePopup, ScoringValue } from "./score";
import { currentMousePosition, anyGameButtonIsPressed } from "../input/input";
import { progressIndicator, accuracyMeter } from "./hud";
import { MathUtil, EaseType } from "../util/math_util";
import { last } from "../util/misc_util";

const LOG_RENDER_INFO = true;
const LOG_RENDER_INFO_SAMPLE_SIZE = 60 * 5; // 5 seconds @60Hz
const AUTOHIT = true; // Just hits everything perfectly. This is NOT auto, it doesn't do fancy cursor stuff. Furthermore, having this one does NOT disable manual user input.
const BREAK_FADE_TIME = 1250; // In ms
const BACKGROUND_DIM = 0.8; // To figure out dimmed backgorund image opacity, that's equal to: (1 - BACKGROUND_DIM) * DEFAULT_BACKGROUND_OPACITY
const DEFAULT_BACKGROUND_OPACITY = 0.333;

export class Play {
    public processedBeatmap: ProcessedBeatmap;
    public preludeTime: number;
    public currentHitObjectId: number;
    public onscreenObjects: { [s: string]: DrawableHitObject };
    public followPoints: FollowPoint[];
    public scorePopups: ScorePopup[];
    public pixelRatio: number;
    public circleDiameterOsuPx: number;
    public circleDiameter: number;
    public circleRadiusOsuPx: number;
    public circleRadius: number;
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
        this.scorePopups = [];

        this.pixelRatio = null;
        this.circleDiameter = null;
        this.ARMs = this.processedBeatmap.beatmap.difficulty.getApproachTime();
    }
    
    init() {
        let screenHeight = window.innerHeight * 0.95;
        let screenWidth = screenHeight * (640 / 480);
        this.pixelRatio = screenHeight / 480;

        this.circleDiameterOsuPx = this.processedBeatmap.beatmap.difficulty.getCirclePixelSize();
        this.circleDiameter = Math.round(this.circleDiameterOsuPx * this.pixelRatio);
        this.circleRadiusOsuPx = this.circleDiameterOsuPx / 2;
        this.circleRadius = this.circleDiameter / 2;

        console.time("Beatmap process");
        this.processedBeatmap.init();
        console.timeEnd("Beatmap process");

        console.time("Beatmap draw");
        this.processedBeatmap.draw();
        console.timeEnd("Beatmap draw");

        console.time("Play event generation");
        this.playEvents = this.processedBeatmap.getAllPlayEvents();
        console.timeEnd("Play event generation");

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
        
        let songFile = this.processedBeatmap.beatmap.getAudioFile();
        await mainMusicMediaPlayer.loadBuffer(await readFileAsArrayBuffer(songFile));

        let backgroundImageFile = this.processedBeatmap.beatmap.getBackgroundImageFile();
        if (backgroundImageFile) {
            let url = await readFileAsLocalResourceUrl(backgroundImageFile);
            loadMainBackgroundImage(url);
        }

        this.preludeTime = this.processedBeatmap.getPreludeTime();
        mainMusicMediaPlayer.start(-this.preludeTime / 1000);

        console.timeEnd("Audio load");

        this.render();
        this.gameLoop();
    }

    render() {
        let startTime = performance.now();
        let currentTime = this.getCurrentSongTime();

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
        followPointContainer.removeChildren(); // Families in Syria be like
        for (let i = this.currentFollowPointIndex; i < this.followPoints.length; i++) {
            let followPoint = this.followPoints[i];
            if (currentTime >= followPoint.disappearanceTime) {
                this.currentFollowPointIndex++;
                continue;
            }
            if (currentTime < followPoint.appearanceTime) break;

            followPoint.render(currentTime);
        }

        // Update the score display
        this.scoreCounter.updateDisplay();

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

    gameLoop() {
        let currentTime = this.getCurrentSongTime();
        let osuMouseCoordinates = this.getOsuMouseCoordinatesFromCurrentMousePosition();
        
        for (this.currentPlayEvent; this.currentPlayEvent < this.playEvents.length; this.currentPlayEvent++) {
            let playEvent = this.playEvents[this.currentPlayEvent];
            if (playEvent.time > currentTime) break;

            switch (playEvent.type) {
                case PlayEventType.HeadHitWindowEnd: {
                    let hitObject = playEvent.hitObject;

                    if (hitObject instanceof DrawableCircle) {
                        if (hitObject.scoring.head.hit !== ScoringValue.NotHit) break;

                        hitObject.score(playEvent.time, ScoringValue.Miss);
                    } else if (hitObject instanceof DrawableSlider) {
                        if (hitObject.scoring.head.hit !== ScoringValue.NotHit) break;

                        hitObject.scoring.head.hit = ScoringValue.Miss;
                        hitObject.scoring.head.time = playEvent.time;
                        
                        this.scoreCounter.add(0, true, true, true, hitObject, playEvent.time);
                    }
                }; break;
                case PlayEventType.PerfectHeadHit: {
                    if (!AUTOHIT) break;
 
                    let hitObject = playEvent.hitObject as (DrawableCircle | DrawableSlider);
                    hitObject.hitHead(playEvent.time);
                }; break;
                case PlayEventType.SliderEnd: {
                    let slider = playEvent.hitObject as DrawableSlider;

                    let distance = pointDistance(osuMouseCoordinates, slider.endPoint);
                    if ((anyGameButtonIsPressed() && distance <= this.circleDiameterOsuPx * 2) || AUTOHIT) { // * 2 because this is the "size" of the follow circle
                        slider.scoring.end = true;
                        this.scoreCounter.add(30, true, true, false, slider, playEvent.time);
                        normalHitSoundEffect.start();
                    }

                    if (slider.scoring.head.hit === ScoringValue.NotHit) {
                        // If the slider ended before the player managed to click its head, the head is automatically "missed".
                        slider.scoring.head.hit = ScoringValue.Miss;
                        slider.scoring.head.time = playEvent.time;
                    }

                    // Score the slider, no matter if the end was hit or not (obviously) 
                    slider.score();
                }; break;
                case PlayEventType.SliderRepeat: {
                    let slider = playEvent.hitObject as DrawableSlider;

                    let distance = pointDistance(osuMouseCoordinates, playEvent.position);
                    if ((anyGameButtonIsPressed() && distance <= this.circleDiameterOsuPx * 2) || AUTOHIT) { // * 2 because this is the "size" of the follow circle
                        slider.scoring.repeats++;
                        this.scoreCounter.add(30, true, true, false, slider, playEvent.time);
                        normalHitSoundEffect.start();
                    } else {
                        this.scoreCounter.add(0, true, true, true, slider, playEvent.time);
                    }
                }; break;
                case PlayEventType.SliderTick: {
                    let slider = playEvent.hitObject as DrawableSlider;

                    let distance = pointDistance(osuMouseCoordinates, playEvent.position);
                    if ((anyGameButtonIsPressed() && distance <= this.circleDiameterOsuPx * 2) || AUTOHIT) { // * 2 because this is the "size" of the follow circle
                        slider.scoring.ticks++;
                        this.scoreCounter.add(10, true, true, false, slider, playEvent.time);
                        //normalHitSoundEffect.start(); // TODO: Play tick sound! 
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

        setTimeout(this.gameLoop.bind(this), 0);
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
        return window.innerWidth / 2 + (osuCoordinateX - PLAYFIELD_DIMENSIONS.width/2) * this.pixelRatio;
    }

    toScreenCoordinatesY(osuCoordinateY: number) {
        return window.innerHeight / 2 + (osuCoordinateY - PLAYFIELD_DIMENSIONS.height/2) * this.pixelRatio;
    }

    // Inverse of toScreenCoordinatesX
    toOsuCoordinatesX(screenCoordinateX: number) {
        return (screenCoordinateX - window.innerWidth / 2) / this.pixelRatio + PLAYFIELD_DIMENSIONS.width/2;
    }
    
    // Inverse of toScreenCoordinatesY
    toOsuCoordinatesY(screenCoordinateY: number) {
        return (screenCoordinateY - window.innerHeight / 2) / this.pixelRatio + PLAYFIELD_DIMENSIONS.height/2;
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
}

export function startPlay(beatmap: Beatmap) {
    let newPlay = new Play(beatmap);
    gameState.currentPlay = newPlay;

    newPlay.init();
    newPlay.start();
}