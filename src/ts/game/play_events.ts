import { DrawableHitObject } from "./drawable_hit_object";
import { Point } from "../util/point";
import { HitSoundInfo } from "./skin";

export enum PlayEventType {
    SliderHead,
    SliderTick,
    SliderRepeat,
    SliderEnd,
    SliderEndCheck, // When user input is checked. Happens a bit earlier than the actual slider end. https://www.reddit.com/r/osugame/comments/9rki8o/how_are_slider_judgements_calculated/
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