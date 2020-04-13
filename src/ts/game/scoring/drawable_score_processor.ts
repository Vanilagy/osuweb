import { ScoreProcessor } from "../../datamodel/scoring/score_processor";
import { Play } from "../play";
import { InterpolatedValueChanger, Interpolator } from "../../util/interpolation";
import { EaseType, MathUtil } from "../../util/math_util";
import { Judgement } from "../../datamodel/scoring/judgement";
import { ScoringValue } from "../../datamodel/scoring/score";
import { DrawableJudgement } from "./drawable_judgement";
import { SkinSoundType } from "../skin/skin";

interface DelayedVisualComboIncrease {
	time: number,
	value: number
}

export class DrawableScoreProcessor extends ScoreProcessor {
	public play: Play;

	private scoreInterpolator: InterpolatedValueChanger;
	private accuracyInterpolator: InterpolatedValueChanger;
	private phantomComboAnimationInterpolator: Interpolator;
	private comboAnimationInterpolator: Interpolator;
	public delayedVisualComboIncreases: DelayedVisualComboIncrease[]; // For the combo display, which actually shows the change in combo a bit later. Just look at it and you'll know what I'm talking about.

	private drawableJudgements: DrawableJudgement[];

	constructor(play: Play) {
		super();

		this.play = play;

		this.scoreInterpolator = new InterpolatedValueChanger({
			initial: 0,
			duration: (distanceToGoal: number) => {
				// Quick animation for small score increases, like slider ticks
				if (distanceToGoal <= 30) return 110;
				return 500;
			},
			ease: EaseType.EaseOutCubic
		});
		this.accuracyInterpolator = new InterpolatedValueChanger({
			initial: 1,
			duration: 250,
			ease: EaseType.EaseOutQuad
		});
		this.phantomComboAnimationInterpolator = new Interpolator({
			ease: EaseType.Linear,
			duration: 500,
			defaultToFinished: true
		});
		this.comboAnimationInterpolator = new Interpolator({
			ease: EaseType.Linear,
			duration: 250,
			defaultToFinished: true
		});
	}

	process(judgement: Judgement, record = false) {
		super.process(judgement, record);

		let adjustedTime = this.play.toPlaybackRateIndependentTime(judgement.time);

		if (judgement.affectsCombo && judgement.value !== ScoringValue.Miss) {
			this.phantomComboAnimationInterpolator.start(adjustedTime);
			this.delayedVisualComboIncreases.push({time: adjustedTime, value: this.currentCombo});
		}
		
		this.scoreInterpolator.setGoal(this.score.points, adjustedTime);
		this.accuracyInterpolator.setGoal(this.score.accuracy, adjustedTime);

		if (judgement.isDrawable()) this.addDrawableJudgement(new DrawableJudgement(this, judgement));

		if (judgement.hitObject.comboInfo.isLast) {
			// Update the storyboard's game state to switch between Passing and Failing
			this.play.controller.currentStoryboard?.setGameState(judgement.geki? "Pass" : "Fail", judgement.time);
		}
	}

	addDrawableJudgement(drawable: DrawableJudgement) {
		this.drawableJudgements.push(drawable);
		drawable.show();
	}

	break(time: number) {
		if (this.currentCombo === 0) return;

		if (this.currentCombo >= 50) {
			this.play.skin.sounds[SkinSoundType.ComboBreak].start(0);
		}

		let adjustedTime = this.play.toPlaybackRateIndependentTime(time);
		this.phantomComboAnimationInterpolator.start(adjustedTime);
		this.delayedVisualComboIncreases.push({time: adjustedTime, value: this.currentCombo});

		super.break(time);
	}

	compose() {
		for (let i = 0; i < this.drawableJudgements.length; i++) {
			this.drawableJudgements[i].compose();
		}
	}

	update(currentTime: number) {
		const hud = this.play.controller.hud;

		// Update drawable judgements
		for (let i = 0; i < this.drawableJudgements.length; i++) {
			let drawable = this.drawableJudgements[i];

			drawable.update(currentTime);

			if (drawable.renderingFinished) {
				drawable.remove();
				this.drawableJudgements.splice(i, 1);
				i--;
			}
		}

		let adjustedTime = this.play.toPlaybackRateIndependentTime(currentTime);

		hud.scoreDisplay.setValue(Math.floor(this.scoreInterpolator.getCurrentValue(adjustedTime)));

		hud.phantomComboDisplay.setValue(this.currentCombo);
		let phantomComboAnimCompletion = this.phantomComboAnimationInterpolator.getCurrentValue(adjustedTime);
		let phantomComboScale = MathUtil.lerp(1.5, 1, MathUtil.ease(EaseType.EaseOutCubic, phantomComboAnimCompletion));
		hud.phantomComboDisplay.container.scale.set(phantomComboScale);
		hud.phantomComboDisplay.container.alpha = 0.666 * (1 - phantomComboAnimCompletion);

		let comboAnimCompletion = this.comboAnimationInterpolator.getCurrentValue(adjustedTime);
		let parabola = -4 * comboAnimCompletion**2 + 4 * comboAnimCompletion;
		hud.comboDisplay.container.scale.set(1 + parabola * 0.08);

		let nextDelayedComboIncrease = this.delayedVisualComboIncreases[0];
		while (nextDelayedComboIncrease && adjustedTime >= nextDelayedComboIncrease.time + 150) {
			this.comboAnimationInterpolator.start(nextDelayedComboIncrease.time);
			hud.comboDisplay.setValue(nextDelayedComboIncrease.value);

			this.delayedVisualComboIncreases.shift();
			nextDelayedComboIncrease = this.delayedVisualComboIncreases[0];
		}

		hud.accuracyDisplay.setValue(this.accuracyInterpolator.getCurrentValue(adjustedTime) * 100);
	}

	reset() {
		super.reset();

		if (this.drawableJudgements) {
			for (let drawable of this.drawableJudgements) {
				drawable.remove();
			}
		}
		this.drawableJudgements = [];

		const hud = this.play.controller.hud;
		hud.scoreDisplay.setValue(0);
		hud.accuracyDisplay.setValue(100);
		hud.phantomComboDisplay.setValue(0);
		hud.comboDisplay.setValue(0);

		this.scoreInterpolator.reset(0);
		this.accuracyInterpolator.reset(1);
		this.phantomComboAnimationInterpolator.reset();
		this.comboAnimationInterpolator.reset();

		this.delayedVisualComboIncreases = [];
	}
}