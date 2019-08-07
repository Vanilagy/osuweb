import { Circle } from "../datamodel/circle";
import { gameState } from "./game_state";
import { HIT_OBJECT_FADE_OUT_TIME } from "../util/constants";
import { normalHitSoundEffect } from "../audio/audio";
import { ScoringValue } from "./score";
import { accuracyMeter } from "./hud";
import { HeadedDrawableHitObject, CircleScoring, getDefaultCircleScoring } from "./headed_drawable_hit_object";

export class DrawableCircle extends HeadedDrawableHitObject {
    public hitObject: Circle;
    public scoring: CircleScoring;

    constructor(hitObject: Circle) {
        super(hitObject);
    }

    init() {
        this.endTime = this.startTime;
        this.endPoint = {
            x: this.hitObject.x,
            y: this.hitObject.y
        };

        this.renderStartTime = this.startTime - gameState.currentPlay.ARMs;

        this.scoring = getDefaultCircleScoring();
    }

    position() {
        super.position(); // See DrawableSlider for the joke

        this.container.x = gameState.currentPlay.toScreenCoordinatesX(this.x);
        this.container.y = gameState.currentPlay.toScreenCoordinatesY(this.y);
    }

    update(currentTime: number) {
        if (this.scoring.head.time !== null && currentTime >= this.scoring.head.time + HIT_OBJECT_FADE_OUT_TIME) {
            this.renderFinished = true;
            return;
        }

        let { fadeInCompletion } = this.updateHeadElements(currentTime);
        this.container.alpha = fadeInCompletion;
    }

    score(time: number, judgement: number) {
        let scoreCounter = gameState.currentPlay.scoreCounter;

        this.scoring.head.hit = judgement;
        this.scoring.head.time = time;

        scoreCounter.add(judgement, false, true, true, this, time);
    }

    hitHead(time: number) {
        if (this.scoring.head.hit !== ScoringValue.NotHit) return;

        let { processedBeatmap } = gameState.currentPlay;

        let timeInaccuracy = time - this.startTime;
        let hitDelta = Math.abs(timeInaccuracy);
        let judgement = processedBeatmap.beatmap.difficulty.getJudgementForHitDelta(hitDelta);

        this.score(time, judgement);
        if (judgement !== 0) normalHitSoundEffect.start();

        accuracyMeter.addAccuracyLine(timeInaccuracy, time);
    }
}