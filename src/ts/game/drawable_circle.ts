import { Circle } from "../datamodel/circle";
import { gameState } from "./game_state";
import { HIT_OBJECT_FADE_OUT_TIME, SHOW_APPROACH_CIRCLE_ON_FIRST_HIDDEN_OBJECT } from "../util/constants";
import { accuracyMeter } from "./hud";
import { HeadedDrawableHitObject, CircleScoring, getDefaultCircleScoring } from "./headed_drawable_hit_object";
import { HitCirclePrimitiveFadeOutType, HitCirclePrimitive, HitCirclePrimitiveType } from "./hit_circle_primitive";
import { HitSoundInfo } from "./skin";
import { ScoringValue } from "./scoring_value";
import { Mod } from "./mods";

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

        this.scoring = getDefaultCircleScoring();
    }

    draw() {
        super.draw();

        let { approachTime, activeMods } = gameState.currentPlay;

        this.renderStartTime = this.startTime - gameState.currentPlay.approachTime;
    
        this.head = new HitCirclePrimitive({
            fadeInStart: this.startTime - approachTime,
            comboInfo: this.comboInfo,
            hasApproachCircle: !activeMods.has(Mod.Hidden) || (this.index === 0 && SHOW_APPROACH_CIRCLE_ON_FIRST_HIDDEN_OBJECT),
            hasNumber: true,
            type: HitCirclePrimitiveType.HitCircle
        });

        this.container.addChild(this.head.container);
    }

    position() {
        super.position(); // See DrawableSlider for the joke

        this.container.x = gameState.currentPlay.toScreenCoordinatesX(this.startPoint.x);
        this.container.y = gameState.currentPlay.toScreenCoordinatesY(this.startPoint.y);
    }

    update(currentTime: number) {
        if (this.head.renderFinished) {
            this.renderFinished = true;
            return;
        }

        this.updateHeadElements(currentTime);
    }

    score(time: number, judgement: number) {
        let scoreCounter = gameState.currentPlay.scoreCounter;

        this.scoring.head.time = time;
        this.scoring.head.hit = judgement;

        HitCirclePrimitive.fadeOutBasedOnHitState(this.head, time, judgement !== 0);
        scoreCounter.add(judgement, false, true, true, this, time);
    }

    hitHead(time: number, judgementOverride?: number) {
        if (this.scoring.head.hit !== ScoringValue.NotHit) return;

        let { processedBeatmap } = gameState.currentPlay;

        let timeInaccuracy = time - this.startTime;
        let judgement: number;

        if (judgementOverride !== undefined) {
            judgement = judgementOverride;
        } else {
            let hitDelta = Math.abs(timeInaccuracy);
            judgement = processedBeatmap.difficulty.getJudgementForHitDelta(hitDelta);
        }

        this.score(time, judgement);
        if (judgement !== 0) {
            gameState.currentGameplaySkin.playHitSound(this.hitSound);
            accuracyMeter.addAccuracyLine(timeInaccuracy, time);
        }
    }
}