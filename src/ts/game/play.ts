import { ProcessedBeatmap } from "./processed_beatmap";
import { Beatmap } from "../datamodel/beatmap";
import { DrawableCircle } from "./drawable_circle";
import { DrawableSlider } from "./drawable_slider";
import { mainMusicMediaPlayer, normalHitSoundEffect } from "../audio/audio";
import { mainRender, followPointContainer } from "../visuals/rendering";
import { gameState } from "./game_state";
import { DrawableHitObject } from "./drawable_hit_object";
import { PLAYFIELD_DIMENSIONS, HIT_OBJECT_FADE_OUT_TIME } from "../util/constants";
import { readFileAsArrayBuffer, readFileAsDataUrl, readFileAsLocalResourceUrl } from "../util/file_util";
import { loadMainBackgroundImage } from "../visuals/ui";
import { DrawableSpinner } from "./drawable_spinner";
import { pointDistanceSquared } from "../util/point";
import { FOLLOW_POINT_DISTANCE_THRESHOLD_SQUARED, FollowPoint, FOLLOW_POINT_DISTANCE_THRESHOLD } from "./follow_point";
import { PlayEvent, PlayEventType } from "./play_events";
import "./hud";
import { ScoreCounter, Score } from "./score";

const LOG_RENDER_INFO = true;
const LOG_RENDER_INFO_SAMPLE_SIZE = 60 * 5; // 5 seconds @60Hz

export class Play {
    public processedBeatmap: ProcessedBeatmap;
    public audioStartTime: number;
    public currentHitObjectId: number;
    public onscreenObjects: { [s: string]: DrawableHitObject };
    public followPoints: FollowPoint[];
    public pixelRatio: number;
    public circleDiameterOsuPx: number;
    public circleDiameter: number;
    public ARMs: number;
    public frameTimes: number[] = [];
    public playEvents: PlayEvent[] = [];
    public currentPlayEvent: number = 0;
    public scoreCounter: ScoreCounter;
    
    private currentFollowPointIndex = 0; // is this dirty? idk

    constructor(beatmap: Beatmap) {
        this.processedBeatmap = new ProcessedBeatmap(beatmap);
        this.scoreCounter = new ScoreCounter(this.processedBeatmap);

        this.audioStartTime = null;
        this.currentHitObjectId = 0;
        this.onscreenObjects = {};
        this.followPoints = [];

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

        let interludeTime = this.processedBeatmap.getInterludeTime();
        mainMusicMediaPlayer.start(-interludeTime / 1000);

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

            if (currentTime >= hitObject.renderEndTime) {
                hitObject.remove();
                delete this.onscreenObjects[id];

                continue;
            }
    
            hitObject.update(currentTime);      
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

        // Let PIXI draw it all to the canvas
        mainRender();

        requestAnimationFrame(this.render.bind(this));

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
        
        for (this.currentPlayEvent; this.currentPlayEvent < this.playEvents.length; this.currentPlayEvent++) {
            let playEvent = this.playEvents[this.currentPlayEvent];
            if (playEvent.time > currentTime) break;

            switch (playEvent.type) {
                case PlayEventType.HeadHit: {
                    this.scoreCounter.add(300);

                    normalHitSoundEffect.start();
                }; break;
                case PlayEventType.SliderHead: {
                    let hitObject = playEvent.hitObject as DrawableSlider;

                    this.scoreCounter.add(30, true);
                    hitObject.scoring.head = true;

                    normalHitSoundEffect.start();
                }; break;
                case PlayEventType.SliderTick: {
                    let hitObject = playEvent.hitObject as DrawableSlider;

                    this.scoreCounter.add(10, true);
                    hitObject.scoring.ticks++;
                }; break;
                case PlayEventType.SliderRepeat: {
                    let hitObject = playEvent.hitObject as DrawableSlider;

                    // TODO: How much do they count?
                    this.scoreCounter.add(30, true);
                    hitObject.scoring.repeats++;

                    normalHitSoundEffect.start();
                }; break;
                case PlayEventType.SliderEnd: {
                    let hitObject = playEvent.hitObject as DrawableSlider;

                    this.scoreCounter.add(30, true);
                    hitObject.scoring.end = true;
                    hitObject.score();

                    normalHitSoundEffect.start();
                }; break;
            }
        }

        setTimeout(this.gameLoop.bind(this), 0);
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
}

export function startPlay(beatmap: Beatmap) {
    let newPlay = new Play(beatmap);
    gameState.currentPlay = newPlay;

    newPlay.init();
    newPlay.start();
}