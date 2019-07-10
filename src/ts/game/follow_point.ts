import { DrawableHitObject } from "./drawable_hit_object";
import { Point, pointDistance } from "../util/point";
import { gameState } from "./game_state";
import { MathUtil } from "../util/math_util";
import { followPointContainer } from "../visuals/rendering";

export const POINT_DISTANCE = 32;
export const FOLLOW_POINT_DISTANCE_THRESHOLD = POINT_DISTANCE * 3; // The minimum distance, in osu!pixels, that two objects need to be away from each other in order to create a follow point between them.
export const FOLLOW_POINT_DISTANCE_THRESHOLD_SQUARED = FOLLOW_POINT_DISTANCE_THRESHOLD ** 2;
export const PRE_EMPT = 450;

export class FollowPoint {
    public hitObjectA: DrawableHitObject;
    public hitObjectB: DrawableHitObject;
    public startTime: number;
    public endTime: number;
    public startPoint: Point;
    public endPoint: Point;
    public length: number;
    public height: number;
    public angle: number;
    public appearanceTime: number;
    public disappearanceTime: number;

    constructor(hitObjectA: DrawableHitObject, hitObjectB: DrawableHitObject) {
        this.hitObjectA = hitObjectA;
        this.hitObjectB = hitObjectB;

        this.startTime = hitObjectA.endTime; // Should this really be called "start time"??
        this.endTime = hitObjectB.startTime;
        this.startPoint = this.hitObjectA.endPoint;
        this.endPoint = this.hitObjectB.startPoint;

        this.appearanceTime = this.startTime - PRE_EMPT;
        this.disappearanceTime = this.endTime;

        let { pixelRatio } = gameState.currentPlay;

        this.length = pointDistance(this.startPoint, this.endPoint);
        this.height = 2 * pixelRatio;
        this.angle = Math.atan2(this.endPoint.y - this.startPoint.y, this.endPoint.x - this.startPoint.x);
    }

    render(currentTime: number) {
        let duration = this.endTime - this.startTime;
        let relTime = currentTime - this.startTime;

        if (duration === 0) return; // Literally no need to draw it

        let renderStart = MathUtil.clamp(relTime / duration, 0, 1);
        let renderEnd = MathUtil.clamp((relTime + PRE_EMPT) / duration, 0, 1);

        if (true /* ?!?!??!? */) {
            let currentPlay = gameState.currentPlay;

            let renderStartX = renderStart * this.length;
            let renderEndX = renderEnd * this.length;

            // Lerp
            let p1: Point = {
                x: this.startPoint.x * (1 - renderStart) + this.endPoint.x * renderStart,
                y: this.startPoint.y * (1 - renderStart) + this.endPoint.y * renderStart
            };
            let p2: Point = {
                x: this.startPoint.x * (1 - renderEnd) + this.endPoint.x * renderEnd,
                y: this.startPoint.y * (1 - renderEnd) + this.endPoint.y * renderEnd
            };

            let line = new PIXI.Graphics();
            line.lineStyle(this.height, 0xFFFFFF, 0.8);
            line.moveTo(currentPlay.toScreenCoordinatesX(p1.x), currentPlay.toScreenCoordinatesY(p1.y));
            line.lineTo(currentPlay.toScreenCoordinatesX(p2.x), currentPlay.toScreenCoordinatesY(p2.y));

            followPointContainer.addChild(line);
        }
    }
}