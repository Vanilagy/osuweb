import { DrawableHitObject } from "./drawable_hit_object";
import { gameState } from "./game_state";
import { mainHitObjectContainer, approachCircleContainer } from "../visuals/rendering";
import { Point, pointDistance } from "../util/point";
import { PlayEvent, PlayEventType } from "./play_events";
import { HitCirclePrimitive } from "./hit_circle_primitive";
import { ScoringValue } from "./scoring_value";

// This many millisecond before the perfect hit time will the object start to even
// become clickable. Before that, it should do the little shaky-shake, implying it
// was clicked WAY too early.
const CLICK_IMMUNITY_THRESHOLD = 350;

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
        end: null
    };
}

export abstract class HeadedDrawableHitObject extends DrawableHitObject {
    public head: HitCirclePrimitive;
    public stackHeight: number = 0;
    public scoring: CircleScoring | SliderScoring;

    abstract applyStackPosition(): void;

    show() {
        mainHitObjectContainer.addChild(this.head.container);
        if (this.head.approachCircle) approachCircleContainer.addChild(this.head.approachCircle);

        this.position();
    }

    position() {
        let screenCoordinates = gameState.currentPlay.toScreenCoordinates(this.startPoint);

        this.head.container.position.set(screenCoordinates.x, screenCoordinates.y);
        if (this.head.approachCircle) this.head.approachCircle.position.set(screenCoordinates.x, screenCoordinates.y);
    }

    remove() {
        mainHitObjectContainer.removeChild(this.head.container);
        approachCircleContainer.removeChild(this.head.approachCircle);
    }

    abstract hitHead(time: number, judgementOverride?: number): void;
    
    handleButtonDown(osuMouseCoordinates: Point, currentTime: number) {
        let { circleRadiusOsuPx } = gameState.currentPlay;

        let distance = pointDistance(osuMouseCoordinates, this.startPoint);

        if (distance <= circleRadiusOsuPx && this.scoring.head.hit === ScoringValue.NotHit) {
            if (currentTime >= this.startTime - CLICK_IMMUNITY_THRESHOLD && !gameState.currentPlay.hitObjectIsInputLocked(this)) {
                this.hitHead(currentTime);
                return true;
            } else {
                // Display a shaking animation to indicate that the click was way too early or the note is still locked
                this.head.shake(currentTime);
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
            time: this.startTime,
            position: this.startPoint
        });

        playEventArray.push({
            type: PlayEventType.HeadHitWindowEnd,
            hitObject: this,
            time: this.startTime + processedBeatmap.difficulty.getHitDeltaForJudgement(50)
        });
    }

    updateHeadElements(currentTime: number) {
        this.head.update(currentTime);
    }
}