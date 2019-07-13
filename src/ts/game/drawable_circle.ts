import { MathUtil } from "../util/math_util";
import { DrawableHitObject, drawCircle, HitObjectHeadScoring, getDefaultHitObjectHeadScoring, updateHeadElements } from "./drawable_hit_object";
import { Circle } from "../datamodel/circle";
import { gameState } from "./game_state";
import { PLAYFIELD_DIMENSIONS, HIT_OBJECT_FADE_OUT_TIME, CIRCLE_BORDER_WIDTH } from "../util/constants";
import { mainHitObjectContainer, approachCircleContainer } from "../visuals/rendering";
import { colorToHexNumber } from "../util/graphics_util";
import { PlayEvent, PlayEventType } from "./play_events";
import { Point, pointDistanceSquared, pointDistance } from "../util/point";
import { normalHitSoundEffect } from "../audio/audio";
import { ScoringValue } from "./score";
import { assert } from "../util/misc_util";

interface CircleScoring {
    head: HitObjectHeadScoring
}

function getDefaultCircleScoring(): CircleScoring {
    return {
        head: getDefaultHitObjectHeadScoring()
    };
}

export class DrawableCircle extends DrawableHitObject {
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

    draw() {
        let circleDiameter = gameState.currentPlay.circleDiameter;

        let canvas = document.createElement('canvas');
        canvas.setAttribute('width', String(circleDiameter));
        canvas.setAttribute('height', String(circleDiameter));
        let ctx = canvas.getContext('2d');
        drawCircle(ctx, 0, 0, this.comboInfo);

        this.headSprite = new PIXI.Sprite(PIXI.Texture.from(canvas));
        this.headSprite.pivot.x = this.headSprite.width / 2;
        this.headSprite.pivot.y = this.headSprite.height / 2;
        this.headSprite.width = circleDiameter;
        this.headSprite.height = circleDiameter;

        let approachCircle = new PIXI.Graphics();
        let actualApproachCircleWidth = CIRCLE_BORDER_WIDTH * circleDiameter / 2; // Should be as wide as circle border once it hits it
        approachCircle.lineStyle(actualApproachCircleWidth, colorToHexNumber(this.comboInfo.color));
        approachCircle.drawCircle(0, 0, (circleDiameter - actualApproachCircleWidth) / 2); 
        this.approachCircle = approachCircle;

        this.container.addChild(this.headSprite);
    }

    show(currentTime: number) {
        mainHitObjectContainer.addChildAt(this.container, 0);
        approachCircleContainer.addChild(this.approachCircle);

        this.position();
        this.update(currentTime);
    }

    position() {
        this.container.x = gameState.currentPlay.toScreenCoordinatesX(this.x);
        this.container.y = gameState.currentPlay.toScreenCoordinatesY(this.y);
        this.approachCircle.x = gameState.currentPlay.toScreenCoordinatesX(this.x);
        this.approachCircle.y = gameState.currentPlay.toScreenCoordinatesY(this.y);
    }

    update(currentTime: number) {
        if (this.scoring.head.time !== null && currentTime >= this.scoring.head.time + HIT_OBJECT_FADE_OUT_TIME) {
            this.renderFinished = true;
            return;
        }

        let { ARMs, circleDiameter } = gameState.currentPlay;

        let { fadeInCompletion } = updateHeadElements(this, currentTime);
        this.container.alpha = fadeInCompletion;
    }

    remove() {
        mainHitObjectContainer.removeChild(this.container);
        approachCircleContainer.removeChild(this.approachCircle);
    }

    score(time: number, judgement: number) {
        let scoreCounter = gameState.currentPlay.scoreCounter;

        this.scoring.head.hit = judgement;
        this.scoring.head.time = time;

        scoreCounter.add(judgement, false, true, true, this, time);
    }

    addPlayEvents(playEventArray: PlayEvent[]) {
        let { processedBeatmap } = gameState.currentPlay;

        playEventArray.push({
            type: PlayEventType.PerfectHeadHit,
            hitObject: this,
            time: this.startTime
        });

        playEventArray.push({
            type: PlayEventType.HeadHitWindowEnd,
            hitObject: this,
            time: this.startTime + processedBeatmap.beatmap.difficulty.getHitDeltaForJudgement(50)
        });
    }

    hitHead(time: number) {
        if (this.scoring.head.hit !== ScoringValue.NotHit) return;

        let { processedBeatmap } = gameState.currentPlay;

        let timeInaccuracy = time - this.startTime;
        let hitDelta = Math.abs(timeInaccuracy);
        let judgement = processedBeatmap.beatmap.difficulty.getJudgementForHitDelta(hitDelta);

        this.score(time, judgement);
        if (judgement !== 0) normalHitSoundEffect.start();
    }

    handleButtonPress(osuMouseCoordinates: Point, currentTime: number) {
        let { circleRadiusOsuPx } = gameState.currentPlay;

        let distance = pointDistance(osuMouseCoordinates, this.startPoint);

        if (distance <= circleRadiusOsuPx) {
            if (this.scoring.head.hit === ScoringValue.NotHit) {
                this.hitHead(currentTime);

                return true;
            }
        }

        return false;
    }
}