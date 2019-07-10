import { MathUtil } from "../util/math_util";
import { DrawableHitObject, drawCircle } from "./drawable_hit_object";
import { Circle } from "../datamodel/circle";
import { gameState } from "./game_state";
import { PLAYFIELD_DIMENSIONS, APPROACH_CIRCLE_TEXTURE, HIT_OBJECT_FADE_OUT_TIME, CIRCLE_BORDER_WIDTH } from "../util/constants";
import { mainHitObjectContainer, approachCircleContainer } from "../visuals/rendering";
import { colorToHexNumber } from "../util/graphics_util";
import { PlayEvent, PlayEventType } from "./play_events";

export class DrawableCircle extends DrawableHitObject {
    public hitObject: Circle;

    constructor(hitObject: Circle) {
        super(hitObject);
    }

    init() {
        this.endTime = this.startTime;
        this.endPoint = {
            x: this.hitObject.x,
            y: this.hitObject.y
        };

        this.renderStartTime = this.startTime - gameState.currentPlay.ARMs;
        this.renderEndTime = this.endTime + HIT_OBJECT_FADE_OUT_TIME;
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

        let approachCircle = new PIXI.Graphics();
        let actualApproachCircleWidth = CIRCLE_BORDER_WIDTH * circleDiameter / 2; // Should be as wide as circle border once it hits it
        approachCircle.lineStyle(actualApproachCircleWidth, colorToHexNumber(this.comboInfo.color));
        approachCircle.drawCircle(0, 0, (circleDiameter - actualApproachCircleWidth) / 2); 
        this.approachCircle = approachCircle;

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

    addPlayEvents(playEventArray: PlayEvent[]) {
        playEventArray.push({
            type: PlayEventType.HeadHit,
            hitObject: this,
            time: this.startTime
        });
    }
}