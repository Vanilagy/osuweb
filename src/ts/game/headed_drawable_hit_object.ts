import { DrawableHitObject } from "./drawable_hit_object";
import { HitObject } from "../datamodel/hit_object";
import { gameState } from "./game_state";
import { ScoringValue } from "./score";
import { mainHitObjectContainer, approachCircleContainer } from "../visuals/rendering";
import { Point, pointDistance } from "../util/point";
import { PlayEvent, PlayEventType } from "./play_events";
import { HitCirclePrimitive } from "./hit_circle_primitive";

export interface HitObjectHeadScoring {
    hit: ScoringValue,
    time: number
}

export function getDefaultHitObjectHeadScoring(): HitObjectHeadScoring {
    return {
        hit: ScoringValue.NotHit,
        time: null
    };
}

export interface CircleScoring {
    head: HitObjectHeadScoring
}

export function getDefaultCircleScoring(): CircleScoring {
    return {
        head: getDefaultHitObjectHeadScoring()
    };
}

// Keeps track of what the player has successfully hit
export interface SliderScoring {
    head: HitObjectHeadScoring,
    ticks: number,
    repeats: number,
    end: boolean
}

export function getDefaultSliderScoring(): SliderScoring {
    return {
        head: getDefaultHitObjectHeadScoring(),
        ticks: 0,
        repeats: 0,
        end: false
    };
}

export abstract class HeadedDrawableHitObject extends DrawableHitObject {
    public head: HitCirclePrimitive;
    public stackHeight: number = 0;
    public scoring: CircleScoring | SliderScoring;

    constructor(hitObject: HitObject) {
        super(hitObject);
    }

    applyStackPosition() {
        this.x += this.stackHeight * -4;
        this.y += this.stackHeight * -4;
        this.startPoint.x += this.stackHeight * -4;
        this.startPoint.y += this.stackHeight * -4;
        this.endPoint.x += this.stackHeight * -4;
        this.endPoint.y += this.stackHeight * -4;
    }

    draw() {
        
    }

    show(currentTime: number) {
        mainHitObjectContainer.addChildAt(this.container, 0);
        approachCircleContainer.addChildAt(this.head.approachCircle, 0);

        this.position();
        this.update(currentTime);
    }

    position() {
        this.head.approachCircle.x = gameState.currentPlay.toScreenCoordinatesX(this.x);
        this.head.approachCircle.y = gameState.currentPlay.toScreenCoordinatesY(this.y);
    }

    remove() {
        mainHitObjectContainer.removeChild(this.container);
        approachCircleContainer.removeChild(this.head.approachCircle);
    }

    abstract hitHead(time: number): void;
    
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

    updateHeadElements(currentTime: number) {
        this.head.update(currentTime);
    }
}