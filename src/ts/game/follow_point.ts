import { DrawableHitObject } from "./drawable_hit_object";
import { Point, pointDistance } from "../util/point";
import { gameState } from "./game_state";
import { MathUtil, EaseType } from "../util/math_util";
import { followPointContainer } from "../visuals/rendering";
import { currentSkin } from "./skin";

export const POINT_DISTANCE = 32; // Taken from ppy, this **probably** means how many osu!pixels follow point images are apart.
export const FOLLOW_POINT_DISTANCE_THRESHOLD = POINT_DISTANCE * 3; // The minimum distance, in osu!pixels, that two objects need to be away from each other in order to create a follow point between them. In regular osu! terms, three follow point images.
export const FOLLOW_POINT_DISTANCE_THRESHOLD_SQUARED = FOLLOW_POINT_DISTANCE_THRESHOLD ** 2;
export const PRE_EMPT = 450; // In ms
const FOLLOW_POINT_CS_RATIO = 22/118;
const FOLLOW_POINT_SCREENTIME = 1200;
const FOLLOW_POINT_FADE_IN_TIME = 400;
const FOLLOW_POINT_FADE_OUT_TIME = 400;

export class FollowPoint {
    public container: PIXI.Container;
    private hitObjectA: DrawableHitObject;
    private hitObjectB: DrawableHitObject;
    private startTime: number;
    private endTime: number;
    private startPoint: Point;
    private endPoint: Point;
    private length: number;
    private parts: PIXI.Container[];
    public renderStartTime: number;
    public renderFinished: boolean = false;

    constructor(hitObjectA: DrawableHitObject, hitObjectB: DrawableHitObject) {
        let { circleDiameter } = gameState.currentPlay;

        this.hitObjectA = hitObjectA;
        this.hitObjectB = hitObjectB;

        this.startTime = hitObjectA.endTime; // Should this really be called "start time"??
        this.endTime = hitObjectB.startTime;
        this.startPoint = this.hitObjectA.endPoint;
        this.endPoint = this.hitObjectB.startPoint;

        this.renderStartTime = this.startTime - (FOLLOW_POINT_SCREENTIME - FOLLOW_POINT_FADE_OUT_TIME);

        this.length = pointDistance(this.startPoint, this.endPoint);
        let angle = Math.atan2(this.endPoint.y - this.startPoint.y, this.endPoint.x - this.startPoint.x);

        this.parts = [];
        this.container = new PIXI.Container();
        this.container.rotation = angle;

        let partCount = Math.floor((this.length - POINT_DISTANCE * 1.52) / POINT_DISTANCE); // This 1.52 was just found to be right through testing. Past-David did his job here, trust him.
        let osuTexture = currentSkin.textures["followPoint"];
        let texture = osuTexture.getBest();

        for (let i = 0; i < partCount; i++) {
            let sprite = new PIXI.Sprite(texture);
            sprite.anchor.set(0.5, 0.5);

            let height = circleDiameter * FOLLOW_POINT_CS_RATIO * (osuTexture.getHeight() / 22);
            sprite.width = texture.width/texture.height * height;
            sprite.height = height;

            let wrapper = new PIXI.Container();
            wrapper.addChild(sprite);

            this.container.addChild(wrapper);
            this.parts.push(wrapper);
        }
    }

    show() {
        followPointContainer.addChild(this.container);
        
        this.position();
    }

    position() {
        this.container.x = gameState.currentPlay.toScreenCoordinatesX(this.startPoint.x);
        this.container.y = gameState.currentPlay.toScreenCoordinatesY(this.startPoint.y);
    }

    remove() {
        followPointContainer.removeChild(this.container);
    }

    update(currentTime: number) {
        if (currentTime >= this.endTime + FOLLOW_POINT_FADE_OUT_TIME) {
            this.renderFinished = true;
            return;
        }

        let { circleDiameter, pixelRatio } = gameState.currentPlay;

        let osuTexture = currentSkin.textures["followPoint"];
        let frameCount = osuTexture.getAnimationFrameCount();

        for (let i = 0; i < this.parts.length; i++) {
            let part = this.parts[i];

            let x = (i + 1.5) * POINT_DISTANCE; // First point is at 1.5 * POINT_DISTANCE
            part.x = x * pixelRatio;

            let fadeOutBeginning = MathUtil.lerp(this.startTime, this.endTime, x/this.length);
            let fadeInBeginning = fadeOutBeginning - (FOLLOW_POINT_SCREENTIME - FOLLOW_POINT_FADE_OUT_TIME);
            
            let fadeInCompletion = (currentTime - fadeInBeginning) / FOLLOW_POINT_FADE_IN_TIME;
            fadeInCompletion = MathUtil.clamp(fadeInCompletion, 0, 1);
            let easedFadeInCompletion = MathUtil.ease(EaseType.EaseOutQuad, fadeInCompletion);
 
            let fadeOutCompletion = (currentTime - fadeOutBeginning) / FOLLOW_POINT_FADE_OUT_TIME;
            fadeOutCompletion = MathUtil.clamp(fadeOutCompletion, 0, 1);

            if (frameCount === 1) {
                // This animates the follow points in a certain way. Check the default skin for reference.
                part.x -= (1 - easedFadeInCompletion) * POINT_DISTANCE*2 * pixelRatio;
                part.scale.set(1 + (1 - easedFadeInCompletion)*0.5);
                part.alpha = fadeInCompletion;
                part.alpha -= fadeOutCompletion;
            } else {
                // If the skin has defined custom follow point animations, use those.
                let sprite = part.children[0] as PIXI.Sprite;
                let frame: number;

                if (fadeInCompletion < 1) {
                    frame = Math.floor(fadeInCompletion * (frameCount - 1));
                } else {
                    frame = Math.floor((1 - fadeOutCompletion) * (frameCount - 1));
                }

                let texture = osuTexture.getBest(frame);
                sprite.texture = texture;

                let height = circleDiameter * FOLLOW_POINT_CS_RATIO * (osuTexture.getHeight(frame) / 22);
                sprite.width = texture.width/texture.height * height;
                sprite.height = height;

                // The overall container's alpha will be that of the LAST part
                part.alpha = 1 - fadeOutCompletion;
            }
        }

        /*
        let duration = this.endTime - this.startTime;
        let relTime = currentTime - this.startTime;

        if (duration === 0) return; // Literally no need to draw it

        let renderStart = MathUtil.clamp(relTime / duration, 0, 1);
        let renderEnd = MathUtil.clamp((relTime + PRE_EMPT) / duration, 0, 1);
        let currentPlay = gameState.currentPlay;

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
        line.lineStyle(this.height, 0xFFFFFF, 0.75);
        line.moveTo(currentPlay.toScreenCoordinatesX(p1.x), currentPlay.toScreenCoordinatesY(p1.y));
        line.lineTo(currentPlay.toScreenCoordinatesX(p2.x), currentPlay.toScreenCoordinatesY(p2.y));

        followPointContainer.addChild(line);*/
    }
}