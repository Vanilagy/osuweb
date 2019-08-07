import { DrawableHitObject, NUMBER_HEIGHT_CS_RATIO } from "./drawable_hit_object";
import { HitObject } from "../datamodel/hit_object";
import { gameState } from "./game_state";
import { ScoringValue } from "./score";
import { MathUtil, EaseType } from "../util/math_util";
import { HIT_OBJECT_FADE_OUT_TIME, DRAWING_MODE, DrawingMode, CIRCLE_BORDER_WIDTH } from "../util/constants";
import { ComboInfo } from "./processed_beatmap";
import { SpriteNumber } from "../visuals/sprite_number";
import { digitTextures, approachCircleTexture } from "./skin";
import { colorToHexNumber } from "../util/graphics_util";
import { mainHitObjectContainer, approachCircleContainer } from "../visuals/rendering";
import { Point, pointDistance } from "../util/point";
import { PlayEvent, PlayEventType } from "./play_events";

export interface HitObjectHeadScoring {
    hit: ScoringValue,
    time: number
}

export function getDefaultHitObjectHeadScoring(): HitObjectHeadScoring {
    return {
        hit: ScoringValue.NotHit,
        time: null
    };
}

export interface CircleScoring {
    head: HitObjectHeadScoring
}

export function getDefaultCircleScoring(): CircleScoring {
    return {
        head: getDefaultHitObjectHeadScoring()
    };
}

// Keeps track of what the player has successfully hit
export interface SliderScoring {
    head: HitObjectHeadScoring,
    ticks: number,
    repeats: number,
    end: boolean
}

export function getDefaultSliderScoring(): SliderScoring {
    return {
        head: getDefaultHitObjectHeadScoring(),
        ticks: 0,
        repeats: 0,
        end: false
    };
}

export abstract class HeadedDrawableHitObject extends DrawableHitObject {
    public headSprite: PIXI.Sprite;
    public approachCircle: PIXI.Container;
    public stackHeight: number = 0;
    public scoring: CircleScoring | SliderScoring;

    constructor(hitObject: HitObject) {
        super(hitObject);
    }

    applyStackPosition() {
        this.x += this.stackHeight * -4;
        this.y += this.stackHeight * -4;
        this.startPoint.x += this.stackHeight * -4;
        this.startPoint.y += this.stackHeight * -4;
        this.endPoint.x += this.stackHeight * -4;
        this.endPoint.y += this.stackHeight * -4;
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

        if (DRAWING_MODE === DrawingMode.Skin) {
            let text = new SpriteNumber({
                textures: digitTextures,
                horizontalAlign: "center",
                verticalAlign: "middle",
                digitHeight: NUMBER_HEIGHT_CS_RATIO * circleDiameter,
                overlap: 15
            });
            text.setValue(this.comboInfo.n);
            text.container.x = circleDiameter/2;
            text.container.y = circleDiameter/2;

            this.headSprite.addChild(text.container);
        }

        if (DRAWING_MODE === DrawingMode.Procedural) {
            let approachCircle = new PIXI.Graphics();
            let actualApproachCircleWidth = CIRCLE_BORDER_WIDTH * circleDiameter / 2; // Should be as wide as circle border once it hits it
            approachCircle.lineStyle(actualApproachCircleWidth, colorToHexNumber(this.comboInfo.color));
            approachCircle.drawCircle(0, 0, (circleDiameter - actualApproachCircleWidth) / 2); 

            this.approachCircle = approachCircle;
        } else if (DRAWING_MODE === DrawingMode.Skin) {
            let approachCircle = new PIXI.Sprite(approachCircleTexture);
            approachCircle.pivot.x = approachCircle.width / 2;
            approachCircle.pivot.y = approachCircle.height / 2;
            approachCircle.width = circleDiameter;
            approachCircle.height = circleDiameter;
            approachCircle.tint = colorToHexNumber(this.comboInfo.color);

            this.approachCircle = approachCircle;
        }

        this.container.addChild(this.headSprite);
    }

    show(currentTime: number) {
        mainHitObjectContainer.addChildAt(this.container, 0);
        approachCircleContainer.addChild(this.approachCircle);

        this.position();
        this.update(currentTime);
    }

    position() {
        this.approachCircle.x = gameState.currentPlay.toScreenCoordinatesX(this.x);
        this.approachCircle.y = gameState.currentPlay.toScreenCoordinatesY(this.y);
    }

    remove() {
        mainHitObjectContainer.removeChild(this.container);
        approachCircleContainer.removeChild(this.approachCircle);
    }

    abstract hitHead(time: number): void;
    
    handleButtonPress(osuMouseCoordinates: Point, currentTime: number) {
        let { circleRadiusOsuPx } = gameState.currentPlay;

        let distance = pointDistance(osuMouseCoordinates, this.startPoint);

        if (distance <= circleRadiusOsuPx) {
            if (this.scoring.head.hit === ScoringValue.NotHit) {
                this.hitHead(currentTime);
                return true;
            }
        }

        return false;
    }

    addPlayEvents(playEventArray: PlayEvent[]) {
        let { processedBeatmap } = gameState.currentPlay;

        playEventArray.push({
            type: PlayEventType.PerfectHeadHit,
            hitObject: this,
            time: this.startTime
        });

        playEventArray.push({
            type: PlayEventType.HeadHitWindowEnd,
            hitObject: this,
            time: this.startTime + processedBeatmap.beatmap.difficulty.getHitDeltaForJudgement(50)
        });
    }

    updateHeadElements(currentTime: number) {
        let { ARMs, circleDiameter } = gameState.currentPlay;
    
        let fadeInCompletion = 1;
        let headScoring = this.scoring.head;
    
        if (headScoring.hit === ScoringValue.NotHit) {
            if (currentTime < this.startTime) {
                fadeInCompletion = (currentTime - (this.hitObject.time - ARMs)) / ARMs;
                fadeInCompletion = MathUtil.clamp(fadeInCompletion, 0, 1);
                fadeInCompletion = MathUtil.ease(EaseType.EaseOutQuad, fadeInCompletion);
    
                let approachCircleAppearTime = this.startTime - ARMs;
                let approachCircleCompletion = (currentTime - approachCircleAppearTime) / ARMs;
                approachCircleCompletion = MathUtil.clamp(approachCircleCompletion, 0, 1);
    
                let approachCircleFactor = (1-approachCircleCompletion) * 3 + 1; // Goes from 4.0 -> 1.0
                let approachCircleDiameter = circleDiameter * approachCircleFactor;
                this.approachCircle.width = this.approachCircle.height = approachCircleDiameter;
    
                this.approachCircle.alpha = fadeInCompletion;
            } else {
                this.approachCircle.visible = false;
            }
        } else {
            this.approachCircle.visible = false;
    
            let time = headScoring.time;
    
            let fadeOutCompletion = (currentTime - (time)) / HIT_OBJECT_FADE_OUT_TIME;
            fadeOutCompletion = MathUtil.clamp(fadeOutCompletion, 0, 1);
            fadeOutCompletion = MathUtil.ease(EaseType.EaseOutQuad, fadeOutCompletion);
    
            let alpha = 1 - fadeOutCompletion;
            let scale = 1 + fadeOutCompletion * 0.333; // Max scale: 1.333
    
            this.headSprite.alpha = alpha;
            if (headScoring.hit !== ScoringValue.Miss) { // Misses just fade out, whereas all other hit judgements also cause an 'expansion' effect
                this.headSprite.width = circleDiameter * scale;
                this.headSprite.height = circleDiameter * scale;
            }
        }
    
        return { fadeInCompletion };
    }
}

export function drawCircle(context: CanvasRenderingContext2D, x: number, y: number, comboInfo: ComboInfo) { // Draws circle used for Hit Circles, Slider Heads and Repeat Tails
    let { circleDiameter, processedBeatmap } = gameState.currentPlay;

    let color = comboInfo.color;

    //color = {r: 255, g: 20, b: 20};

    if (DRAWING_MODE === DrawingMode.Procedural) {
        console.log("Get donw on it")

        context.beginPath(); // Draw circle base (will become border)
        context.arc(x + circleDiameter / 2, y + circleDiameter / 2, circleDiameter / 2, 0, Math.PI * 2);
        context.fillStyle = "white";
        context.fill();

        let colorString = "rgb(" + Math.round(color.r * 0.68) + "," + Math.round(color.g * 0.68) + "," + Math.round(color.b * 0.68) + ")";
        let darkColorString = "rgb(" + Math.round(color.r * 0.2) + "," + Math.round(color.g * 0.2) + "," + Math.round(color.b * 0.2) + ")";

        let radialGradient = context.createRadialGradient(x + circleDiameter / 2, y + circleDiameter / 2, 0, x + circleDiameter / 2, y + circleDiameter / 2, circleDiameter / 2);
        radialGradient.addColorStop(0, colorString);
        radialGradient.addColorStop(1, darkColorString);

        context.beginPath(); // Draw circle body with radial gradient
        context.arc(x + circleDiameter / 2, y + circleDiameter / 2, (circleDiameter / 2) * (1 - CIRCLE_BORDER_WIDTH), 0, Math.PI * 2);
        context.fillStyle = radialGradient;
        context.fill();
        context.fillStyle = "rgba(255, 255, 255, 0.5)";
        context.globalCompositeOperation = "destination-out"; // Transparency
        context.fill();
    } else if (DRAWING_MODE === DrawingMode.Skin) {
        //context.drawImage(hitCircleImage, x, y, circleDiameter, circleDiameter);

        context.drawImage(gameState.currentPlay.coloredHitCircles[comboInfo.colorIndex], x, y);

        //context.drawImage(GAME_STATE.currentPlay.drawElements.coloredHitcircles[comboInfo.comboNum % GAME_STATE.currentBeatmap.colors.length], x, y);
    }

    context.globalCompositeOperation = "source-over";
    if (DRAWING_MODE === DrawingMode.Procedural) {
        let innerType = "number";

        if (innerType === "number") {
            context.font = (circleDiameter * 0.41) + "px 'Nunito'";
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.fillStyle = "white";
            context.fillText(String(comboInfo.n), x + circleDiameter / 2, y + circleDiameter / 2 * 1.06); // 1.06 = my attempt to make it centered.
        } else {
            context.beginPath();
            context.arc(x + circleDiameter / 2, y + circleDiameter / 2, circleDiameter / 2 * 0.25, 0, Math.PI * 2);
            context.fillStyle = "white";
            context.fill();
        }
    } else if (DRAWING_MODE === DrawingMode.Skin) {
        //let numberWidth = 70 / 256 * GAME_STATE.currentPlay.csPixel,
        //    numberHeight = 104 / 256 * GAME_STATE.currentPlay.csPixel,
        //    numberString = comboInfo.n.toString(),
        //    hitCircleOverlap = 6;
//
        //for (let i = 0; i < numberString.length; i++) {
        //    context.drawImage(GAME_STATE.currentPlay.drawElements.numbers[numberString.charAt(i)], GAME_STATE.currentPlay.halfCsPixel - numberWidth * numberString.length / 2 + hitCircleOverlap * (numberString.length - 1) / 2 + ((numberWidth - hitCircleOverlap) * i), GAME_STATE.currentPlay.halfCsPixel - numberHeight / 2, numberWidth, numberHeight);
        //}
    }
}

// Updates the head and approach circle based on current time.