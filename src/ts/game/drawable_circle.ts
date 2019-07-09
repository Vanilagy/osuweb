import { MathUtil } from "../util/math_util";
import { DrawableHitObject, drawCircle } from "./drawable_hit_object";
import { Circle } from "../datamodel/circle";
import { gameState } from "./game_state";
import { PLAYFIELD_DIMENSIONS, APPROACH_CIRCLE_TEXTURE, HIT_OBJECT_FADE_OUT_TIME } from "../util/constants";
import { mainHitObjectContainer, approachCircleContainer } from "../visuals/rendering";

export class DrawableCircle extends DrawableHitObject {
    public hitObject: Circle;

    constructor(hitObject: Circle) {
        super(hitObject);
        
        this.endPoint = {
            x: this.hitObject.x,
            y: this.hitObject.y
        };
        this.endTime = this.hitObject.time;
    }

    draw() {
        let circleDiameter = gameState.currentPlay.circleDiameter;

        let canvas = document.createElement('canvas');
        canvas.setAttribute('width', String(circleDiameter));
        canvas.setAttribute('height', String(circleDiameter));
        let ctx = canvas.getContext('2d');
        drawCircle(ctx, 0, 0, this.comboInfo);

        this.headSprite = new PIXI.Sprite(PIXI.Texture.from(canvas));
        this.headSprite.pivot.x = this.headSprite.width / 2;
        this.headSprite.pivot.y = this.headSprite.height / 2;
        this.headSprite.width = circleDiameter;
        this.headSprite.height = circleDiameter;

        this.approachCircle = new PIXI.Sprite(APPROACH_CIRCLE_TEXTURE);
        this.approachCircle.pivot.x = this.approachCircle.width / 2;
        this.approachCircle.pivot.y = this.approachCircle.height / 2;
        this.approachCircle.width = circleDiameter;
        this.approachCircle.height = circleDiameter;

        this.container.addChild(this.headSprite);
    }

    show(currentTime: number) {
        mainHitObjectContainer.addChildAt(this.container, 0);
        approachCircleContainer.addChild(this.approachCircle);

        this.position();
        this.update(currentTime);
    }

    position() {
        this.container.x = gameState.currentPlay.toScreenCoordinatesX(this.x);
        this.container.y = gameState.currentPlay.toScreenCoordinatesY(this.y);
        this.approachCircle.x = gameState.currentPlay.toScreenCoordinatesX(this.x);
        this.approachCircle.y = gameState.currentPlay.toScreenCoordinatesY(this.y);
    }

    update(currentTime: number) {
        let { ARMs, circleDiameter } = gameState.currentPlay;

        let { fadeInCompletion } = this.updateHeadElements(currentTime);
        this.container.alpha = fadeInCompletion;
    }

    remove() {
        mainHitObjectContainer.removeChild(this.container);
        approachCircleContainer.removeChild(this.approachCircle);
    }
}