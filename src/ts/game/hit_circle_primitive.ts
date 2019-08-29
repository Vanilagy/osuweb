import { ComboInfo } from "./processed_beatmap";
import { gameState } from "./game_state";
import { DRAWING_MODE, DrawingMode, PROCEDURAL_HEAD_INNER_TYPE, CIRCLE_BORDER_WIDTH, NUMBER_HEIGHT_CS_RATIO, DEFAULT_HIT_OBJECT_FADE_IN_TIME, HIT_OBJECT_FADE_OUT_TIME, FOLLOW_CIRCLE_THICKNESS_FACTOR } from "../util/constants";
import { colorToHexNumber } from "../util/graphics_util";
import { SpriteNumber } from "../visuals/sprite_number";
import { MathUtil, EaseType } from "../util/math_util";
import { OsuTexture, AnimatedOsuSprite } from "./skin";
import { Mod } from "./mods";

const HIT_CIRCLE_NUMBER_FADE_OUT_TIME = 100;
const HIT_CIRCLE_FADE_OUT_TIME_ON_MISS = 75;
const REVERSE_ARROW_FADE_IN_TIME = 150;
const REVERSE_ARROW_PULSE_DURATION = 300;
const SHAKE_DURATION = 200;

interface HitCirclePrimitiveOptions {
    fadeInStart: number,
    comboInfo: ComboInfo,
    hasApproachCircle: boolean,
    hasNumber: boolean,
    reverseArrowAngle?: number,
    type: HitCirclePrimitiveType,
    baseElementsHidden?: boolean
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
    private overlayAnimator: AnimatedOsuSprite = null;
    private number: PIXI.Container;
    public approachCircle: PIXI.Container;
    public reverseArrow: PIXI.Container;
    private shakeStartTime: number = -Infinity;
    public renderFinished: boolean;

    constructor(options: HitCirclePrimitiveOptions) {
        this.options = options;
        this.fadeOut = null;
        this.approachCircle = null;
        this.reverseArrow = null;
        this.renderFinished = false;

        this.draw();
    }

    private draw() {
        let { circleDiameter, headedHitObjectTextureFactor } = gameState.currentPlay;

        let base: PIXI.Container;
        if (DRAWING_MODE === DrawingMode.Procedural) {
            let canvas = document.createElement('canvas');
            canvas.setAttribute('width', String(Math.ceil(circleDiameter)));
            canvas.setAttribute('height', String(Math.ceil(circleDiameter)));
            let ctx = canvas.getContext('2d');
            drawHitObjectHead(ctx, 0, 0, this.options.comboInfo);

            let sprite = new PIXI.Sprite(PIXI.Texture.from(canvas));
            sprite.anchor.set(0.5, 0.5);

            base = sprite;
        } else if (DRAWING_MODE === DrawingMode.Skin) {
            let osuTexture = gameState.currentGameplaySkin.textures["hitCircle"];

            if (this.options.type === HitCirclePrimitiveType.SliderHead) {
                let startTex = gameState.currentGameplaySkin.textures["sliderStartCircle"];
                if (!startTex.isEmpty()) osuTexture = startTex;
            } else if (this.options.type === HitCirclePrimitiveType.SliderEnd) {
                let endTex = gameState.currentGameplaySkin.textures["sliderEndCircle"];
                if (!endTex.isEmpty()) osuTexture = endTex;
            }

            let sprite = new PIXI.Sprite();
            osuTexture.applyToSprite(sprite, headedHitObjectTextureFactor);

            sprite.tint = colorToHexNumber(this.options.comboInfo.color);
            sprite.anchor.set(0.5, 0.5);

            let wrapper = new PIXI.Container();
            wrapper.addChild(sprite);

            base = wrapper;
        }

        this.base = base;

        let overlay: PIXI.Container;
        if (DRAWING_MODE === DrawingMode.Skin) {
            let osuTexture: OsuTexture = null;

            if (this.options.type === HitCirclePrimitiveType.HitCircle) {
                osuTexture = gameState.currentGameplaySkin.textures["hitCircleOverlay"];
            } else if (this.options.type === HitCirclePrimitiveType.SliderHead) {
                let baseTex = gameState.currentGameplaySkin.textures["sliderStartCircle"];

                if (!baseTex.isEmpty()) {
                    let overlayTex = gameState.currentGameplaySkin.textures["sliderStartCircleOverlay"];
                    if (!overlayTex.isEmpty()) osuTexture = overlayTex;
                } else {
                    osuTexture = gameState.currentGameplaySkin.textures["hitCircleOverlay"]; // Fall back to regular hitcircle's overlay
                }
            } else if (this.options.type === HitCirclePrimitiveType.SliderEnd) {
                let baseTex = gameState.currentGameplaySkin.textures["sliderEndCircle"];

                if (!baseTex.isEmpty()) {
                    let overlayTex = gameState.currentGameplaySkin.textures["sliderEndCircleOverlay"];
                    if (!overlayTex.isEmpty()) osuTexture = overlayTex;
                } else {
                    osuTexture = gameState.currentGameplaySkin.textures["hitCircleOverlay"]; // Fall back to regular hitcircle's overlay
                }
            }

            let sprite: PIXI.Sprite;

            if (osuTexture) {
                let animator = new AnimatedOsuSprite(osuTexture, headedHitObjectTextureFactor);
                animator.setFps(2); // From the website: "Animation rate: 2 FPS (4 FPS max)." "This rate is affected by the half time and double time/nightcore the game modifiers."
                animator.play(this.options.fadeInStart);
                sprite = animator.sprite;

                this.overlayAnimator = animator;
            } else {
                sprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
            }

            let wrapper = new PIXI.Container();
            wrapper.addChild(sprite);

            overlay = wrapper;
        }

        this.overlay = overlay;

        let number: PIXI.Container;
        if (this.options.hasNumber) {
            if (DRAWING_MODE === DrawingMode.Skin) {
                let text = new SpriteNumber({
                    textures: gameState.currentGameplaySkin.hitCircleNumberTextures,
                    horizontalAlign: "center",
                    verticalAlign: "middle",
                    overlap: gameState.currentGameplaySkin.config.fonts.hitCircleOverlap,
                    scaleFactor: headedHitObjectTextureFactor * 0.8 // "This element is downscaled by 0.8x" https://osu.ppy.sh/help/wiki/Skinning/osu!
                });
                text.setValue(this.options.comboInfo.n);

                number = text.container;

                this.number = number;
            }
        }

        let reverseArrow: PIXI.Container = null;
        if (this.options.reverseArrowAngle !== undefined) {
            if (DRAWING_MODE === DrawingMode.Skin) {
                let osuTexture = gameState.currentGameplaySkin.textures["reverseArrow"];
                let sprite = new PIXI.Sprite();
                osuTexture.applyToSprite(sprite, headedHitObjectTextureFactor);

                sprite.anchor.set(0.5, 0.5);
                sprite.rotation = this.options.reverseArrowAngle;

                let wrapper = new PIXI.Container();
                wrapper.addChild(sprite);

                reverseArrow = wrapper;
            }
        }

        this.reverseArrow = reverseArrow;

        if (this.options.hasApproachCircle) {
            if (DRAWING_MODE === DrawingMode.Procedural) {
                let approachCircle = new PIXI.Graphics();
                let actualApproachCircleWidth = CIRCLE_BORDER_WIDTH * circleDiameter / 2; // Should be as wide as circle border once it hits it
                approachCircle.lineStyle(actualApproachCircleWidth, colorToHexNumber(this.options.comboInfo.color));
                approachCircle.drawCircle(0, 0, (circleDiameter - actualApproachCircleWidth) / 2); 
    
                this.approachCircle = approachCircle;
            } else if (DRAWING_MODE === DrawingMode.Skin) {
                let osuTexture = gameState.currentGameplaySkin.textures["approachCircle"];
                let sprite = new PIXI.Sprite();
                osuTexture.applyToSprite(sprite, headedHitObjectTextureFactor);

                sprite.anchor.set(0.5, 0.5);
                sprite.tint = colorToHexNumber(this.options.comboInfo.color);

                let wrapper = new PIXI.Container();
                wrapper.addChild(sprite);
    
                this.approachCircle = wrapper;
            }
        }

        let container = new PIXI.Container();
        container.addChild(base);

        if (gameState.currentGameplaySkin.config.general.hitCircleOverlayAboveNumber) {
            if (number) container.addChild(number);
            if (overlay) container.addChild(overlay);
        } else {
            if (overlay) container.addChild(overlay);
            if (number) container.addChild(number);
        }

        if (this.options.baseElementsHidden) container.visible = false;

        this.container = container;
    }

    update(currentTime: number) {
        let { approachTime, circleDiameter, activeMods } = gameState.currentPlay;

        let hasHidden = activeMods.has(Mod.Hidden);

        if (this.overlayAnimator !== null) this.overlayAnimator.update(currentTime);

        if (hasHidden || this.fadeOut === null) {
            let fadeInCompletion = this.getFadeInCompletion(currentTime, hasHidden);
            let hiddenFadeOutCompletion = hasHidden? this.getHiddenFadeOutCompletion(currentTime) : 0;

            this.container.alpha = fadeInCompletion * (1 - hiddenFadeOutCompletion);
            
            if (this.reverseArrow) {
                // When using HD, any reverse arrow but the first one will receive no fade-in animation whatsoever
                if (this.options.baseElementsHidden) this.reverseArrow.alpha = Math.ceil(fadeInCompletion);
                else {
                    let reverseArrowFadeInCompletion = (currentTime - this.options.fadeInStart) / REVERSE_ARROW_FADE_IN_TIME;
                    reverseArrowFadeInCompletion = MathUtil.clamp(reverseArrowFadeInCompletion, 0, 1);
    
                    this.reverseArrow.alpha = reverseArrowFadeInCompletion;
                }
            }

            if (this.approachCircle !== null) {
                let approachCircleCompletion = (currentTime - this.options.fadeInStart) / approachTime;
                approachCircleCompletion = MathUtil.clamp(approachCircleCompletion, 0, 1);
    
                let approachCircleFactor = (1-approachCircleCompletion) * 3 + 1; // Goes from 4.0 -> 1.0
                this.approachCircle.scale.set(approachCircleFactor);
    
                this.approachCircle.alpha = fadeInCompletion * (1 - hiddenFadeOutCompletion);
    
                if (approachCircleCompletion === 1) this.approachCircle.visible = false;
            }

            if (this.reverseArrow !== null) {
                let scale = this.getReverseArrowScale(currentTime);
                this.reverseArrow.scale.set(scale);
            }

            // Dirty?
            if (this.fadeOut) {
                this.container.visible = false;
                if (this.approachCircle) this.approachCircle.visible = false;
                if (this.reverseArrow) this.reverseArrow.visible = false;
                
                this.renderFinished = true;
            }
        } else {
            if (this.approachCircle) this.approachCircle.visible = false;

            let fadeOutTime = (this.fadeOut.type === HitCirclePrimitiveFadeOutType.ScaleOut)? HIT_OBJECT_FADE_OUT_TIME : HIT_CIRCLE_FADE_OUT_TIME_ON_MISS;

            let fadeOutCompletion = (currentTime - this.fadeOut.time) / fadeOutTime;
            fadeOutCompletion = MathUtil.clamp(fadeOutCompletion, 0, 1);

            let alpha = MathUtil.lerp(this.fadeOutStartOpacity, 0, fadeOutCompletion);
            this.container.alpha = alpha;
            if (this.reverseArrow) this.reverseArrow.alpha = alpha;

            if (this.fadeOut.type === HitCirclePrimitiveFadeOutType.ScaleOut) {
                let scale = 1 + MathUtil.ease(EaseType.EaseOutQuad, fadeOutCompletion) * 0.5; // Max scale: 1.5

                this.base.scale.set(scale);
                if (this.overlay) this.overlay.scale.set(scale);

                if (this.reverseArrow !== null) {
                    this.reverseArrow.scale.set(scale);
                }
            }

            let numberFadeOutCompletion = (currentTime - this.fadeOut.time) / HIT_CIRCLE_NUMBER_FADE_OUT_TIME;
            numberFadeOutCompletion = MathUtil.clamp(numberFadeOutCompletion, 0, 1);
            if (this.number) {
                this.number.alpha = 1 - numberFadeOutCompletion;
            }

            this.renderFinished = (!this.approachCircle || this.approachCircle.visible === false) && (this.container.alpha === 0 || this.container.visible === false);
        }

        if (this.options.type === HitCirclePrimitiveType.HitCircle) {
            // Apply the shaking effect:
            let shakeCompletion = (currentTime - this.shakeStartTime) / SHAKE_DURATION;
            shakeCompletion = MathUtil.clamp(shakeCompletion, 0, 1);
            if (shakeCompletion < 1) {
                let deflectionFactor = Math.sin(currentTime/7.5) * (1 - shakeCompletion);
                let maximumDeflection = circleDiameter * 0.1;

                this.container.pivot.x = deflectionFactor * maximumDeflection;
                if (this.approachCircle) this.approachCircle.pivot.x = deflectionFactor * maximumDeflection / this.approachCircle.scale.x; // Dirty hack: Divide by the scale so that the pivot change is scale-independent
                if (this.reverseArrow) this.reverseArrow.pivot.x = deflectionFactor * maximumDeflection / this.reverseArrow.scale.x;
            } else {
                this.container.pivot.x = 0;
                if (this.approachCircle) this.approachCircle.pivot.x = 0;
                if (this.reverseArrow) this.reverseArrow.pivot.x = 0;
            }
        }   
    }

    getHiddenFadeOutCompletion(time: number) {
        let { approachTime } = gameState.currentPlay;

        let approachTimeThird = approachTime / 3;

        let fadeOutCompletion = (time - (this.options.fadeInStart + approachTimeThird)) / approachTimeThird; // Fade out in 1/3rd the approach time
        fadeOutCompletion = MathUtil.clamp(fadeOutCompletion, 0, 1);

        return fadeOutCompletion;
    }

    getFadeInCompletion(time: number, hasHidden: boolean) {
        let { approachTime } = gameState.currentPlay;

        if (hasHidden) {
            let approachTimeThird = approachTime / 3;

            let fadeInCompletion = (time - this.options.fadeInStart) / approachTimeThird; // Fade in in 1/3rd the approach time
            fadeInCompletion = MathUtil.clamp(fadeInCompletion, 0, 1);

            return fadeInCompletion;
        } else {
            let fadeInCompletion = (time - this.options.fadeInStart) / DEFAULT_HIT_OBJECT_FADE_IN_TIME;
            fadeInCompletion = MathUtil.clamp(fadeInCompletion, 0, 1);

            return fadeInCompletion;
        }
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
        this.fadeOutStartOpacity = 1; // It looks like opacity is set to 1 when fade-out starts.
    }

    isFadingOut() {
        return this.fadeOut !== null;
    }

    shake(time: number) {
        this.shakeStartTime = time;
    }

    static fadeOutBasedOnHitState(primitive: HitCirclePrimitive, time: number, hit: boolean) {
        if (hit) {
            primitive.setFadeOut({
                type: HitCirclePrimitiveFadeOutType.ScaleOut,
                time: time
            });
        } else {
            primitive.setFadeOut({
                type: HitCirclePrimitiveFadeOutType.FadeOut,
                time: time
            });
        }
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