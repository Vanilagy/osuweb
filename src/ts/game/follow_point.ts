import { DrawableHitObject } from "./drawable_hit_object";
import { Point, pointDistance } from "../util/point";
import { gameState } from "./game_state";
import { MathUtil, EaseType } from "../util/math_util";
import { followPointContainer } from "../visuals/rendering";

export const POINT_DISTANCE = 32; // Taken from ppy, this **probably** means how many osu!pixels follow point images are apart.
export const FOLLOW_POINT_DISTANCE_THRESHOLD = POINT_DISTANCE * 3; // The minimum distance, in osu!pixels, that two objects need to be away from each other in order to create a follow point between them. In regular osu! terms, three follow point images.
export const FOLLOW_POINT_DISTANCE_THRESHOLD_SQUARED = FOLLOW_POINT_DISTANCE_THRESHOLD ** 2;
export const PRE_EMPT = 450; // In ms
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
        let { headedHitObjectTextureFactor } = gameState.currentPlay;

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
        let osuTexture = gameState.currentGameplaySkin.textures["followPoint"];

        let width = osuTexture.getWidth() * headedHitObjectTextureFactor;
        let height = osuTexture.getHeight() * headedHitObjectTextureFactor;

        let texture = osuTexture.getDynamic(Math.max(width, height));

        for (let i = 0; i < partCount; i++) {
            let sprite = new PIXI.Sprite(texture);

            sprite.anchor.set(0.5, 0.5);
            sprite.width = width;
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

        let { headedHitObjectTextureFactor, pixelRatio } = gameState.currentPlay;

        let osuTexture = gameState.currentGameplaySkin.textures["followPoint"];
        let frameCount = osuTexture.getAnimationFrameCount();

        for (let i = 0; i < this.parts.length; i++) {
            let part = this.parts[i];

            let x = (i + 1.5) * POINT_DISTANCE; // First point is at 1.5 * POINT_DISTANCE
            part.x = x * pixelRatio;

            let fadeOutBeginning = MathUtil.lerp(this.startTime, this.endTime, x/this.length);
            let fadeInBeginning = fadeOutBeginning - (FOLLOW_POINT_SCREENTIME - FOLLOW_POINT_FADE_OUT_TIME);

            if (frameCount > 0) fadeInBeginning = fadeOutBeginning - 600; // Observed, I guess? Sometimes, I really wonder how ppy's actual code looks like.
            
            let fadeInCompletion = (currentTime - fadeInBeginning) / FOLLOW_POINT_FADE_IN_TIME;
            fadeInCompletion = MathUtil.clamp(fadeInCompletion, 0, 1);
            let easedFadeInCompletion = MathUtil.ease(EaseType.EaseOutQuad, fadeInCompletion);
 
            let fadeOutCompletion = (currentTime - fadeOutBeginning) / FOLLOW_POINT_FADE_OUT_TIME;
            fadeOutCompletion = MathUtil.clamp(fadeOutCompletion, 0, 1);

            if (frameCount === 0) {
                // This animates the follow points in a certain way. Check the default skin for reference.
                part.x -= (1 - easedFadeInCompletion) * POINT_DISTANCE*2 * pixelRatio;
                part.scale.set(1 + (1 - easedFadeInCompletion)*0.75);
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

                let width = osuTexture.getWidth(frame) * headedHitObjectTextureFactor;
                let height = osuTexture.getHeight(frame) * headedHitObjectTextureFactor;

                let texture = osuTexture.getDynamic(Math.max(width, height), frame);
                sprite.texture = texture;
                sprite.width = width;
                sprite.height = height;

                // The overall container's alpha will be that of the LAST part
                part.alpha = 1 - fadeOutCompletion;
            }
        }
    }
}