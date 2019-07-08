import { MathUtil } from "../util/math_util";
import { DrawableHitObject, drawCircle } from "./drawable_hit_object";
import { Circle } from "../datamodel/circle";
import { gameState } from "./game_state";
import { PLAYFIELD_DIMENSIONS, APPROACH_CIRCLE_TEXTURE } from "../util/constants";
import { mainHitObjectContainer, approachCircleContainer } from "../visuals/rendering";

export class DrawableCircle extends DrawableHitObject {
    public sprite: any;
    public hitObject: Circle;

    constructor(hitObject: Circle) {
        super(hitObject);
    }

    draw() {
        let canvas = document.createElement('canvas');
        canvas.setAttribute('width', String(gameState.currentPlay!.circleDiameter));
        canvas.setAttribute('height', String(gameState.currentPlay!.circleDiameter));
        let ctx = canvas.getContext('2d');
        drawCircle(ctx!, 0, 0, this.comboInfo);

        this.sprite = new PIXI.Sprite(PIXI.Texture.from(canvas));
        this.sprite.width = gameState.currentPlay!.circleDiameter;
        this.sprite.height = gameState.currentPlay!.circleDiameter;

        this.approachCircle = new PIXI.Sprite(APPROACH_CIRCLE_TEXTURE);
        this.approachCircle.width = gameState.currentPlay!.circleDiameter;
        this.approachCircle.height = gameState.currentPlay!.circleDiameter;
    }

    show(currentTime: number) {
        this.container.addChild(this.sprite);
        mainHitObjectContainer.addChildAt(this.container, 0);
        approachCircleContainer.addChild(this.approachCircle);

        this.update(currentTime);
    }

    update(currentTime: number) {
        let yes = (currentTime - (this.hitObject.time - gameState.currentPlay!.ARMs)) / gameState.currentPlay!.ARMs;
        yes = MathUtil.clamp(yes, 0, 1);
        yes = MathUtil.ease('easeOutQuad', yes);

        //let fadeInCompletion = MathUtil.clamp(1 - ((this.hitObject.time - currentPlay!.ARMs/2) - currentTime) / 300, 0, 1);
        let fadeInCompletion = yes;

        this.container.alpha = fadeInCompletion;
        this.approachCircle.alpha = fadeInCompletion;

        this.container.x = window.innerWidth / 2 + (this.hitObject.x - PLAYFIELD_DIMENSIONS.width/2) * gameState.currentPlay!.pixelRatio! - gameState.currentPlay!.circleDiameter! / 2;
        this.container.y = window.innerHeight / 2 + (this.hitObject.y - PLAYFIELD_DIMENSIONS.height/2) * gameState.currentPlay!.pixelRatio! - gameState.currentPlay!.circleDiameter! / 2;

        let approachCircleCompletion = MathUtil.clamp((this.hitObject.time - currentTime) / gameState.currentPlay!.ARMs, 0, 1);
        let approachCircleFactor = 3 * (approachCircleCompletion) + 1;
        let approachCircleDiameter = gameState.currentPlay!.circleDiameter! * approachCircleFactor;
        this.approachCircle.width = this.approachCircle.height = approachCircleDiameter;
        this.approachCircle.x = window.innerWidth / 2 + (this.hitObject.x - PLAYFIELD_DIMENSIONS.width/2) * gameState.currentPlay!.pixelRatio! - approachCircleDiameter / 2;
        this.approachCircle.y = window.innerHeight / 2 + (this.hitObject.y - PLAYFIELD_DIMENSIONS.height/2) * gameState.currentPlay!.pixelRatio! - approachCircleDiameter / 2;
    }

    remove() {
        mainHitObjectContainer.removeChild(this.container);
        approachCircleContainer.removeChild(this.approachCircle);
    }
}