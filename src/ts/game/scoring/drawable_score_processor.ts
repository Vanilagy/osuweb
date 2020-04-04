import { ScoreProcessor } from "../../datamodel/scoring/score_processor";
import { Play } from "../play";
import { InterpolatedValueChanger, Interpolator } from "../../util/interpolation";
import { EaseType, MathUtil } from "../../util/math_util";
import { Judgement } from "../../datamodel/scoring/judgement";
import { ScoringValue } from "../../datamodel/scoring/score";
import { OsuSoundType } from "../skin/sound";
import { DrawableJudgement } from "./drawable_judgement";

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

		if (judgement.affectsCombo && judgement.value !== ScoringValue.Miss) {
			this.phantomComboAnimationInterpolator.start(judgement.time);
			this.delayedVisualComboIncreases.push({time: judgement.time, value: this.currentCombo});
		}

		this.scoreInterpolator.setGoal(this.score.points, judgement.time);
		this.accuracyInterpolator.setGoal(this.score.accuracy, judgement.time);

		if (judgement.isDrawable()) this.addDrawableJudgement(new DrawableJudgement(this, judgement));
	}

	addDrawableJudgement(drawable: DrawableJudgement) {
		this.drawableJudgements.push(drawable);
		drawable.show();
	}

	break(time: number) {
		super.break(time);
		if (this.currentCombo === 0) return;

		if (this.currentCombo >= 50) {
			this.play.skin.sounds[OsuSoundType.ComboBreak].play(100);
		}

		this.currentCombo = 0;
		this.phantomComboAnimationInterpolator.start(time);
		this.delayedVisualComboIncreases.push({time: time, value: this.currentCombo});
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

		hud.scoreDisplay.setValue(Math.floor(this.scoreInterpolator.getCurrentValue(currentTime)));

		hud.phantomComboDisplay.setValue(this.currentCombo);
		let phantomComboAnimCompletion = this.phantomComboAnimationInterpolator.getCurrentValue(currentTime);
		let phantomComboScale = MathUtil.lerp(1.5, 1, MathUtil.ease(EaseType.EaseOutCubic, phantomComboAnimCompletion));
		hud.phantomComboDisplay.container.scale.set(phantomComboScale);
		hud.phantomComboDisplay.container.alpha = 0.666 * (1 - phantomComboAnimCompletion);

		let comboAnimCompletion = this.comboAnimationInterpolator.getCurrentValue(currentTime);
		let parabola = -4 * comboAnimCompletion**2 + 4 * comboAnimCompletion;
		hud.comboDisplay.container.scale.set(1 + parabola * 0.08);

		let nextDelayedComboIncrease = this.delayedVisualComboIncreases[0];
		while (nextDelayedComboIncrease && currentTime >= nextDelayedComboIncrease.time + 150) {
			this.comboAnimationInterpolator.start(nextDelayedComboIncrease.time);
			hud.comboDisplay.setValue(nextDelayedComboIncrease.value);

			this.delayedVisualComboIncreases.shift();
			nextDelayedComboIncrease = this.delayedVisualComboIncreases[0];
		}

		hud.accuracyDisplay.setValue(this.accuracyInterpolator.getCurrentValue(currentTime) * 100);
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