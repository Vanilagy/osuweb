import { DrawableHitObject } from "./drawable_hit_object";

export enum PlayEventType {
    HeadHit,
    SliderHead,
    SliderTick,
    SliderRepeat,
    SliderEnd
}

export interface PlayEvent {
    type: PlayEventType,
    hitObject: DrawableHitObject,
    time: number
}