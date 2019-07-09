import { MathUtil } from "../util/math_util";
import { DrawableHitObject, drawCircle } from "./drawable_hit_object";
import { Circle } from "../datamodel/circle";
import { gameState } from "./game_state";
import { PLAYFIELD_DIMENSIONS, APPROACH_CIRCLE_TEXTURE, HIT_OBJECT_FADE_OUT_TIME } from "../util/constants";
import { mainHitObjectContainer, approachCircleContainer } from "../visuals/rendering";

export class DrawableCircle extends DrawableHitObject {
    public sprite: PIXI.Sprite;
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

        this.container.pivot.x = circleDiameter / 2;
        this.container.pivot.y = circleDiameter / 2;

        this.sprite = new PIXI.Sprite(PIXI.Texture.from(canvas));
        this.sprite.width = circleDiameter;
        this.sprite.height = circleDiameter;

        this.approachCircle = new PIXI.Sprite(APPROACH_CIRCLE_TEXTURE);
        this.approachCircle.pivot.x = this.approachCircle.width / 2;
        this.approachCircle.pivot.y = this.approachCircle.height / 2;
        this.approachCircle.width = circleDiameter;
        this.approachCircle.height = circleDiameter;

        this.container.addChild(this.sprite);
    }

    show(currentTime: number) {
        mainHitObjectContainer.addChildAt(this.container, 0);
        approachCircleContainer.addChild(this.approachCircle);

        this.update(currentTime);
    }

    update(currentTime: number) {
        let { ARMs, circleDiameter } = gameState.currentPlay;

        this.container.x = gameState.currentPlay.toScreenCoordinatesX(this.x);
        this.container.y = gameState.currentPlay.toScreenCoordinatesY(this.y);

        if (currentTime < this.startTime) {
            let fadeInCompletion = (currentTime - (this.startTime - ARMs)) / ARMs;
            fadeInCompletion = MathUtil.clamp(fadeInCompletion, 0, 1);
            fadeInCompletion = MathUtil.ease('easeOutQuad', fadeInCompletion);

            this.container.alpha = fadeInCompletion;
            this.approachCircle.alpha = fadeInCompletion;
            
            let approachCircleCompletion = MathUtil.clamp((this.hitObject.time - currentTime) / ARMs, 0, 1);
            let approachCircleFactor = 3 * (approachCircleCompletion) + 1;
            let approachCircleDiameter = circleDiameter * approachCircleFactor;
            this.approachCircle.width = approachCircleDiameter;
            this.approachCircle.height = approachCircleDiameter;

            this.approachCircle.x = gameState.currentPlay.toScreenCoordinatesX(this.x);
            this.approachCircle.y = gameState.currentPlay.toScreenCoordinatesY(this.y);
        } else {
            this.approachCircle.visible = false;

            let fadeOutCompletion = (currentTime - (this.startTime)) / HIT_OBJECT_FADE_OUT_TIME;
            fadeOutCompletion = MathUtil.clamp(fadeOutCompletion, 0, 1);
            fadeOutCompletion = MathUtil.ease('easeOutQuad', fadeOutCompletion);

            let alpha = 1 - fadeOutCompletion;
            let scale = 1 + fadeOutCompletion * 0.5; // Max scale: 1.5

            this.container.alpha = alpha;
            this.container.width = circleDiameter * scale;
            this.container.height = circleDiameter * scale;
        }
    }

    remove() {
        mainHitObjectContainer.removeChild(this.container);
        approachCircleContainer.removeChild(this.approachCircle);
    }
}