import { Slider } from "../../datamodel/slider";
import { MathUtil, EaseType } from "../../util/math_util";
import { pointDistance } from "../../util/point";
import { gameState } from "../game_state";
import { SLIDER_TICK_APPEARANCE_ANIMATION_DURATION, HIT_OBJECT_FADE_OUT_TIME, SHOW_APPROACH_CIRCLE_ON_FIRST_HIDDEN_OBJECT, SLIDER_SETTINGS } from "../../util/constants";
import { colorToHexNumber } from "../../util/graphics_util";
import { assert, last } from "../../util/misc_util";
import { accuracyMeter } from "../hud/hud";
import { DrawableHeadedHitObject, SliderScoring, getDefaultSliderScoring } from "./drawable_headed_hit_object";
import { HitCirclePrimitive, HitCirclePrimitiveType } from "./hit_circle_primitive";
import { SoundEmitter } from "../../audio/sound_emitter";
import { renderer, mainHitObjectContainer } from "../../visuals/rendering";
import { ScoringValue } from "../scoring_value";
import { Mod } from "../mods/mods";
import { createSliderBodyShader, SLIDER_BODY_MESH_STATE, createSliderBodyTransformationMatrix } from "./slider_body_shader";
import { SliderBounds } from "./slider_path";
import { AnimatedOsuSprite } from "../skin/animated_sprite";
import { HitSoundInfo, normSampleSet, generateHitSoundInfo, getTickHitSoundTypeFromSampleSet, getSliderSlideTypesFromSampleSet, calculatePanFromOsuCoordinates } from "../skin/sound";
import { ProcessedSlider, SpecialSliderBehavior } from "../../datamodel/processed/processed_slider";
import { CurrentTimingPointInfo } from "../../datamodel/processed/processed_beatmap";

export const FOLLOW_CIRCLE_HITBOX_CS_RATIO = 308/128; // Based on a comment on the osu website: "Max size: 308x308 (hitbox)"
const FOLLOW_CIRCLE_SCALE_IN_DURATION = 200;
const FOLLOW_CIRCLE_SCALE_OUT_DURATION = 200;
const FOLLOW_CIRCLE_PULSE_DURATION = 200;
const FOLLOW_CIRCLE_RELEASE_DURATION = 200;
const MAX_SLIDER_BALL_SLIDER_VELOCITY = 0.25; // In osu pixels per millisecond. This variable is used to cap the rotation speed on slider balls for very fast sliders.
const HIDDEN_TICK_FADE_OUT_DURATION = 400;

export class DrawableSlider extends DrawableHeadedHitObject {
	public parent: ProcessedSlider;
	public scoring: SliderScoring;

    public bounds: SliderBounds;
    private baseSprite: PIXI.Sprite;
    public hasFullscreenBaseSprite: boolean = false; // If a slider is really big, like bigger-than-the-screen big, we change slider body rendering to happen in relation to the entire screen rather than a local slider texture. This way, we don't get WebGL errors from trying to draw to too big of a texture buffer, and it allows us to support slider distortions with some matrix magic.
    private sliderBodyMesh: PIXI.Mesh;
    private sliderBodyHasBeenRendered = false;
    private lastGeneratedSnakingCompletion = 0;
    
    private container: PIXI.Container;
    private overlayContainer: PIXI.Container;
    private sliderBall: SliderBall;
    private tickContainer: PIXI.Container;
    private tickElements: (PIXI.Container | null)[];
    private followCircle: PIXI.Container;
    private followCircleAnimator: AnimatedOsuSprite;
    private followCircleHoldStartTime: number = null;
    private followCircleReleaseStartTime: number = null;
    private followCirclePulseStartTime: number = -Infinity;
    private reverseArrowContainer: PIXI.Container;
    public sliderEnds: HitCirclePrimitive[] = [];
    
    public hitSounds: HitSoundInfo[];
    public tickSounds: HitSoundInfo[];
    public slideEmitters: SoundEmitter[];

    constructor(processedSlider: ProcessedSlider) {
		super(processedSlider);

        let bounds = this.parent.path.calculateBounds();
        this.bounds = bounds;

        this.scoring = getDefaultSliderScoring();

        this.initSounds(processedSlider.hitObject, processedSlider.timingInfo);
    }

    protected initSounds(slider: Slider, timingInfo: CurrentTimingPointInfo) {
        let currentTimingPoint = timingInfo.timingPoint;
    
        let sampleSet = normSampleSet(slider.extras.sampleSet || currentTimingPoint.sampleSet || 1),
            volume = slider.extras.sampleVolume || currentTimingPoint.volume,
            index = slider.extras.customIndex || currentTimingPoint.sampleIndex || 1;

        // Init hit sounds for slider head, repeats and end
        let hitSounds: HitSoundInfo[] = [];
        for (let i = 0; i < slider.edgeHitSounds.length; i++) {
            
            let time = slider.time + length/this.parent.velocity * i;
            let timingPoint = this.parent.processedBeatmap.beatmap.getClosestTimingPointTo(time);
            let hitSound = slider.edgeHitSounds[i];
            let sampling = slider.edgeSamplings[i];
            let position = (i % 2 === 0)? this.parent.startPoint : this.parent.tailPoint;

            let info = generateHitSoundInfo(hitSound, sampling.sampleSet, sampling.additionSet, null, null, timingPoint, position);
            hitSounds.push(info);
        }
        this.hitSounds = hitSounds;

        // TODO: Different tick sounds based on the timing point at that time.
        // Tick sound
        let tickSounds: HitSoundInfo[] = [];
        for (let i = 0; i < this.parent.tickCompletions.length; i++) {
            let completion = this.parent.tickCompletions[i];
            let time = slider.time + length/this.parent.velocity * completion;
            let timingPoint = this.parent.processedBeatmap.beatmap.getClosestTimingPointTo(time);
            let position = this.parent.path.getPosFromPercentage(MathUtil.mirror(completion));

            let info: HitSoundInfo = {
                base: getTickHitSoundTypeFromSampleSet(normSampleSet(slider.extras.sampleSet || timingPoint.sampleSet || 1)),
                volume: slider.extras.sampleVolume || timingPoint.volume,
                index: slider.extras.customIndex || timingPoint.index || 1,
                position: position
            };
            tickSounds.push(info);
        }
        this.tickSounds = tickSounds;

        // Slider slide sound
        let sliderSlideTypes = getSliderSlideTypesFromSampleSet(sampleSet, slider.hitSound);
        let sliderSlideEmitters: SoundEmitter[] = [];
        let sliderSlideStartPan = calculatePanFromOsuCoordinates(this.parent.startPoint);
        for (let i = 0; i < sliderSlideTypes.length; i++) {
            let type = sliderSlideTypes[i];
            let emitter = gameState.currentGameplaySkin.sounds[type].getEmitter(volume, index, sliderSlideStartPan);
            if (!emitter || emitter.isReallyShort()) continue;

            emitter.setLoopState(true);
            sliderSlideEmitters.push(emitter);
        }
        this.slideEmitters = sliderSlideEmitters;
    }

    draw() {
        if (this.parent.specialBehavior === SpecialSliderBehavior.Invisible) return;

        let { approachTime, circleRadiusOsuPx, headedHitObjectTextureFactor, activeMods } = gameState.currentPlay;

        let hasHidden = activeMods.has(Mod.Hidden);

        this.renderStartTime = this.parent.startTime - gameState.currentPlay.approachTime;
    
        this.head = new HitCirclePrimitive({
			fadeInStart: this.parent.startTime - approachTime,
			hitObject: this,
            hasApproachCircle: !hasHidden || (this.parent.index === 0 && SHOW_APPROACH_CIRCLE_ON_FIRST_HIDDEN_OBJECT),
            hasNumber: true,
            type: HitCirclePrimitiveType.SliderHead
        });
        this.head.container.zIndex = -this.parent.startTime;

        let screenStartPos = gameState.currentPlay.toScreenCoordinates(this.parent.startPoint);
        let screenTailPos = gameState.currentPlay.toScreenCoordinates(this.parent.tailPoint);

        this.reverseArrowContainer = new PIXI.Container();

        this.parent.path.generatePointData();

        this.sliderEnds = [];
        let msPerRepeatCycle = this.parent.length / this.parent.velocity;
        for (let i = 0; i < this.parent.repeat; i++) {
            let pos = (i % 2 === 0)? screenTailPos : screenStartPos;
            
            let fadeInStart: number;
            if (i === 0) {
                fadeInStart = this.parent.startTime - approachTime;

                if (SLIDER_SETTINGS.snaking) {
                    fadeInStart += approachTime/3; // Snaking takes one third of approach time.
                }
            } else {
                fadeInStart = this.parent.startTime + (i-1) * msPerRepeatCycle;
            }

            let reverseArrowAngle: number;
            if (i < this.parent.repeat-1) {
                if (i % 2 === 0) {
                    let angle = this.parent.path.getAngleFromPercentage(1);
                    // This odd condition is to prevent rotation for reverse arrows for edge-case sliders, like zero-length or zero-section sliders, which are found in Aspire maps, for example. Those sliders only have a one-point path, and something naive in ppy's code makes that cause all reverse arrows to face the same direction. I think he's just atan2-ing two very close points on the path, instead of what's being done here. Welp. Fake it!
                    if (this.parent.path.points.length > 1) angle = MathUtil.constrainRadians(angle + Math.PI); // Turn it by 180°

                    reverseArrowAngle = angle;
                } else {
                    reverseArrowAngle = this.parent.path.getAngleFromPercentage(0);
                }
            }

            let primitive = new HitCirclePrimitive({
                fadeInStart: fadeInStart,
                hitObject: this,
                hasApproachCircle: false,
                hasNumber: false,
                reverseArrowAngle: reverseArrowAngle,
                type: HitCirclePrimitiveType.SliderEnd,
                baseElementsHidden: hasHidden && i > 0
            });

            primitive.container.position.set(pos.x, pos.y);
            primitive.container.zIndex = -Math.min(fadeInStart + approachTime, this.parent.endTime); // Math.min is necessary, because without it, for some sliders, the end circle would end up BELOW the slider body. No good!

            this.sliderEnds.push(primitive);

            if (primitive.reverseArrow !== null) {
                primitive.reverseArrow.position.set(pos.x, pos.y);
                this.reverseArrowContainer.addChildAt(primitive.reverseArrow, 0);
            }
        }

        this.hasFullscreenBaseSprite = Math.max(this.bounds.screenWidth, this.bounds.screenHeight) >= Math.max(window.innerWidth, window.innerHeight);

        let renderTex = PIXI.RenderTexture.create({
            width: this.hasFullscreenBaseSprite? window.innerWidth : this.bounds.screenWidth,
			height: this.hasFullscreenBaseSprite? window.innerHeight : this.bounds.screenHeight,
			resolution: 2 // For anti-aliasing
		});
        let renderTexFramebuffer = (renderTex.baseTexture as any).framebuffer as PIXI.Framebuffer;
        renderTexFramebuffer.enableDepth();
        renderTexFramebuffer.addDepthTexture();

        this.baseSprite = new PIXI.Sprite(renderTex);
        //this.baseSprite.filters = [new PIXI.filters.FXAAFilter()]; // Enable this for FXAA. Makes slider edges look kinda janky, that's why it's disabled.
		this.baseSprite.zIndex = -this.parent.endTime;

        this.parent.path.generateBaseVertexBuffer();
        let sliderBodyDefaultSnake = SLIDER_SETTINGS.snaking? 0.0 : 1.0;
        let sliderBodyGeometry = this.parent.path.generateGeometry(sliderBodyDefaultSnake);
        this.lastGeneratedSnakingCompletion = sliderBodyDefaultSnake;
        let sliderBodyShader = createSliderBodyShader(this);
        let sliderBodyMesh = new PIXI.Mesh(sliderBodyGeometry, sliderBodyShader, SLIDER_BODY_MESH_STATE);
        sliderBodyMesh.size = this.parent.path.currentVertexCount;
        this.sliderBodyMesh = sliderBodyMesh;

        this.sliderBall = new SliderBall(this);
        this.sliderBall.container.visible = false;

        let followCircleOsuTexture = gameState.currentGameplaySkin.textures["followCircle"];
        let followCircleAnimator = new AnimatedOsuSprite(followCircleOsuTexture, headedHitObjectTextureFactor);
        followCircleAnimator.setFps(gameState.currentGameplaySkin.config.general.animationFramerate);
        followCircleAnimator.play(this.parent.startTime);

        let followCircleWrapper = new PIXI.Container();
        followCircleWrapper.addChild(followCircleAnimator.sprite);

        this.followCircle = followCircleWrapper;
        this.followCircleAnimator = followCircleAnimator;
        this.followCircle.visible = false;

        this.tickContainer = new PIXI.Container();
        this.tickElements = [];

        for (let i = 0; i < this.parent.tickCompletions.length; i++) {
            let completion = this.parent.tickCompletions[i];
            if (completion >= 1) break;

            let sliderTickPos = this.parent.path.getPosFromPercentage(MathUtil.mirror(completion));

            // Check if the tick overlaps with either slider end
            if (pointDistance(sliderTickPos, this.parent.startPoint) <= circleRadiusOsuPx || pointDistance(sliderTickPos, this.parent.tailPoint) <= circleRadiusOsuPx) {
                // If it does, hide it.
                this.tickElements.push(null);
                continue;
            }

            let tickOsuTexture = gameState.currentGameplaySkin.textures["sliderTick"];
            let tickSprite = new PIXI.Sprite();
            tickSprite.anchor.set(0.5, 0.5);

            tickOsuTexture.applyToSprite(tickSprite, headedHitObjectTextureFactor);

            let tickWrapper = new PIXI.Container();
            tickWrapper.addChild(tickSprite);

            let screenPos = gameState.currentPlay.toScreenCoordinates(sliderTickPos);
            tickWrapper.position.set(screenPos.x, screenPos.y);

            this.tickContainer.addChild(tickWrapper);
            this.tickElements.push(tickWrapper);
        }

        this.overlayContainer = new PIXI.Container();
        if (this.parent.tickCompletions.length > 0) this.overlayContainer.addChild(this.tickContainer);
        this.overlayContainer.addChild(this.sliderBall.container);
        this.overlayContainer.addChild(this.followCircle);

        this.container = new PIXI.Container();
        this.container.addChild(this.reverseArrowContainer);
        this.container.addChild(this.overlayContainer);

        this.container.zIndex = -this.parent.startTime;
    }
    
    show() {
        if (this.parent.specialBehavior === SpecialSliderBehavior.Invisible) return;

        mainHitObjectContainer.addChild(this.baseSprite);
        mainHitObjectContainer.addChild(this.container);
        for (let i = 0; i < this.sliderEnds.length; i++) {
            mainHitObjectContainer.addChild(this.sliderEnds[i].container);
        }

        super.show();
    }

    position() {
        if (this.parent.specialBehavior === SpecialSliderBehavior.Invisible) return;

        super.position(); // Haha, superposition. Yes. This joke is funny and not funny at the same time. Until observed, of course.

        let { circleRadiusOsuPx } = gameState.currentPlay;
 
        let screenX = gameState.currentPlay.toScreenCoordinatesX(this.bounds.min.x - circleRadiusOsuPx);
        let screenY = gameState.currentPlay.toScreenCoordinatesY(this.bounds.min.y - circleRadiusOsuPx);

        if (this.hasFullscreenBaseSprite) this.baseSprite.position.set(0, 0);
        else this.baseSprite.position.set(screenX, screenY);
    }

    update(currentTime: number) {
        let { approachTime, activeMods } = gameState.currentPlay;

        if (currentTime > this.parent.endTime + HIT_OBJECT_FADE_OUT_TIME) {
            this.renderFinished = true;
            return;
        }

        if (this.parent.specialBehavior === SpecialSliderBehavior.Invisible) return;

        this.updateHeadElements(currentTime);
        
        let hasHidden = activeMods.has(Mod.Hidden);
        let fadeInCompletion = this.head.getFadeInCompletion(currentTime, hasHidden);
        let fadeOutCompletion = (currentTime - (this.parent.endTime)) / HIT_OBJECT_FADE_OUT_TIME;
        fadeOutCompletion = MathUtil.clamp(fadeOutCompletion, 0, 1);
        fadeOutCompletion = MathUtil.ease(EaseType.EaseOutQuad, fadeOutCompletion);

        if (hasHidden) {
            let bodyFadeOutCompletion = (currentTime - (this.parent.startTime - 2/3 * approachTime)) / (this.parent.duration + 2/3 * approachTime); // Slider body fades from from the millisecond the fade in is complete to the end of the slider
            bodyFadeOutCompletion = MathUtil.clamp(bodyFadeOutCompletion, 0, 1);
            bodyFadeOutCompletion = MathUtil.ease(EaseType.EaseOutQuad, bodyFadeOutCompletion);

            this.baseSprite.alpha = fadeInCompletion * (1 - bodyFadeOutCompletion);
        } else {
            if (currentTime < this.parent.endTime) this.baseSprite.alpha = fadeInCompletion;
            else this.baseSprite.alpha = 1 - fadeOutCompletion;
        }

        if (currentTime < this.parent.endTime) this.overlayContainer.alpha = fadeInCompletion;
        else this.overlayContainer.alpha = 1 - fadeOutCompletion;

        this.updateSliderBody(currentTime);
        this.updateSubelements(currentTime);
    }

    remove() {
        if (this.parent.specialBehavior === SpecialSliderBehavior.Invisible) return;

        super.remove();

        mainHitObjectContainer.removeChild(this.baseSprite);
        mainHitObjectContainer.removeChild(this.container);
        for (let i = 0; i < this.sliderEnds.length; i++) {
            mainHitObjectContainer.removeChild(this.sliderEnds[i].container);
        }

        // CLEAN UP THAT DARN VRAM! GIMME VRAM!
        this.baseSprite.texture.destroy(true);
        this.sliderBodyMesh.geometry.dispose();
        this.sliderBodyMesh.destroy();
    }

    beginSliderSlideSound() {
        if (this.parent.specialBehavior === SpecialSliderBehavior.Invisible) return;

        for (let i = 0; i < this.slideEmitters.length; i++) {
            this.slideEmitters[i].start();
        }
    }

    stopSliderSlideSound() {
        for (let i = 0; i < this.slideEmitters.length; i++) {
            this.slideEmitters[i].stop();
        }
    }

    holdFollowCircle(time: number) {
        if (this.followCircleHoldStartTime !== null) return;

        this.followCircleHoldStartTime = Math.max(this.parent.startTime, time);
        this.followCircleReleaseStartTime = null;
        this.followCirclePulseStartTime = null;
    }
    
    releaseFollowCircle(time: number) {
        if (this.followCircleReleaseStartTime !== null || time >= this.parent.endTime) return;

        this.followCircleHoldStartTime = null;
        this.followCircleReleaseStartTime = time;
    }

    pulseFollowCircle(time: number) {
        if (time >= this.parent.endTime) return;

        this.followCirclePulseStartTime = time;
    }

    score(time: number) {
        let resultingRawScore = 0;

        if (this.parent.specialBehavior === SpecialSliderBehavior.Invisible) {
            if (this.scoring.head.hit) resultingRawScore = 300;
        } else {
            let total = 0;
            if (this.scoring.head.hit !== ScoringValue.Miss) total++;
            if (this.scoring.end) total++;
            total += this.scoring.ticks;
            total += this.scoring.repeats;
    
            let fraction = total / (2 + this.parent.tickCompletions.length + (this.parent.repeat - 1));
            assert(fraction >= 0 && fraction <= 1);
    
            resultingRawScore = (() => {
                if (fraction === 1) {
                    return 300;
                } else if (fraction >= 0.5) {
                    return 100;
                } else if (fraction > 0) {
                    return 50;
                }
                return 0;
            })();
        }

        if (this.scoring.end || resultingRawScore === 300) gameState.currentGameplaySkin.playHitSound(last(this.hitSounds)); // Play the slider end hitsound. 

        gameState.currentPlay.scoreCounter.add(resultingRawScore, false, false, true, this, time);
    }

    hitHead(time: number, judgementOverride?: number) {
        if (this.scoring.head.hit !== ScoringValue.NotHit) return;
        
        let { scoreCounter } = gameState.currentPlay;

        let timeInaccuracy = time - this.parent.startTime;
        let judgement: number;

        if (judgementOverride !== undefined) {
            judgement = judgementOverride;
        } else {
            let hitDelta = Math.abs(timeInaccuracy);
            judgement = this.parent.processedBeatmap.difficulty.getJudgementForHitDelta(hitDelta);
        }

        this.scoring.head.hit = judgement;
        this.scoring.head.time = time;

        let score = (judgement === ScoringValue.Miss)? 0 : ScoringValue.SliderHead;

        scoreCounter.add(score, true, true, false, this, time);
        if (judgement !== 0) {
            gameState.currentGameplaySkin.playHitSound(this.hitSounds[0]);
            accuracyMeter.addAccuracyLine(timeInaccuracy, time);
            this.holdFollowCircle(time);
        }
        // The if here is because not all sliders have heads, like edge-case invisible sliders.
        if (this.head) HitCirclePrimitive.fadeOutBasedOnHitState(this.head, time, judgement !== 0);
    }

    private getLowestTickCompletionFromCurrentRepeat(completion: number) {
        let currentRepeat = Math.floor(completion);
        for (let i = 0; i < this.parent.tickCompletions.length; i++) {
            if (this.parent.tickCompletions[i] > currentRepeat) {
                return this.parent.tickCompletions[i];
            }
        }
    }

    private updateSliderBody(currentTime: number) {
        let { approachTime } = gameState.currentPlay;

        let snakeCompletion: number;
        if (SLIDER_SETTINGS.snaking) {
            snakeCompletion = (currentTime - (this.parent.startTime - approachTime)) / (approachTime/3); // Snaking takes 1/3 the approach time
            snakeCompletion = MathUtil.clamp(snakeCompletion, 0, 1);
        } else {
            snakeCompletion = 1.0;
        }

        let doRender = !this.sliderBodyHasBeenRendered;
        let renderTex = this.baseSprite.texture as PIXI.RenderTexture;
        let gl = renderer.state.gl;

        if (this.lastGeneratedSnakingCompletion < snakeCompletion) {
            let newBounds = this.parent.path.updateGeometry(this.sliderBodyMesh.geometry, snakeCompletion, this.hasFullscreenBaseSprite);
            this.sliderBodyMesh.size = this.parent.path.currentVertexCount;
            this.lastGeneratedSnakingCompletion = snakeCompletion;

            if (this.hasFullscreenBaseSprite) {
                let transformationMatrix = createSliderBodyTransformationMatrix(this, newBounds);
                this.sliderBodyMesh.shader.uniforms.matrix = transformationMatrix; // Update the matrix uniform
            }

            doRender = true;
        }

        if (!doRender) return;

        // Blending here needs to be done manually 'cause, well, reasons. lmao
        // INSANE hack:
        gl.disable(gl.BLEND);
        renderer.render(this.sliderBodyMesh, renderTex);
        gl.enable(gl.BLEND);

        this.sliderBodyHasBeenRendered = true;
    }

    calculateCompletionAtTime(time: number) {
        let sliderTime = time - this.parent.hitObject.time;
        let completion = (this.parent.velocity * sliderTime) / this.parent.length;
        completion = MathUtil.clamp(completion, 0, this.parent.repeat);

        return completion;
    }

    private updateSubelements(currentTime: number) {
        let completion = this.calculateCompletionAtTime(currentTime);
        let currentSliderTime = currentTime - this.parent.hitObject.time;

        this.updateSliderEnds(currentTime);
        this.updateSliderBall(completion, currentTime);
        if (this.parent.tickCompletions.length > 0) this.updateSliderTicks(completion, currentSliderTime);
    }

    private updateSliderEnds(currentTime: number) {
        for (let i = 0; i < this.sliderEnds.length; i++) {
            let sliderEnd = this.sliderEnds[i];
            sliderEnd.update(currentTime);
        }
    }

    private updateSliderBall(completion: number, currentTime: number) {
        if (completion === 0) return;

        let sliderBallPos = gameState.currentPlay.toScreenCoordinates(this.parent.path.getPosFromPercentage(MathUtil.mirror(completion)), false);

        if (currentTime < this.parent.endTime) {
            let baseElement = this.sliderBall.base.sprite;

            this.sliderBall.container.visible = true;
            this.sliderBall.container.position.set(sliderBallPos.x, sliderBallPos.y);
            baseElement.rotation = this.parent.path.getAngleFromPercentage(MathUtil.mirror(completion));

            let osuTex = gameState.currentGameplaySkin.textures["sliderBall"];
            let frameCount = osuTex.getAnimationFrameCount();
            if (frameCount > 1) {
                let velocityRatio = Math.min(1, MAX_SLIDER_BALL_SLIDER_VELOCITY/this.parent.velocity);
                let rolledDistance = this.parent.length * velocityRatio * MathUtil.mirror(completion);
                let radians = rolledDistance / 15;
                let currentFrame = Math.floor(frameCount * (radians % (Math.PI/2) / (Math.PI/2))); // TODO: Is this correct for all skins?

                this.sliderBall.base.setFrame(currentFrame);
            }

            if (gameState.currentGameplaySkin.config.general.sliderBallFlip) {
                // Flip the scale when necessary
                if      (completion % 2 <= 1 && baseElement.scale.x < 0) baseElement.scale.x *= -1;
                else if (completion % 2 > 1  && baseElement.scale.x > 0) baseElement.scale.x *= -1;
            }
        } else {
            // The slider ball disappears upon slider completion
            this.sliderBall.container.visible = false;
        }

        this.followCircle.visible = true;
        this.followCircle.position.set(sliderBallPos.x, sliderBallPos.y);

        let followCircleSizeFactor = 0.0;
        let followCircleAlpha = 1.0;

        if (this.followCircleReleaseStartTime !== null) {
            let releaseCompletion = (currentTime - this.followCircleReleaseStartTime) / FOLLOW_CIRCLE_RELEASE_DURATION;
            releaseCompletion = MathUtil.clamp(releaseCompletion, 0, 1);

            // This condition is false when the slider was released right when it began, aka wasn't held when it began. In that case, the follow circle stays hidden :thinking:
            if (this.followCircleReleaseStartTime > this.parent.startTime) {
                followCircleSizeFactor = MathUtil.lerp(1, 2, releaseCompletion);
            }
            followCircleAlpha = 1 - releaseCompletion;
        } else if (this.followCircleHoldStartTime !== null) {
            let enlargeCompletion = (currentTime - this.followCircleHoldStartTime) / FOLLOW_CIRCLE_SCALE_IN_DURATION;
            enlargeCompletion = MathUtil.clamp(enlargeCompletion, 0, 1);
            enlargeCompletion = MathUtil.ease(EaseType.EaseOutQuad, enlargeCompletion);

            followCircleSizeFactor += MathUtil.lerp(0.5, 1.0, enlargeCompletion);
            followCircleAlpha = enlargeCompletion;

            if (this.followCirclePulseStartTime !== null) {
                let pulseFactor = (currentTime - this.followCirclePulseStartTime) / FOLLOW_CIRCLE_PULSE_DURATION;
                pulseFactor = MathUtil.clamp(pulseFactor, 0, 1);
                pulseFactor = 1 - MathUtil.ease(EaseType.EaseOutQuad, pulseFactor);
                pulseFactor *= 0.10;

                followCircleSizeFactor += pulseFactor;
            }

            let shrinkCompletion = (currentTime - this.parent.endTime) / FOLLOW_CIRCLE_SCALE_OUT_DURATION;
            shrinkCompletion = MathUtil.clamp(shrinkCompletion, 0, 1);
            shrinkCompletion = MathUtil.ease(EaseType.EaseOutQuad, shrinkCompletion);

            followCircleSizeFactor *= MathUtil.lerp(1, 0.75, shrinkCompletion); // Shrink on end, to 0.75x
        }

        this.followCircle.scale.set(followCircleSizeFactor);
        this.followCircle.alpha = followCircleAlpha;

        if (this.followCircleAnimator) this.followCircleAnimator.update(currentTime);
    }

    private updateSliderTicks(completion: number, currentSliderTime: number) {
        let { approachTime, activeMods } = gameState.currentPlay;

        let lowestTickCompletionFromCurrentRepeat = this.getLowestTickCompletionFromCurrentRepeat(completion);
        let currentCycle = Math.floor(completion);
        let hasHidden = activeMods.has(Mod.Hidden);

        for (let i = 0; i < this.tickElements.length; i++) {
            let tickElement = this.tickElements[i];
            if (tickElement === null) continue; // Meaning: The tick is hidden

            let tickCompletionIndex = this.tickElements.length * currentCycle;
            if (currentCycle % 2 === 0) {
                tickCompletionIndex += i;
            } else {
                tickCompletionIndex += this.tickElements.length - 1 - i;
            }
            let tickCompletion = this.parent.tickCompletions[tickCompletionIndex];
            if (tickCompletion === undefined) continue;

            if (tickCompletion <= completion) {
                tickElement.visible = false;
                continue;
            } else {
                tickElement.visible = true;
            }
            
            // The currentSliderTime at the beginning of the current repeat cycle
            let msPerRepeatCycle = this.parent.duration / this.parent.repeat;
            let currentRepeatTime = currentCycle * msPerRepeatCycle;
            // The time the tick should have fully appeared (animation complete), relative to the current repeat cycle
            // Slider velocity here is doubled, meaning the ticks appear twice as fast as the slider ball moves.
            let relativeTickTime = ((tickCompletion - lowestTickCompletionFromCurrentRepeat) * this.parent.length / (this.parent.velocity * 2)) + SLIDER_TICK_APPEARANCE_ANIMATION_DURATION;
            // Sum both up to get the timing of the tick relative to the beginning of the whole slider:
            let tickTime = currentRepeatTime + relativeTickTime;
            
            // If we're in the first cycle, slider ticks appear a certain duration earlier. Experiments have lead to the value being subtracted here:
            if (currentCycle === 0) {
                tickTime -= approachTime * 2/3 - 100;
            }

            let animationStart = tickTime - SLIDER_TICK_APPEARANCE_ANIMATION_DURATION;
            let animationCompletion = (currentSliderTime - animationStart) / SLIDER_TICK_APPEARANCE_ANIMATION_DURATION;
            animationCompletion = MathUtil.clamp(animationCompletion, 0, 1);

            // Creates a bouncing scaling effect.
            let parabola = (-1.875 * animationCompletion*animationCompletion + 2.875 * animationCompletion);

            if (animationCompletion === 0) parabola = 0;
            if (animationCompletion >= 1) parabola = 1;

            tickElement.scale.set(parabola);

            // With HD, ticks start fading out shortly before they're supposed to be picked up. By the time they are picked up, they will have reached opacity 0.
            if (hasHidden) {
                let tickPickUpTime = tickCompletion * this.parent.length / this.parent.velocity;
                let fadeOutCompletion = (currentSliderTime - (tickPickUpTime - HIDDEN_TICK_FADE_OUT_DURATION)) / HIDDEN_TICK_FADE_OUT_DURATION;
                fadeOutCompletion = MathUtil.clamp(fadeOutCompletion, 0, 1);

                tickElement.alpha = 1 - fadeOutCompletion;
            }
        }
    }
}

class SliderBall {
    public container: PIXI.Container;
    public base: AnimatedOsuSprite;
    public background: PIXI.Container;
    public spec: PIXI.Container;

    constructor(slider: DrawableSlider) {
        let { headedHitObjectTextureFactor } = gameState.currentPlay;

        this.container = new PIXI.Container();
        let baseElement: PIXI.Container;

        let osuTexture = gameState.currentGameplaySkin.textures["sliderBall"];

        this.base = new AnimatedOsuSprite(osuTexture, headedHitObjectTextureFactor);
        let baseSprite = this.base.sprite;
        baseElement = baseSprite;

        if (gameState.currentGameplaySkin.config.general.allowSliderBallTint) baseSprite.tint = colorToHexNumber(slider.color);
        else baseSprite.tint = colorToHexNumber(gameState.currentGameplaySkin.config.colors.sliderBall);

        if (!osuTexture.hasActualBase()) {
            let bgTexture = gameState.currentGameplaySkin.textures["sliderBallBg"];

            if (!bgTexture.isEmpty()) {
                let sprite = new PIXI.Sprite();
                sprite.anchor.set(0.5, 0.5);
                sprite.tint = 0x000000; // Always tinted black.

                bgTexture.applyToSprite(sprite, headedHitObjectTextureFactor);

                this.background = sprite;
            }
        }

        let specTexture = gameState.currentGameplaySkin.textures["sliderBallSpec"];
        if (!specTexture.isEmpty()) {
            let sprite = new PIXI.Sprite();
            sprite.anchor.set(0.5, 0.5);
            sprite.blendMode = PIXI.BLEND_MODES.ADD;

            specTexture.applyToSprite(sprite, headedHitObjectTextureFactor);

            this.spec = sprite;
        }

        if (this.background) this.container.addChild(this.background);
        this.container.addChild(baseElement);
        if (this.spec) this.container.addChild(this.spec);
    }
}