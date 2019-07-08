import { MathUtil } from "../util/math_util";
import { DrawableHitObject, drawCircle } from "./drawable_hit_object";
import { Circle } from "../datamodel/circle";
import { gameState } from "./game_state";
import { PLAYFIELD_DIMENSIONS, APPROACH_CIRCLE_TEXTURE } from "../util/constants";
import { mainHitObjectContainer, approachCircleContainer } from "../visuals/rendering";

export class DrawableCircle extends DrawableHitObject {
    public sprite: PIXI.Sprite;
    public hitObject: Circle;

    constructor(hitObject: Circle) {
        super(hitObject);
    }

    draw() {
        let circleDiameter = gameState.currentPlay.circleDiameter;

        let canvas = document.createElement('canvas');
        canvas.setAttribute('width', String(circleDiameter));
        canvas.setAttribute('height', String(circleDiameter));
        let ctx = canvas.getContext('2d');
        drawCircle(ctx, 0, 0, this.comboInfo);

        this.sprite = new PIXI.Sprite(PIXI.Texture.from(canvas));
        this.sprite.width = circleDiameter;
        this.sprite.height = circleDiameter;

        this.approachCircle = new PIXI.Sprite(APPROACH_CIRCLE_TEXTURE);
        this.approachCircle.width = circleDiameter;
        this.approachCircle.height = circleDiameter;
    }

    show(currentTime: number) {
        this.container.addChild(this.sprite);
        mainHitObjectContainer.addChildAt(this.container, 0);
        approachCircleContainer.addChild(this.approachCircle);

        this.update(currentTime);
    }

    update(currentTime: number) {
        let { ARMs, pixelRatio, circleDiameter } = gameState.currentPlay;

        let fadeInCompletion = (currentTime - (this.hitObject.time - ARMs)) / ARMs;
        fadeInCompletion = MathUtil.clamp(fadeInCompletion, 0, 1);
        fadeInCompletion = MathUtil.ease('easeOutQuad', fadeInCompletion);

        this.container.alpha = fadeInCompletion;
        this.approachCircle.alpha = fadeInCompletion;

        this.container.x = window.innerWidth / 2 + (this.hitObject.x - PLAYFIELD_DIMENSIONS.width/2) * pixelRatio - circleDiameter / 2;
        this.container.y = window.innerHeight / 2 + (this.hitObject.y - PLAYFIELD_DIMENSIONS.height/2) * pixelRatio - circleDiameter / 2;

        let approachCircleCompletion = MathUtil.clamp((this.hitObject.time - currentTime) / ARMs, 0, 1);
        let approachCircleFactor = 3 * (approachCircleCompletion) + 1;
        let approachCircleDiameter = circleDiameter * approachCircleFactor;
        this.approachCircle.width = this.approachCircle.height = approachCircleDiameter;
        this.approachCircle.x = window.innerWidth / 2 + (this.hitObject.x - PLAYFIELD_DIMENSIONS.width/2) * pixelRatio - approachCircleDiameter / 2;
        this.approachCircle.y = window.innerHeight / 2 + (this.hitObject.y - PLAYFIELD_DIMENSIONS.height/2) * pixelRatio - approachCircleDiameter / 2;
    }

    remove() {
        mainHitObjectContainer.removeChild(this.container);
        approachCircleContainer.removeChild(this.approachCircle);
    }
}