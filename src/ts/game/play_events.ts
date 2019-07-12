import { DrawableHitObject } from "./drawable_hit_object";
import { Point } from "../util/point";

export enum PlayEventType {
    SliderHead,
    SliderTick,
    SliderRepeat,
    SliderEnd,
    HeadHitWindowEnd,
    PerfectHeadHit
}

export interface PlayEvent {
    type: PlayEventType,
    hitObject: DrawableHitObject,
    time: number,
    position?: Point // Where the event takes place, for example slider ticks.
}