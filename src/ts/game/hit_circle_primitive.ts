import { ComboInfo } from "./processed_beatmap";
import { gameState } from "./game_state";
import { DRAWING_MODE, DrawingMode, PROCEDURAL_HEAD_INNER_TYPE, CIRCLE_BORDER_WIDTH, NUMBER_HEIGHT_CS_RATIO, HIT_OBJECT_FADE_IN_TIME, HIT_OBJECT_FADE_OUT_TIME, FOLLOW_CIRCLE_THICKNESS_FACTOR } from "../util/constants";
import { hitCircleTexture, hitCircleOverlayTexture, digitTextures, approachCircleTexture, reverseArrowTexture, sliderEndCircleTexture, sliderEndCircleOverlayTexture } from "./skin";
import { colorToHexNumber } from "../util/graphics_util";
import { SpriteNumber } from "../visuals/sprite_number";
import { MathUtil, EaseType } from "../util/math_util";

const HIT_CIRCLE_NUMBER_FADE_OUT_TIME = 100;
const APPROACH_CIRCLE_CS_RATIO = 126/118; // Determined from image dimensions
const REVERSE_ARROW_PULSE_DURATION = 300;

interface HitCirclePrimitiveOptions {
    fadeInStart: number,
    comboInfo: ComboInfo,
    hasApproachCircle: boolean,
    hasNumber: boolean,
    reverseArrowAngle?: number,
    type: HitCirclePrimitiveType
}

export enum HitCirclePrimitiveType {
    HitCircle,
    SliderHead,
    SliderEnd
}

export enum HitCirclePrimitiveFadeOutType {
    ScaleOut,
    FadeOut
}

interface HitCirclePrimitiveFadeOutOptions {
    type: HitCirclePrimitiveFadeOutType,
    time: number
}

export class HitCirclePrimitive {
    private options: HitCirclePrimitiveOptions;
    private fadeOut: HitCirclePrimitiveFadeOutOptions;
    private fadeOutStartOpacity: number;

    public container: PIXI.Container;
    private base: PIXI.Container;
    private overlay: PIXI.Container;
    private number: PIXI.Container;
    public approachCircle: PIXI.Container;
    public reverseArrow: PIXI.Container;
    private lastReverseArrowScale: number;

    constructor(options: HitCirclePrimitiveOptions) {
        this.options = options;
        this.fadeOut = null;
        this.approachCircle = null;
        this.reverseArrow = null;

        this.draw();
    }

    private draw() {
        let circleDiameter = gameState.currentPlay.circleDiameter;

        let base: PIXI.Sprite;
        if (DRAWING_MODE === DrawingMode.Procedural) {
            let canvas = document.createElement('canvas');
            canvas.setAttribute('width', String(Math.ceil(circleDiameter)));
            canvas.setAttribute('height', String(Math.ceil(circleDiameter)));
            let ctx = canvas.getContext('2d');
            drawHitObjectHead(ctx, 0, 0, this.options.comboInfo);

            base = new PIXI.Sprite(PIXI.Texture.from(canvas));
        } else if (DRAWING_MODE === DrawingMode.Skin) {
            let tex: PIXI.Texture;
            if (this.options.type !== HitCirclePrimitiveType.SliderEnd) {
                tex = hitCircleTexture;
            } else {
                tex = sliderEndCircleTexture;
            }

            base = new PIXI.Sprite(tex);
            base.tint = colorToHexNumber(this.options.comboInfo.color);
        }

        base.pivot.x = base.width / 2;
        base.pivot.y = base.height / 2;
        base.width = circleDiameter;
        base.height = circleDiameter;

        this.base = base;

        let overlay: PIXI.Container;
        if (DRAWING_MODE === DrawingMode.Skin) {
            let tex: PIXI.Texture;
            if (this.options.type !== HitCirclePrimitiveType.SliderEnd) {
                tex = hitCircleOverlayTexture;
            } else {
                tex = sliderEndCircleOverlayTexture;
            }

            overlay = new PIXI.Sprite(tex);

            overlay.pivot.x = overlay.width / 2;
            overlay.pivot.y = overlay.height / 2;
            overlay.width = circleDiameter;
            overlay.height = circleDiameter;

            this.overlay = overlay;
        }

        let number: PIXI.Container;
        if (this.options.hasNumber) {
            if (DRAWING_MODE === DrawingMode.Skin) {
                let text = new SpriteNumber({
                    textures: digitTextures,
                    horizontalAlign: "center",
                    verticalAlign: "middle",
                    digitHeight: NUMBER_HEIGHT_CS_RATIO * circleDiameter,
                    overlap: 15
                });
                text.setValue(this.options.comboInfo.n);

                number = text.container;

                this.number = number;
            }
        }

        let reverseArrow: PIXI.Container;
        if (this.options.reverseArrowAngle !== undefined) {
            if (DRAWING_MODE === DrawingMode.Skin) {
                reverseArrow = new PIXI.Sprite(reverseArrowTexture);

                let yes1 = reverseArrow.width; // Keep the original width at the start.
                let yes2 = reverseArrow.height; // Keep the original width at the start.
    
                // Make all this a bit... cleaner.
                // Essentially what this does is set the width OR height, whatever is bigger, to the circleDiameter, and adjust the other dimension so that the ratio is kept.
                let no1, no2, r = yes1/yes2;
                if (yes1 > yes2) {
                    no1 = circleDiameter;
                    no2 = circleDiameter / r;
                } else {
                    no1 = circleDiameter / r;
                    no2 = circleDiameter;
                }
    
                reverseArrow.width = no1;
                reverseArrow.height = no2;
                reverseArrow.pivot.x = yes1 / 2;
                reverseArrow.pivot.y = yes2 / 2;

                reverseArrow.rotation = this.options.reverseArrowAngle;

                this.reverseArrow = reverseArrow;
            }
        }

        if (this.options.hasApproachCircle) {
            if (DRAWING_MODE === DrawingMode.Procedural) {
                let approachCircle = new PIXI.Graphics();
                let actualApproachCircleWidth = CIRCLE_BORDER_WIDTH * circleDiameter / 2; // Should be as wide as circle border once it hits it
                approachCircle.lineStyle(actualApproachCircleWidth, colorToHexNumber(this.options.comboInfo.color));
                approachCircle.drawCircle(0, 0, (circleDiameter - actualApproachCircleWidth) / 2); 
    
                this.approachCircle = approachCircle;
            } else if (DRAWING_MODE === DrawingMode.Skin) {
                let approachCircle = new PIXI.Sprite(approachCircleTexture);
                approachCircle.pivot.x = approachCircle.width / 2;
                approachCircle.pivot.y = approachCircle.height / 2;
                approachCircle.width = circleDiameter;
                approachCircle.height = circleDiameter;
                approachCircle.tint = colorToHexNumber(this.options.comboInfo.color);
    
                this.approachCircle = approachCircle;
            }
        }

        let container = new PIXI.Container();
        container.addChild(base);
        if (overlay) container.addChild(overlay);
        if (number) container.addChild(number);

        this.container = container;
    }

    update(currentTime: number) {
        let { circleDiameter, ARMs } = gameState.currentPlay;

        if (this.fadeOut === null) {
            let fadeInCompletion = this.getFadeInCompletion(currentTime);
            this.container.alpha = fadeInCompletion;

            if (this.approachCircle !== null) {
                let approachCircleCompletion = (currentTime - this.options.fadeInStart) / ARMs;
                approachCircleCompletion = MathUtil.clamp(approachCircleCompletion, 0, 1);

                let approachCircleFactor = (1-approachCircleCompletion) * 3 + 1; // Goes from 4.0 -> 1.0
                let approachCircleDiameter = circleDiameter * APPROACH_CIRCLE_CS_RATIO * approachCircleFactor;
                this.approachCircle.width = this.approachCircle.height = approachCircleDiameter;
    
                this.approachCircle.alpha = fadeInCompletion;

                if (approachCircleCompletion === 1) this.approachCircle.visible = false;
            }

            if (this.reverseArrow !== null) {
                let scale = this.getReverseArrowScale(currentTime);

                this.reverseArrow.scale.set(scale);
            }
        } else {
            if (this.approachCircle !== null) this.approachCircle.visible = false;

            let fadeOutCompletion = (currentTime - this.fadeOut.time) / HIT_OBJECT_FADE_OUT_TIME;
            fadeOutCompletion = MathUtil.clamp(fadeOutCompletion, 0, 1);

            let alpha = MathUtil.lerp(this.fadeOutStartOpacity, 0, fadeOutCompletion);
            this.container.alpha = alpha;
            if (this.reverseArrow) this.reverseArrow.alpha = alpha;

            if (this.fadeOut.type === HitCirclePrimitiveFadeOutType.ScaleOut) {
                let scale = 1 + MathUtil.ease(EaseType.EaseOutQuad, fadeOutCompletion) * 0.333; // Max scale: 1.333

                this.base.width = circleDiameter * scale;
                this.base.height = circleDiameter * scale;
                if (this.overlay) {
                    this.overlay.width = circleDiameter * scale;
                    this.overlay.height = circleDiameter * scale;
                }

                if (this.reverseArrow !== null) {
                    this.reverseArrow.scale.set(this.lastReverseArrowScale * scale)
                }
            }

            let numberFadeOutCompletion = (currentTime - this.fadeOut.time) / HIT_CIRCLE_NUMBER_FADE_OUT_TIME;
            numberFadeOutCompletion = MathUtil.clamp(numberFadeOutCompletion, 0, 1);
            if (this.number) {
                this.number.alpha = 1 - numberFadeOutCompletion;
            }   
        }
    }

    getFadeInCompletion(time: number) {
        let fadeInCompletion = (time - this.options.fadeInStart) / HIT_OBJECT_FADE_IN_TIME;
        fadeInCompletion = MathUtil.clamp(fadeInCompletion, 0, 1);

        return fadeInCompletion;
    }

    getReverseArrowScale(time: number) {
        let animationProgression = (time - this.options.fadeInStart) % REVERSE_ARROW_PULSE_DURATION;
        animationProgression = Math.max(0, animationProgression);

        let completion = animationProgression / REVERSE_ARROW_PULSE_DURATION;
        completion = MathUtil.ease(EaseType.EaseOutQuad, completion);

        let scale = 1 + (1 - completion) * 0.333;

        return scale;
    }

    setFadeOut(options: HitCirclePrimitiveFadeOutOptions) {
        this.fadeOut = options;
        this.fadeOutStartOpacity = 1 || this.getFadeInCompletion(options.time); // It looks like opacity is set to 1 when fade-out starts.
        this.lastReverseArrowScale = 1 || this.getReverseArrowScale(options.time);
    }

    isFadingOut() {
        return this.fadeOut !== null;
    }
}

/** Draws a hit object head procedurally, complete with base, overlay and number. */
export function drawHitObjectHead(context: CanvasRenderingContext2D, x: number, y: number, comboInfo: ComboInfo) {
    let { circleDiameter } = gameState.currentPlay;

    let color = comboInfo.color;

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

    context.globalCompositeOperation = "source-over";

    if (PROCEDURAL_HEAD_INNER_TYPE === "number") {
        context.font = (circleDiameter * 0.41) + "px 'Nunito'";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillStyle = "white";
        context.fillText(String(comboInfo.n), x + circleDiameter / 2, y + circleDiameter / 2 * 1.06); // 1.06 = my attempt to make it centered.
    } else if (PROCEDURAL_HEAD_INNER_TYPE === "dot") {
        context.beginPath();
        context.arc(x + circleDiameter / 2, y + circleDiameter / 2, circleDiameter / 2 * 0.25, 0, Math.PI * 2);
        context.fillStyle = "white";
        context.fill();
    }
}