import { Circle } from "../datamodel/circle";
import { gameState } from "./game_state";
import { HIT_OBJECT_FADE_OUT_TIME } from "../util/constants";
import { ScoringValue } from "./score";
import { accuracyMeter } from "./hud";
import { HeadedDrawableHitObject, CircleScoring, getDefaultCircleScoring } from "./headed_drawable_hit_object";
import { HitCirclePrimitiveFadeOutType, HitCirclePrimitive, HitCirclePrimitiveType } from "./hit_circle_primitive";
import { currentSkin, HitSoundType, HitSoundInfo } from "./skin";

export class DrawableCircle extends HeadedDrawableHitObject {
    public hitObject: Circle;
    public scoring: CircleScoring;
    public hitSound: HitSoundInfo;

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

    draw() {
        super.draw();

        let { ARMs } = gameState.currentPlay;
    
        this.head = new HitCirclePrimitive({
            fadeInStart: this.startTime - ARMs,
            comboInfo: this.comboInfo,
            hasApproachCircle: true,
            hasNumber: true,
            type: HitCirclePrimitiveType.HitCircle
        });

        this.container.addChild(this.head.container);
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

        this.updateHeadElements(currentTime);
    }

    score(time: number, judgement: number) {
        let scoreCounter = gameState.currentPlay.scoreCounter;

        this.scoring.head.time = time;
        this.scoring.head.hit = judgement;

        if (judgement !== 0) {
            this.head.setFadeOut({
                type: HitCirclePrimitiveFadeOutType.ScaleOut,
                time: time
            });
        } else {
            this.head.setFadeOut({
                type: HitCirclePrimitiveFadeOutType.FadeOut,
                time: time
            });
        }

        scoreCounter.add(judgement, false, true, true, this, time);
    }

    hitHead(time: number) {
        if (this.scoring.head.hit !== ScoringValue.NotHit) return;

        let { processedBeatmap } = gameState.currentPlay;

        let timeInaccuracy = time - this.startTime;
        let hitDelta = Math.abs(timeInaccuracy);
        let judgement = processedBeatmap.beatmap.difficulty.getJudgementForHitDelta(hitDelta);

        this.score(time, judgement);
        if (judgement !== 0) {
            //normalHitSoundEffect.start();
            currentSkin.playHitSound(this.hitSound);
        }

        accuracyMeter.addAccuracyLine(timeInaccuracy, time);
    }
}