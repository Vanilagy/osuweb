import { DrawableHitObject } from "./drawable_hit_object";
import { Point } from "../util/point";
import { HitSoundInfo } from "./skin";

export enum PlayEventType {
    SliderHead,
    SliderTick,
    SliderRepeat,
    SliderEnd,
    HeadHitWindowEnd,
    PerfectHeadHit,
    SpinnerEnd
}

export interface PlayEvent {
    type: PlayEventType,
    hitObject: DrawableHitObject,
    time: number,
    position?: Point, // Where the event takes place, for example slider ticks.
    hitSound?: HitSoundInfo // For slider ends
}