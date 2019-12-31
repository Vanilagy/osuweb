import { MathUtil, EaseType } from "../util/math_util";
import { scoreDisplay, phantomComboDisplay, accuracyDisplay, comboDisplay } from "./hud/hud";
import { assert } from "../util/misc_util";
import { InterpolatedCounter, Interpolator } from "../util/graphics_util";
import { gameState } from "./game_state";
import { Point } from "../util/point";
import { lowerScorePopupContainer, upperScorePopupContainer } from "../visuals/rendering";
import { DrawableHitObject } from "./drawables/drawable_hit_object";
import { ModHelper } from "./mods/mod_helper";
import { ScoringValue } from "./scoring_value";
import { transferBasicProperties, transferBasicSpriteProperties } from "../util/pixi_util";
import { OsuSoundType } from "./skin/sound";
import { AnimatedOsuSprite } from "./skin/animated_sprite";
import { OsuTexture } from "./skin/texture";
import { ParticleEmitter, DistanceDistribution } from "../visuals/particle_emitter";
import { ProcessedBeatmap } from "../datamodel/processed/processed_beatmap";

const SCORE_POPUP_APPEARANCE_TIME = 150; // Both in ms
const SCORE_POPUP_FADE_OUT_TIME = 1000;
const SCORE_POPUP_SECOND_CONTAINER_FADE_OUT_TIME = 250; // In ms
const MISS_POPUP_DROPDOWN_ACCERELATION = 0.00009; // in osu!pixels per ms^2
const SCORE_POPUP_GRADUAL_SCALE_UP_AMOUNT = 0.12;

export class Score {
    public points: number;
    public accuracy: number;
    public hits300: number;
    public hits100: number;
    public hits50: number;
    public misses: number;
    public geki: number; // Now, some smartass out there is gonna argue that it should be "gekis" and "katus". I'mma be the bigger smartass here and argue that, since these are Japanese words and Japanese does not have plural, these are correct.
    public katu: number;
    public maxCombo: number;

    constructor() {
        this.points = 0;
        this.accuracy = 1;

        this.hits300 = 0;
        this.hits100 = 0;
        this.hits50 = 0;
        this.misses = 0;
        this.geki = 0;
        this.katu = 0;
        this.maxCombo = 0;
    }
}

interface DelayedVisualComboIncrease {
    time: number,
    value: number
}

export class ScoreCounter {
    public processedBeatmap: ProcessedBeatmap;
    public delayedVisualComboIncreases: DelayedVisualComboIncrease[]; // For the combo display, which actually shows the change in combo a bit later. Just look at it and you'll know what I'm talking about.
    public score: Score;

    public currentCombo: number;
    private isGeki: boolean;
    private isKatu: boolean;

    private totalNumberOfHits: number;
    private totalValueOfHits: number;
    private difficultyMultiplier: number;
    private modMultiplier: number;

    constructor(processedBeatmap: ProcessedBeatmap) {
        this.processedBeatmap = processedBeatmap;
    }

    init() {
        this.score = new Score();
        this.delayedVisualComboIncreases = [];

        this.currentCombo = 0;
        // These are used to calculate accuracy:
        this.totalNumberOfHits = 0;
        this.totalValueOfHits = 0;

        this.difficultyMultiplier = this.processedBeatmap.beatmap.difficulty.calculateDifficultyMultiplier(); // Get the difficulty from the beatmap, not the processed beatmap, because: "Note that game modifiers (like Hard Rock/Easy) will not change the Difficulty multiplier. It will only account for original values only."
        this.modMultiplier = ModHelper.calculateModMultiplier(gameState.currentPlay.activeMods);

        this.resetGekiAndKatu();

        scoreDisplay.setValue(0);
        accuracyDisplay.setValue(100);
        phantomComboDisplay.setValue(0);
        comboDisplay.setValue(0);
    }

    /**
     * 
     * @param raw Determines if the amount should be added to the score in its raw form, ignoring any multipliers. If this is false, it additionally creates a score popup.
     */
    add(rawAmount: number, raw: boolean, affectCombo: boolean, affectAccuracy: boolean, hitObject: DrawableHitObject, time: number) {
        if (affectAccuracy) {
            this.totalNumberOfHits++;
            this.totalValueOfHits += rawAmount;
        }

        let effectiveCombo = Math.max(0, this.currentCombo - 1);

        let scoreGain = rawAmount;
        if (!raw) scoreGain = rawAmount + (rawAmount * (effectiveCombo * this.difficultyMultiplier * this.modMultiplier) / 25);
        scoreGain = Math.floor(scoreGain); // Especially with a mod multiplier, gain can be decimal, so floor here.

        this.score.points += scoreGain;

        if (affectCombo) {
            if (rawAmount === 0) { // Meaning miss
                this.break(time);
            } else {
                this.currentCombo++;
                if (this.currentCombo > this.score.maxCombo) this.score.maxCombo = this.currentCombo;

                phantomComboAnimationInterpolator.start(time);
                this.delayedVisualComboIncreases.push({time: time, value: this.currentCombo});
            }
        }

        scoreInterpolator.setGoal(this.score.points, time);
        this.score.accuracy = this.calculateAccuracy();
        accuracyInterpolator.setGoal(this.score.accuracy, time);

        gameState.currentPlay.gainHealth(rawAmount/300 * 0.2, time);

        if (!raw) {
            if (rawAmount === ScoringValue.Hit300) this.score.hits300++;
            else if (rawAmount === ScoringValue.Hit100) this.score.hits100++;
            else if (rawAmount === ScoringValue.Hit50) this.score.hits50++;
            else this.score.misses++;

            if (rawAmount !== ScoringValue.Hit300) {
                this.isGeki = false;

                if (rawAmount !== ScoringValue.Hit100) {
                    this.isKatu = false;
                }
            }

            let scorePopupType: ScorePopupType;
            if (hitObject.parent.comboInfo.isLast) {
                if (this.isGeki) {
                    this.score.geki++;

                    scorePopupType = ScorePopupType.Geki;
                }
                else if (this.isKatu) {
                    this.score.katu++;

                    if (rawAmount === ScoringValue.Hit300) scorePopupType = ScorePopupType.Katu300;
                    else scorePopupType = ScorePopupType.Katu100;
                }

                this.resetGekiAndKatu();
            }

            if (scorePopupType === undefined)
                scorePopupType = hitJudgementToScorePopupType.get(rawAmount);
            
            assert(scorePopupType !== undefined);
            
            let popup = new ScorePopup(scorePopupType, hitObject.parent.endPoint, time);
            gameState.currentPlay.addScorePopup(popup);
        }
    }

    break(time: number) {
        if (this.currentCombo === 0) return;

        if (this.currentCombo >= 50) {
            gameState.currentGameplaySkin.sounds[OsuSoundType.ComboBreak].play(100);
        }

        this.currentCombo = 0;
        phantomComboAnimationInterpolator.start(time);
        this.delayedVisualComboIncreases.push({time: time, value: this.currentCombo});
    }

    resetGekiAndKatu() {
        this.isGeki = true;
        this.isKatu = true;
    }

    calculateAccuracy() {
        if (this.totalNumberOfHits === 0) return 1; // 100.00% acc by default
        return this.totalValueOfHits / (this.totalNumberOfHits * 300);
    }

    updateDisplay(currentTime: number) {
        scoreDisplay.setValue(Math.floor(scoreInterpolator.getCurrentValue(currentTime)));

        phantomComboDisplay.setValue(this.currentCombo);
        let phantomComboAnimCompletion = phantomComboAnimationInterpolator.getCurrentValue(currentTime);
        let phantomComboScale = MathUtil.lerp(1.5, 1, MathUtil.ease(EaseType.EaseOutCubic, phantomComboAnimCompletion));
        phantomComboDisplay.container.scale.set(phantomComboScale);
        phantomComboDisplay.container.alpha = 0.666 * (1 - phantomComboAnimCompletion);

        let comboAnimCompletion = comboAnimationInterpolator.getCurrentValue(currentTime);
        let parabola = -4 * comboAnimCompletion**2 + 4 * comboAnimCompletion;
        comboDisplay.container.scale.set(1 + parabola * 0.08);

        let nextDelayedComboIncrease = this.delayedVisualComboIncreases[0];
        while (nextDelayedComboIncrease && currentTime >= nextDelayedComboIncrease.time + 150) {
            comboAnimationInterpolator.start(nextDelayedComboIncrease.time);
            comboDisplay.setValue(nextDelayedComboIncrease.value);

            this.delayedVisualComboIncreases.shift();
            nextDelayedComboIncrease = this.delayedVisualComboIncreases[0];
        }

        accuracyDisplay.setValue(accuracyInterpolator.getCurrentValue(currentTime) * 100);
    }
}

let scoreInterpolator = new InterpolatedCounter({
    initial: 0,
    duration: (distanceToGoal: number) => {
        // Quick animation for small score increases, like slider ticks
        if (distanceToGoal <= 30) return 110;
        return 500;
    },
    ease: EaseType.EaseOutCubic
});

let accuracyInterpolator = new InterpolatedCounter({
    initial: 1,
    duration: 250,
    ease: EaseType.EaseOutQuad
});

let phantomComboAnimationInterpolator = new Interpolator({
    ease: EaseType.Linear,
    duration: 500,
    from: 0,
	to: 1,
	defaultToFinished: true
});
phantomComboAnimationInterpolator.end();

let comboAnimationInterpolator = new Interpolator({
    ease: EaseType.Linear,
    duration: 250,
    from: 0,
	to: 1,
	defaultToFinished: true
});

enum ScorePopupType {
    Hit300,
    Hit100,
    Hit50,
    Miss,
    Geki, // Only 300s in the combo
    Katu300, // Only 100s or higher in the combo, but at least one 100 - last hit was 300
    Katu100 // Only 100s or higher in the combo, but at least one 100 - last hit was 100
}

let hitJudgementToScorePopupType = new Map<number, ScorePopupType>();
hitJudgementToScorePopupType.set(ScoringValue.Hit300, ScorePopupType.Hit300);
hitJudgementToScorePopupType.set(ScoringValue.Hit100, ScorePopupType.Hit100);
hitJudgementToScorePopupType.set(ScoringValue.Hit50, ScorePopupType.Hit50);
hitJudgementToScorePopupType.set(ScoringValue.Miss, ScorePopupType.Miss);

let scorePopupTypeToString = new Map<ScorePopupType, string>();
scorePopupTypeToString.set(ScorePopupType.Hit300, '300');
scorePopupTypeToString.set(ScorePopupType.Hit100, '100');
scorePopupTypeToString.set(ScorePopupType.Hit50, '50');
scorePopupTypeToString.set(ScorePopupType.Miss, 'X');
// ...and UTF-8 introduces itself:
scorePopupTypeToString.set(ScorePopupType.Geki, '激');
scorePopupTypeToString.set(ScorePopupType.Katu300, '喝');
scorePopupTypeToString.set(ScorePopupType.Katu100, '喝');

let scorePopupTypeToColor = new Map<ScorePopupType, string>();
scorePopupTypeToColor.set(ScorePopupType.Hit300, '#38b8e8');
scorePopupTypeToColor.set(ScorePopupType.Hit100, '#57e11a');
scorePopupTypeToColor.set(ScorePopupType.Hit50, '#d6ac52');
scorePopupTypeToColor.set(ScorePopupType.Miss, '#ff0000');
scorePopupTypeToColor.set(ScorePopupType.Geki, '#38b8e8'); // Same color as Hit300
scorePopupTypeToColor.set(ScorePopupType.Katu300, '#38b8e8'); // Same color as Hit300 and Geki
scorePopupTypeToColor.set(ScorePopupType.Katu100, '#57e11a'); // Same color as Hit100

let scorePopupTypeToJudgementValue = new Map<ScorePopupType, number>();
scorePopupTypeToJudgementValue.set(ScorePopupType.Hit300, 300);
scorePopupTypeToJudgementValue.set(ScorePopupType.Hit100, 100);
scorePopupTypeToJudgementValue.set(ScorePopupType.Hit50, 50);
scorePopupTypeToJudgementValue.set(ScorePopupType.Miss, 0);
scorePopupTypeToJudgementValue.set(ScorePopupType.Geki, 300);
scorePopupTypeToJudgementValue.set(ScorePopupType.Katu300, 300);
scorePopupTypeToJudgementValue.set(ScorePopupType.Katu100, 100);

export class ScorePopup {
    public container: PIXI.Container;
    public secondContainer: PIXI.Container; // Is shown ontop of all hit objects for a fraction of the total score popup time. That's just how it is!
    private secondSprite: PIXI.Sprite;

    private animatedSprite: AnimatedOsuSprite;
    private startTime: number = null;
    private osuPosition: Point;
    private type: ScorePopupType;
    public renderingFinished: boolean = false;
    private particleTexture: OsuTexture = null;
    private particleEmitter: ParticleEmitter;

    constructor(type: ScorePopupType, osuPosition: Point, startTime: number) {
        this.type = type;
        this.osuPosition = osuPosition;
        this.startTime = startTime;

        let currentPlay = gameState.currentPlay;
        let { headedHitObjectTextureFactor } = currentPlay;

        let textureName: string;
        switch (type) {
            case ScorePopupType.Miss: textureName = "hit0"; break;
            case ScorePopupType.Hit50: textureName = "hit50"; break;
            case ScorePopupType.Hit100: textureName = "hit100"; break;
            case ScorePopupType.Katu100: textureName = "hit100k"; break;
            case ScorePopupType.Hit300: textureName = "hit300"; break;
            case ScorePopupType.Katu300: textureName = "hit300k"; break;
            case ScorePopupType.Geki: textureName = "hit300g"; break;
        }
        let osuTexture = gameState.currentGameplaySkin.textures[textureName];

        let judgementValue = scorePopupTypeToJudgementValue.get(type);
        // Set the correct particle texture
        if (judgementValue === 50) this.particleTexture = gameState.currentGameplaySkin.textures["particle50"];
        else if (judgementValue === 100) this.particleTexture = gameState.currentGameplaySkin.textures["particle100"];
        else if (judgementValue === 300) this.particleTexture = gameState.currentGameplaySkin.textures["particle300"];

        let animatedSprite = new AnimatedOsuSprite(osuTexture, headedHitObjectTextureFactor);
        animatedSprite.loop = false;
        animatedSprite.setFps(60); // "Animation rate is fixed to 60 FPS."
        animatedSprite.play(startTime);
        this.animatedSprite = animatedSprite;

        let wrapper = new PIXI.Container();
        wrapper.addChild(animatedSprite.sprite);

        this.container = wrapper;

        let secondWrapper = new PIXI.Container();
        let secondSprite = new PIXI.Sprite();
        secondWrapper.addChild(secondSprite);
        secondSprite.blendMode = PIXI.BLEND_MODES.ADD;
        secondSprite.alpha = 0.6; // To not be too extreme
        this.secondContainer = secondWrapper;
        this.secondSprite = secondSprite;
        
        let screenCoordinates = currentPlay.toScreenCoordinates(osuPosition);
        this.container.position.set(screenCoordinates.x, screenCoordinates.y);

        if (type === ScorePopupType.Miss) {
            this.container.rotation = (2 * (Math.random() - 0.5)) * Math.PI * 0.05; // Random tilt for miss popup
        }

        transferBasicProperties(this.container, this.secondContainer);
        transferBasicSpriteProperties(this.animatedSprite.sprite, this.secondSprite);

        if (this.hasParticles()) {
            let emitter = new ParticleEmitter([this.particleTexture]);
            emitter.setTravelBehavior(0, 72, EaseType.Linear, DistanceDistribution.Normal);
            emitter.setLongevityBehavior(400, SCORE_POPUP_FADE_OUT_TIME);
            emitter.setAlphaBehavior(1, 0, EaseType.EaseInQuad);
            emitter.setScale(headedHitObjectTextureFactor);
            emitter.setBlendMode(PIXI.BLEND_MODES.ADD);
            emitter.container.position.copyFrom(this.container.position);

            emitter.emit(startTime, 170, 170);

            this.particleEmitter = emitter;
        }
    }

    private hasParticles() {
        return !!this.particleTexture && !this.particleTexture.isEmpty();
    }

    update(currentTime: number) {
        if (currentTime >= this.startTime + SCORE_POPUP_FADE_OUT_TIME) {
            this.renderingFinished = true;
            return;
        }

        let elapsedTime = currentTime - this.startTime;

        if (this.animatedSprite.getFrameCount() === 0) {
            // If the popup has no animation, animate it bouncing in:
            let appearanceCompletion = elapsedTime / SCORE_POPUP_APPEARANCE_TIME;
            appearanceCompletion = MathUtil.clamp(appearanceCompletion, 0, 1);
            appearanceCompletion = MathUtil.ease(EaseType.EaseOutElastic, appearanceCompletion, 0.55);

            let sizeFactor = appearanceCompletion;

            if (this.hasParticles()) {
                // If the popup has particles, apply an additional gradual scale-up animation:
                let gradualScaleUp = elapsedTime / SCORE_POPUP_FADE_OUT_TIME;
                sizeFactor += gradualScaleUp * SCORE_POPUP_GRADUAL_SCALE_UP_AMOUNT;
            }

            this.container.scale.set(sizeFactor);
        } else {
            this.animatedSprite.update(currentTime);
        }

        if (this.particleEmitter) this.particleEmitter.update(currentTime);

        let fadeOutCompletion = elapsedTime / SCORE_POPUP_FADE_OUT_TIME;
        fadeOutCompletion = MathUtil.clamp(fadeOutCompletion, 0, 1);
        fadeOutCompletion = MathUtil.ease(EaseType.EaseInQuart, fadeOutCompletion);
        
        this.container.alpha = 1 - fadeOutCompletion;

        if (this.type === ScorePopupType.Miss) {
            let droppedDistance = 0.5 * MISS_POPUP_DROPDOWN_ACCERELATION * elapsedTime**2; // s(t) = 0.5*a*t^2
            let osuY = this.osuPosition.y + droppedDistance;
            this.container.y = gameState.currentPlay.toScreenCoordinatesY(osuY, false);
        }

        transferBasicProperties(this.container, this.secondContainer);
        transferBasicSpriteProperties(this.animatedSprite.sprite, this.secondSprite);

        let secondContainerFadeOutCompletion = elapsedTime / SCORE_POPUP_SECOND_CONTAINER_FADE_OUT_TIME;
        secondContainerFadeOutCompletion = MathUtil.clamp(secondContainerFadeOutCompletion, 0, 1);
        secondContainerFadeOutCompletion = MathUtil.ease(EaseType.Linear, secondContainerFadeOutCompletion);

        this.secondContainer.alpha = 1 - secondContainerFadeOutCompletion;
    }

    show() {
        if (this.hasParticles()) {
            lowerScorePopupContainer.addChild(this.particleEmitter.container);
            lowerScorePopupContainer.addChild(this.container);
            upperScorePopupContainer.addChild(this.secondContainer);
        } else {
            upperScorePopupContainer.addChild(this.container);
        }
    }

    remove() {
		if (this.hasParticles()) {
            lowerScorePopupContainer.removeChild(this.particleEmitter.container);
            lowerScorePopupContainer.removeChild(this.container);
            upperScorePopupContainer.removeChild(this.secondContainer);
        } else {
            upperScorePopupContainer.removeChild(this.container);
        }
    }
}