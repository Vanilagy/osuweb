import { HitObject } from "../datamodel/hit_object";
import { ComboInfo, CurrentTimingPointInfo } from "./processed_beatmap";
import { Point } from "../util/point";
import { PlayEvent } from "./play_events";

export abstract class DrawableHitObject {
    public index: number = null;
    public comboInfo: ComboInfo;
    public hitObject: HitObject;
    public container: PIXI.Container;

    public startPoint: Point;
    public endPoint: Point;
    public startTime: number;
    public endTime: number;

    /** Specifies the timeframe is which the object is visible and needs to be rendered. */
    public renderStartTime: number;
    /** When true, the hit object has ended its short life as a graphical element and need not be rendered anymore. */
    public renderFinished: boolean = false;

    constructor(hitObject: HitObject, comboInfo: ComboInfo, timingInfo: CurrentTimingPointInfo) {
        this.hitObject = hitObject;
        this.container = new PIXI.Container();

        this.startPoint = { // It is important that we "duplicate" the point here. This decouples the raw hitObject from the drawable.
            x: this.hitObject.x,
            y: this.hitObject.y
        };
        this.startTime = this.hitObject.time;

        this.comboInfo = comboInfo;
    }

    protected abstract initSounds(hitObject: HitObject, timingInfo: CurrentTimingPointInfo): void;

    abstract draw(): void;

    abstract show(currentTime: number): void;

    abstract position(): void;

    abstract update(currentTime: number): void;

    abstract remove(): void;

    abstract addPlayEvents(playEventArray: PlayEvent[]): void;

    /** @returns A boolean, indicating whether or not the object was handled by the button press. It could be false, for example, if the mouse wasn't over it or the object was already hit. */
    abstract handleButtonDown(osuMouseCoordinates: Point, currentTime: number): boolean;
}