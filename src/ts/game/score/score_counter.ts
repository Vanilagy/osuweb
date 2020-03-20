import { MathUtil, EaseType } from "../../util/math_util";
import { assert } from "../../util/misc_util";
import { Point } from "../../util/point";
import { DrawableHitObject } from "../drawables/drawable_hit_object";
import { ModHelper } from "../mods/mod_helper";
import { transferBasicProperties, transferBasicSpriteProperties } from "../../util/pixi_util";
import { OsuSoundType } from "../skin/sound";
import { AnimatedOsuSprite } from "../skin/animated_sprite";
import { OsuTexture } from "../skin/texture";
import { ParticleEmitter, DistanceDistribution } from "../../visuals/particle_emitter";
import { ProcessedBeatmap } from "../../datamodel/processed/processed_beatmap";
import { InterpolatedValueChanger, Interpolator } from "../../util/interpolation";
import { Play } from "../play";
import { Score, ScoringValue } from "../../datamodel/score";
import { ScorePopupType, hitJudgementToScorePopupType, ScorePopup } from "./score_popup";

interface DelayedVisualComboIncrease {
	time: number,
	value: number
}

export class ScoreCounter {
	public play: Play;
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

	constructor(play: Play, processedBeatmap: ProcessedBeatmap) {
		this.play = play;
		this.processedBeatmap = processedBeatmap;
	}

	init() {
		this.score = new Score();
		this.score.mods = this.play.activeMods; // dis fine?

		this.difficultyMultiplier = this.processedBeatmap.beatmap.difficulty.calculateDifficultyMultiplier(); // Get the difficulty from the beatmap, not the processed beatmap, because: "Note that game modifiers (like Hard Rock/Easy) will not change the Difficulty multiplier. It will only account for original values only."
		this.modMultiplier = ModHelper.calculateModMultiplier(this.play.activeMods);
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

		this.play.gainHealth(rawAmount/300 * 0.2, time);

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
			
			let popup = new ScorePopup(this, scorePopupType, hitObject.parent.endPoint, time);
			this.play.addScorePopup(popup);
		}
	}

	addHitInaccuracy(timeInaccuracy: number) {
		this.score.hitInaccuracies.push(timeInaccuracy);
	}

	addSpinRpm(rpm: number) {
		this.score.spinRpms.push(rpm);
	}

	break(time: number) {
		if (this.currentCombo === 0) return;

		if (this.currentCombo >= 50) {
			this.play.skin.sounds[OsuSoundType.ComboBreak].play(100);
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
		const hud = this.play.controller.hud;

		hud.scoreDisplay.setValue(Math.floor(scoreInterpolator.getCurrentValue(currentTime)));

		hud.phantomComboDisplay.setValue(this.currentCombo);
		let phantomComboAnimCompletion = phantomComboAnimationInterpolator.getCurrentValue(currentTime);
		let phantomComboScale = MathUtil.lerp(1.5, 1, MathUtil.ease(EaseType.EaseOutCubic, phantomComboAnimCompletion));
		hud.phantomComboDisplay.container.scale.set(phantomComboScale);
		hud.phantomComboDisplay.container.alpha = 0.666 * (1 - phantomComboAnimCompletion);

		let comboAnimCompletion = comboAnimationInterpolator.getCurrentValue(currentTime);
		let parabola = -4 * comboAnimCompletion**2 + 4 * comboAnimCompletion;
		hud.comboDisplay.container.scale.set(1 + parabola * 0.08);

		let nextDelayedComboIncrease = this.delayedVisualComboIncreases[0];
		while (nextDelayedComboIncrease && currentTime >= nextDelayedComboIncrease.time + 150) {
			comboAnimationInterpolator.start(nextDelayedComboIncrease.time);
			hud.comboDisplay.setValue(nextDelayedComboIncrease.value);

			this.delayedVisualComboIncreases.shift();
			nextDelayedComboIncrease = this.delayedVisualComboIncreases[0];
		}

		hud.accuracyDisplay.setValue(accuracyInterpolator.getCurrentValue(currentTime) * 100);
	}

	reset() {
		const hud = this.play.controller.hud;

		this.delayedVisualComboIncreases = [];

		this.currentCombo = 0;
		// These are used to calculate accuracy:
		this.totalNumberOfHits = 0;
		this.totalValueOfHits = 0;

		this.score.reset();

		this.resetGekiAndKatu();

		hud.scoreDisplay.setValue(0);
		hud.accuracyDisplay.setValue(100);
		hud.phantomComboDisplay.setValue(0);
		hud.comboDisplay.setValue(0);

		scoreInterpolator.reset(0);
		accuracyInterpolator.reset(1);
		phantomComboAnimationInterpolator.reset();
		comboAnimationInterpolator.reset();
	}
}

let scoreInterpolator = new InterpolatedValueChanger({
	initial: 0,
	duration: (distanceToGoal: number) => {
		// Quick animation for small score increases, like slider ticks
		if (distanceToGoal <= 30) return 110;
		return 500;
	},
	ease: EaseType.EaseOutCubic
});

let accuracyInterpolator = new InterpolatedValueChanger({
	initial: 1,
	duration: 250,
	ease: EaseType.EaseOutQuad
});

let phantomComboAnimationInterpolator = new Interpolator({
	ease: EaseType.Linear,
	duration: 500,
	defaultToFinished: true
});
phantomComboAnimationInterpolator.end();

let comboAnimationInterpolator = new Interpolator({
	ease: EaseType.Linear,
	duration: 250,
	defaultToFinished: true
});