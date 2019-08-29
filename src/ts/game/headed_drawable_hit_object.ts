import { DrawableHitObject } from "./drawable_hit_object";
import { HitObject } from "../datamodel/hit_object";
import { gameState } from "./game_state";
import { mainHitObjectContainer, approachCircleContainer } from "../visuals/rendering";
import { Point, pointDistance } from "../util/point";
import { PlayEvent, PlayEventType } from "./play_events";
import { HitCirclePrimitive } from "./hit_circle_primitive";
import { ScoringValue } from "./scoring_value";

const CLICK_IMMUNITY_THRESHOLD = 350; // This many millisecond before the perfect hit time will the object start to even become clickable. Before that, it should do the little shaky-shake, implying it was clicked WAY too early.

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

    constructor(hitObject: HitObject) {
        super(hitObject);
    }

    applyStackPosition() {
        this.startPoint.x += this.stackHeight * -4;
        this.startPoint.y += this.stackHeight * -4;
        this.endPoint.x += this.stackHeight * -4;
        this.endPoint.y += this.stackHeight * -4;
    }

    draw() {
        
    }

    show(currentTime: number) {
        mainHitObjectContainer.addChildAt(this.container, 0);
        approachCircleContainer.addChild(this.head.approachCircle);

        this.position();
        this.update(currentTime);
    }

    position() {
        this.head.approachCircle.x = gameState.currentPlay.toScreenCoordinatesX(this.startPoint.x);
        this.head.approachCircle.y = gameState.currentPlay.toScreenCoordinatesY(this.startPoint.y);
    }

    remove() {
        mainHitObjectContainer.removeChild(this.container);
        approachCircleContainer.removeChild(this.head.approachCircle);
    }

    abstract hitHead(time: number, judgementOverride?: number): void;
    
    handleButtonPress(osuMouseCoordinates: Point, currentTime: number) {
        let { circleRadiusOsuPx } = gameState.currentPlay;

        let distance = pointDistance(osuMouseCoordinates, this.startPoint);

        if (distance <= circleRadiusOsuPx && this.scoring.head.hit === ScoringValue.NotHit) {
            if (currentTime >= this.startTime - CLICK_IMMUNITY_THRESHOLD && !gameState.currentPlay.hitObjectIsInputLocked(this)) {
                this.hitHead(currentTime);
                return true;
            } else {
                // Display a shaking animation to indicate that the click was way too early or the note is still locked
                this.head.shake(currentTime);
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
            time: this.startTime + processedBeatmap.difficulty.getHitDeltaForJudgement(50)
        });
    }

    updateHeadElements(currentTime: number) {
        this.head.update(currentTime);
    }
}