import { DrawableHitObject } from "./drawable_hit_object";

export enum PlayEventType {
    HeadHit
}

export interface PlayEvent {
    type: PlayEventType,
    hitObject: DrawableHitObject,
    time: number
}