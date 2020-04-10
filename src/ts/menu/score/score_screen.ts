import { Beatmap } from "../../datamodel/beatmap";
import { ExtendedBeatmapData } from "../../util/beatmap_util";
import { currentWindowDimensions, REFERENCE_SCREEN_HEIGHT } from "../../visuals/ui";
import { InteractionGroup, InteractionRegistration } from "../../input/interactivity";
import { calculateRatioBasedScalingFactor, colorToHexNumber } from "../../util/graphics_util";
import { THEME_COLORS } from "../../util/constants";
import { scoreGradeTextures } from "../components/score_grade_icon";
import { ModIcon } from "../components/mod_icon";
import { MathUtil, EaseType } from "../../util/math_util";
import { BeatmapHeaderPanel } from "../components/beatmap_header_panel";
import { VirtualFile } from "../../file_system/virtual_file";
import { padNumberWithZeroes, toPercentageString, EMPTY_FUNCTION } from "../../util/misc_util";
import { ScoreGrade, Score } from "../../datamodel/scoring/score";
import { Interpolator } from "../../util/interpolation";
import { globalState } from "../../global_state";
import { Button, ButtonPivot, DEFAULT_BUTTON_WIDTH, DEFAULT_BUTTON_HEIGHT } from "../components/button";
import { AnimationParameterList, Animation, AnimationEvent, AnimationPlayer } from "../../util/animation";
import { modComparator } from "../../datamodel/mods";
import { KeyCode } from "../../input/input";
import { SkinSoundType } from "../../game/skin/skin";
import { Replay } from "../../game/replay";

const SCORE_SCREEN_WIDTH = 615;
const SCORE_SCREEN_HEIGHT = 342;
const SCORE_SCREEN_HEADER_HEIGHT = 95;
const SCORE_SCREEN_HEADER_MARGIN = 8;
const ROW_MARGIN = 152;
const BUTTON_FADE_IN_START = 1550;

const animationParameterList = new AnimationParameterList({
	fadeIn: 0,
	alphaIn: 0,
	mainBodyCompletion: 0,
	scoreLabelFadeIn: 0,
	maxComboLabelFadeIn: 0,
	accuracyLabelFadeIn: 0,
	scoreRollup: 0,
	maxComboRollup: 0,
	accuracyRollup: 0,
	"300FadeIn": 0,
	"100FadeIn": 0,
	"50FadeIn": 0,
	"missFadeIn": 0,
	accuracyInfoFadeIn: 0,
	spinInfoFadeIn: 0,
	playedByFadeIn: 0,
	modIconElapsedTime: 0,
	gradeFadeIn: 0,
	buttonElapsedTime: 0
});
const buildUpAnimation = new Animation(animationParameterList);
buildUpAnimation.addEvent(new AnimationEvent('fadeIn', {start: 0, duration: 1500, to: 1, ease: EaseType.EaseOutQuart}));
buildUpAnimation.addEvent(new AnimationEvent('alphaIn', {start: 0, duration: 1000, to: 1, ease: EaseType.EaseOutQuart}));
buildUpAnimation.addEvent(new AnimationEvent('mainBodyCompletion', {start: 0, duration: 1250, to: 1, ease: EaseType.EaseInOutQuint}));
buildUpAnimation.addEvent(new AnimationEvent('scoreLabelFadeIn', {start: 500, duration: 1500, to: 1, ease: EaseType.EaseOutQuart}));
buildUpAnimation.addEvent(new AnimationEvent('maxComboLabelFadeIn', {start: 600, duration: 1500, to: 1, ease: EaseType.EaseOutQuart}));
buildUpAnimation.addEvent(new AnimationEvent('accuracyLabelFadeIn', {start: 700, duration: 1500, to: 1, ease: EaseType.EaseOutQuart}));
buildUpAnimation.addEvent(new AnimationEvent('scoreRollup', {start: 500, duration: 2000, to: 1, ease: EaseType.EaseOutQuint}));
buildUpAnimation.addEvent(new AnimationEvent('maxComboRollup', {start: 600, duration: 600, to: 1, ease: EaseType.EaseOutQuint}));
buildUpAnimation.addEvent(new AnimationEvent('accuracyRollup', {start: 700, duration: 600, to: 1, ease: EaseType.EaseOutQuint}));
buildUpAnimation.addEvent(new AnimationEvent('300FadeIn', {start: 900, duration: 1500, to: 1, ease: EaseType.EaseOutQuart}));
buildUpAnimation.addEvent(new AnimationEvent('100FadeIn', {start: 950, duration: 1500, to: 1, ease: EaseType.EaseOutQuart}));
buildUpAnimation.addEvent(new AnimationEvent('50FadeIn', {start: 1000, duration: 1500, to: 1, ease: EaseType.EaseOutQuart}));
buildUpAnimation.addEvent(new AnimationEvent('missFadeIn', {start: 1050, duration: 1500, to: 1, ease: EaseType.EaseOutQuart}));
buildUpAnimation.addEvent(new AnimationEvent('accuracyInfoFadeIn', {start: 1100, duration: 1500, to: 1, ease: EaseType.EaseOutQuart}));
buildUpAnimation.addEvent(new AnimationEvent('spinInfoFadeIn', {start: 1150, duration: 1500, to: 1, ease: EaseType.EaseOutQuart}));
buildUpAnimation.addEvent(new AnimationEvent('playedByFadeIn', {start: 500, duration: 1500, to: 1, ease: EaseType.EaseOutQuart}));
buildUpAnimation.addEvent(new AnimationEvent('modIconElapsedTime', {start: 1150, duration: 10000, to: 10000}));
buildUpAnimation.addEvent(new AnimationEvent('gradeFadeIn', {start: BUTTON_FADE_IN_START, duration: 1500, to: 1, ease: EaseType.EaseOutQuint}));
buildUpAnimation.addEvent(new AnimationEvent('buttonElapsedTime', {start: BUTTON_FADE_IN_START, duration: 10000, to: 10000}));

export class ScoreScreen {
	public container: PIXI.Container;
	private centerContainer: PIXI.Container;
	public interactionGroup: InteractionGroup;
	private keyRegistration: InteractionRegistration;
	public scalingFactor: number = 1.0;

	private currentScore: Score;
	private currentReplay: Replay;

	private header: BeatmapHeaderPanel;

	private mainContainer: PIXI.Container;
	private background: PIXI.Sprite;
	
	private gradeContainer: PIXI.Container;
	private gradeIcon: PIXI.Sprite;

	private modIconContainer: PIXI.Container;
	private modIcons: ModIcon[] = [];

	private labeledNumericValues: LabeledNumericValue[];
	private scoreLabel: LabeledNumericValue;
	private maxComboLabel: LabeledNumericValue;
	private accuracyLabel: LabeledNumericValue;

	private judgementCounts: JudgementCount[];
	private judgement300Count: JudgementCount;
	private judgement100Count: JudgementCount;
	private judgement50Count: JudgementCount;
	private judgementMissCount: JudgementCount;

	private accuracyInfoText: PIXI.Text;
	private spinInfoText: PIXI.Text;
	private playedByText: PIXI.Text;

	private buttonContainer: PIXI.Container;
	public closeButton: Button;
	public retryButton: Button;
	public watchReplayButton: Button;
	private activeButtons: Button[];

	private animationPlayer: AnimationPlayer;
	private fadeOutInterpolator: Interpolator;

	constructor() {
		this.container = new PIXI.Container();
		this.centerContainer = new PIXI.Container();
		this.container.addChild(this.centerContainer);

		this.interactionGroup = new InteractionGroup();
		this.keyRegistration = new InteractionRegistration();
		this.interactionGroup.add(this.keyRegistration);
		this.keyRegistration.addListener('keyDown', (e) => {
			if (e.keyCode !== KeyCode.Escape) return;

			if (this.animationPlayer.getCurrentTime(performance.now()) >= BUTTON_FADE_IN_START) {
				this.close();
			} else {
				this.skipForward();
			}
		});

		this.header = new BeatmapHeaderPanel(SCORE_SCREEN_WIDTH, SCORE_SCREEN_HEADER_HEIGHT, false, true);
		this.centerContainer.addChild(this.header.container);

		this.mainContainer = new PIXI.Container();
		this.centerContainer.addChild(this.mainContainer);

		this.background = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.background.tint = 0x000000;
		this.background.alpha = 0.8;
		this.mainContainer.addChild(this.background);

		this.gradeIcon = new PIXI.Sprite(scoreGradeTextures.get(ScoreGrade.S));
		this.gradeIcon.anchor.set(0.5, 0.5);
		this.gradeContainer = new PIXI.Container();
		this.gradeContainer.addChild(this.gradeIcon);
		this.mainContainer.addChild(this.gradeContainer);

		this.modIconContainer = new PIXI.Container();
		this.mainContainer.addChild(this.modIconContainer);

		this.scoreLabel = new LabeledNumericValue(this, "score", "0000000", 1.0);
		this.maxComboLabel = new LabeledNumericValue(this, "max combo", "0x", 0.7);
		this.accuracyLabel = new LabeledNumericValue(this, "accuracy", "100.00%", 0.7);
		this.labeledNumericValues = [this.scoreLabel, this.maxComboLabel, this.accuracyLabel];
		for (let v of this.labeledNumericValues) this.mainContainer.addChild(v.container);

		this.judgement300Count = new JudgementCount(this, "300", colorToHexNumber(THEME_COLORS.Judgement300), "0x");
		this.judgement100Count = new JudgementCount(this, "100", colorToHexNumber(THEME_COLORS.Judgement100), "0x");
		this.judgement50Count = new JudgementCount(this, "50", colorToHexNumber(THEME_COLORS.Judgement50), "0x");
		this.judgementMissCount = new JudgementCount(this, "miss", colorToHexNumber(THEME_COLORS.JudgementMiss), "0x");
		this.judgementCounts = [this.judgement300Count, this.judgement100Count, this.judgement50Count, this.judgementMissCount];
		for (let c of this.judgementCounts) this.mainContainer.addChild(c.container);

		this.accuracyInfoText = new PIXI.Text("error: -0.00ms - +0.00ms\nunstable rate: 0.00");
		this.accuracyInfoText.style = {
			fontFamily: 'Exo2-Light',
			fill: 0xffffff,
			align: 'right'
		};
		this.accuracyInfoText.anchor.set(1.0, 1.0);
		this.accuracyInfoText.alpha = 0.75;
		this.mainContainer.addChild(this.accuracyInfoText);

		this.spinInfoText = new PIXI.Text("spin: 0 (max: 0rpm)\nunstable rate: 0.00");
		this.spinInfoText.visible = false;
		this.spinInfoText.anchor.set(1.0, 1.0);
		this.spinInfoText.alpha = 0.75;
		this.mainContainer.addChild(this.spinInfoText);

		this.playedByText = new PIXI.Text("Played by Vanilagy on 2019/01/01 12:45:56");
		this.playedByText.style = {
			fontFamily: 'Exo2-LightItalic',
			fill: 0xffffff
		};
		this.playedByText.alpha = 0.66;
		this.mainContainer.addChild(this.playedByText);

		this.buttonContainer = new PIXI.Container();
		this.centerContainer.addChild(this.buttonContainer);

		this.closeButton = new Button(DEFAULT_BUTTON_WIDTH, DEFAULT_BUTTON_HEIGHT, 15, ButtonPivot.TopRight, "go to menu", colorToHexNumber(THEME_COLORS.PrimaryBlue));
		this.retryButton = new Button(DEFAULT_BUTTON_WIDTH, DEFAULT_BUTTON_HEIGHT, 15, ButtonPivot.TopRight, "play again", colorToHexNumber(THEME_COLORS.SecondaryActionGray));
		this.watchReplayButton = new Button(DEFAULT_BUTTON_WIDTH, DEFAULT_BUTTON_HEIGHT, 15, ButtonPivot.TopRight, "watch replay", colorToHexNumber(THEME_COLORS.SecondaryActionGray));
		this.activeButtons = [];

		this.closeButton.setupInteraction(this.interactionGroup, () => {
			if (!this.activeButtons.includes(this.closeButton)) return;
			
			this.close()
		});
		this.retryButton.setupInteraction(this.interactionGroup, () => {
			if (!this.activeButtons.includes(this.retryButton)) return;

			globalState.gameplayController.restart();
			this.hide();
		});
		this.watchReplayButton.setupInteraction(this.interactionGroup, () => {
			if (!this.activeButtons.includes(this.watchReplayButton)) return;

			globalState.gameplayController.restart();
			globalState.gameplayController.setReplay(this.currentReplay);
			this.hide();
		});

		this.animationPlayer = new AnimationPlayer(buildUpAnimation);
		this.fadeOutInterpolator = new Interpolator({
			beginReversed: true,
			defaultToFinished: true,
			duration: 300,
			ease: EaseType.EaseOutCubic
		});

		this.hide();
		this.resize();

		this.fadeOutInterpolator.end();
	}

	hide() {
		this.fadeOutInterpolator.setReversedState(false, performance.now());
		this.interactionGroup.disable();

		globalState.baseSkin.sounds[SkinSoundType.Applause].stop();
	}

	show() {
		this.interactionGroup.enable();

		this.fadeOutInterpolator.setReversedState(true, performance.now());
		this.fadeOutInterpolator.end();
		this.animationPlayer.start(performance.now());

		globalState.baseSkin.sounds[SkinSoundType.Applause].start(0);
	}

	private close() {
		globalState.gameplayController.endPlay();
		this.hide();
	}

	skipForward() {
		if (!this.fadeOutInterpolator.isReversed()) return;

		let currentTime = this.animationPlayer.getCurrentTime(performance.now());
		if (currentTime >= BUTTON_FADE_IN_START) return;

		this.animationPlayer.start(performance.now() - BUTTON_FADE_IN_START);
	}

	async load(score: Score, beatmap: Beatmap | ExtendedBeatmapData, imageFile: VirtualFile, replay: Replay) {
		this.currentScore = score;
		this.currentReplay = replay;

		await this.header.loadImage(imageFile);
		this.header.updateText(beatmap, true, true);

		let grade = score.calculateGrade();
		this.gradeIcon.texture = scoreGradeTextures.get(grade);

		this.scoreLabel.setValue(padNumberWithZeroes(score.points, 8));
		this.maxComboLabel.setValue(score.maxCombo + 'x');
		this.accuracyLabel.setValue(toPercentageString(score.accuracy, 2));

		this.judgement300Count.setValue(score.hits300 + 'x');
		this.judgement100Count.setValue(score.hits100 + 'x');
		this.judgement50Count.setValue(score.hits50 + 'x');
		this.judgementMissCount.setValue(score.misses + 'x');

		let mods = [...score.mods];
		mods.sort(modComparator);
		this.modIconContainer.removeChildren();
		this.modIcons.length = 0;
		for (let m of mods) {
			let icon = new ModIcon(m);
			this.modIcons.push(icon);
		}
		for (let m of this.modIcons) this.modIconContainer.addChild(m.container);

		let accuracyData = score.calculateAccuracyData();
		this.accuracyInfoText.text = `error: ${accuracyData.lowError.toFixed(2)}ms - +${accuracyData.highError.toFixed(2)}ms\nunstable rate: ${accuracyData.unstableRate.toFixed(2)}`;

		if (accuracyData.averageSpm !== null) {
			this.spinInfoText.visible = true;
			this.spinInfoText.text = `average spin: ${Math.floor(accuracyData.averageSpm)}rpm`;
		} else {
			this.spinInfoText.visible = false;
		}

		this.resize();
	}

	setActiveButtons(buttons: Button[]) {
		this.buttonContainer.removeChildren();

		this.activeButtons = buttons;
		for (let b of this.activeButtons) {
			b.resize(this.scalingFactor);
			this.buttonContainer.addChild(b.container);
		}
	}
	
	resize() {
		this.scalingFactor = calculateRatioBasedScalingFactor(currentWindowDimensions.width, currentWindowDimensions.height, 16/9, REFERENCE_SCREEN_HEIGHT);

		this.header.resize(this.scalingFactor);

		this.background.width = Math.floor(SCORE_SCREEN_WIDTH * this.scalingFactor);

		this.gradeIcon.width = MathUtil.floorToMultiple(150 * this.scalingFactor, 2);
		this.gradeIcon.height = this.gradeIcon.width;
		this.gradeContainer.x = Math.floor((SCORE_SCREEN_WIDTH - 100) * this.scalingFactor);
		this.gradeContainer.y = Math.floor(100 * this.scalingFactor);

		this.modIconContainer.x = this.gradeContainer.x;
		this.modIconContainer.y = this.gradeContainer.y + 96 * this.scalingFactor;

		const modIconSize = 35;
		const modIconMarginSize = modIconSize + 7;
		for (let i = 0; i < this.modIcons.length; i++) {
			let m = this.modIcons[i];
			m.resize(modIconSize * this.scalingFactor, 1);
			m.update(0);

			let x = i*modIconMarginSize,
				y = 0;

			if (this.modIcons.length >= 5 && i >= 3) {
				// If there are 5 or more mod icons, split them into two rows.

				let nudge = (modIconMarginSize*3 - modIconMarginSize*(this.modIcons.length - 3)) / 2;

				x = nudge + (i-3)*modIconMarginSize;
				y = modIconMarginSize;
			}

			m.container.x = Math.floor(x * this.scalingFactor);
			m.container.y = Math.floor(y * this.scalingFactor);
		}

		this.modIconContainer.pivot.x = Math.floor(this.modIconContainer.width / 2);

		for (let i = 0; i < this.labeledNumericValues.length; i++) {
			let v = this.labeledNumericValues[i];
			v.resize();

			v.container.x = 40;
			if (i === 2) v.container.x += ROW_MARGIN;
			v.container.x = Math.floor(v.container.x * this.scalingFactor);
			
			v.container.y = 26;
			if (i > 0) v.container.y += 86;
			v.container.y = Math.floor(v.container.y * this.scalingFactor);
		}

		for (let i = 0; i < this.judgementCounts.length; i++) {
			let c = this.judgementCounts[i];
			c.resize();

			c.container.x = 66;
			if (i % 2 === 1) c.container.x += ROW_MARGIN;
			c.container.x = Math.floor(c.container.x * this.scalingFactor);
			
			c.container.y = SCORE_SCREEN_HEIGHT - 82;
			if (i >= 2) c.container.y += 50;
			c.container.y = Math.floor(c.container.y * this.scalingFactor);
		}

		this.accuracyInfoText.style.fontSize = Math.floor(11 * this.scalingFactor);
		this.accuracyInfoText.x = Math.floor((SCORE_SCREEN_WIDTH - 46) * this.scalingFactor);
		this.accuracyInfoText.y = Math.floor((SCORE_SCREEN_HEIGHT - 32) * this.scalingFactor);

		this.spinInfoText.style = this.accuracyInfoText.style;
		this.spinInfoText.x = Math.floor((SCORE_SCREEN_WIDTH - 190) * this.scalingFactor);
		this.spinInfoText.y = this.accuracyInfoText.y;

		this.playedByText.style.fontSize = Math.floor(10 * this.scalingFactor);
		this.playedByText.pivot.x = Math.floor(this.playedByText.width / 2);
		this.playedByText.x = Math.floor((SCORE_SCREEN_WIDTH / 2) * this.scalingFactor);
		this.playedByText.y = Math.floor(6 * this.scalingFactor);

		this.mainContainer.y = Math.floor((SCORE_SCREEN_HEADER_HEIGHT + SCORE_SCREEN_HEADER_MARGIN) * this.scalingFactor);

		this.buttonContainer.y = Math.floor((SCORE_SCREEN_HEADER_HEIGHT + SCORE_SCREEN_HEIGHT + 2*SCORE_SCREEN_HEADER_MARGIN) * this.scalingFactor);
		for (let b of this.activeButtons) b.resize(this.scalingFactor);

		this.centerContainer.x = Math.floor(currentWindowDimensions.width / 2);
		this.centerContainer.y = Math.floor(currentWindowDimensions.height / 2);

		let totalHeight = (SCORE_SCREEN_HEADER_HEIGHT + SCORE_SCREEN_HEIGHT + 2*SCORE_SCREEN_HEADER_MARGIN + DEFAULT_BUTTON_HEIGHT) * this.scalingFactor;
		let totalWidth = SCORE_SCREEN_WIDTH * this.scalingFactor;
		this.centerContainer.pivot.x = Math.floor(totalWidth / 2);
		this.centerContainer.pivot.y = Math.floor(totalHeight / 2);
	}

	update(now: number) {
		let fadeOutCompletion = this.fadeOutInterpolator.getCurrentValue(now);
		if (fadeOutCompletion === 1) {
			this.container.visible = false;
			return;
		}
		this.container.visible = true;

		if (!this.currentScore) return;

		this.animationPlayer.update(now);

		let fadeInCompletion = this.animationPlayer.getParameter('fadeIn');
		this.centerContainer.y = Math.floor(currentWindowDimensions.height / 2) - 80 * (1 - fadeInCompletion) * this.scalingFactor;
		this.centerContainer.scale.set(MathUtil.lerp(1.2, 1.0, fadeInCompletion) * MathUtil.lerp(1.0, 0.88, fadeOutCompletion));

		let alphaIn = this.animationPlayer.getParameter('alphaIn');
		this.centerContainer.alpha = alphaIn * (1 - fadeOutCompletion);

		this.background.height = Math.floor(SCORE_SCREEN_HEIGHT * this.scalingFactor) * this.animationPlayer.getParameter('mainBodyCompletion');

		let scoreLabelCompletion =  this.animationPlayer.getParameter('scoreLabelFadeIn');
		this.scoreLabel.container.pivot.x = 15 * (1 - scoreLabelCompletion) * this.scalingFactor;
		this.scoreLabel.container.alpha =  scoreLabelCompletion;

		let maxComboLabelCompletion =  this.animationPlayer.getParameter('maxComboLabelFadeIn');
		this.maxComboLabel.container.pivot.x = 15 * (1 - maxComboLabelCompletion) * this.scalingFactor;
		this.maxComboLabel.container.alpha =  maxComboLabelCompletion;

		let accuracyComboLabelCompletion =  this.animationPlayer.getParameter('accuracyLabelFadeIn');
		this.accuracyLabel.container.pivot.x = 15 * (1 - accuracyComboLabelCompletion) * this.scalingFactor;
		this.accuracyLabel.container.alpha =  accuracyComboLabelCompletion;

		let scoreRollup = this.animationPlayer.getParameter('scoreRollup');
		this.scoreLabel.setValue(padNumberWithZeroes(Math.floor(this.currentScore.points * scoreRollup), 8));

		let maxComboRollup = this.animationPlayer.getParameter('maxComboRollup');
		this.maxComboLabel.setValue(Math.floor(this.currentScore.maxCombo * maxComboRollup) + 'x');

		let accuracyRollup = this.animationPlayer.getParameter('accuracyRollup');
		this.accuracyLabel.setValue(toPercentageString(this.currentScore.accuracy * accuracyRollup, 2));

		let judgement300FadeIn = this.animationPlayer.getParameter('300FadeIn');
		this.judgement300Count.container.pivot.x = 15 * (1 - judgement300FadeIn) * this.scalingFactor;
		this.judgement300Count.container.alpha = judgement300FadeIn;

		let judgement100FadeIn = this.animationPlayer.getParameter('100FadeIn');
		this.judgement100Count.container.pivot.x = 15 * (1 - judgement100FadeIn) * this.scalingFactor;
		this.judgement100Count.container.alpha = judgement100FadeIn;

		let judgement50FadeIn = this.animationPlayer.getParameter('50FadeIn');
		this.judgement50Count.container.pivot.x = 15 * (1 - judgement50FadeIn) * this.scalingFactor;
		this.judgement50Count.container.alpha = judgement50FadeIn;

		let judgementMissFadeIn = this.animationPlayer.getParameter('missFadeIn');
		this.judgementMissCount.container.pivot.x = 15 * (1 - judgementMissFadeIn) * this.scalingFactor;
		this.judgementMissCount.container.alpha = judgementMissFadeIn;

		let accuracyInfoFadeIn = this.animationPlayer.getParameter('accuracyInfoFadeIn');
		this.accuracyInfoText.pivot.x = 15 * (1 - accuracyInfoFadeIn) * this.scalingFactor;
		this.accuracyInfoText.alpha = accuracyInfoFadeIn;

		let spinInfoFadeIn = this.animationPlayer.getParameter('spinInfoFadeIn');
		this.spinInfoText.pivot.x = 15 * (1 - spinInfoFadeIn) * this.scalingFactor;
		this.spinInfoText.alpha = spinInfoFadeIn;

		let playedByFadeIn = this.animationPlayer.getParameter('playedByFadeIn');
		this.playedByText.alpha = MathUtil.lerp(0, 0.66, playedByFadeIn);

		let modElapsedTime = this.animationPlayer.getParameter('modIconElapsedTime');
		for (let i = 0; i < this.modIcons.length; i++) {
			let icon = this.modIcons[i];

			let startTime = (this.modIcons.length - 1 - i) * 75;
			let completion = MathUtil.clamp((modElapsedTime - startTime) / 1500, 0, 1);
			completion = MathUtil.ease(EaseType.EaseOutQuart, completion);

			icon.container.pivot.x = 15 * (1 - completion) * this.scalingFactor;
			icon.container.alpha = completion;
		}

		let gradeFadeIn = this.animationPlayer.getParameter('gradeFadeIn');
		this.gradeContainer.scale.set(MathUtil.lerp(1.4, 1.0, gradeFadeIn));
		this.gradeContainer.rotation = 0.1 * (1 - gradeFadeIn);
		this.gradeContainer.alpha = gradeFadeIn;

		let buttonElapsedTime = this.animationPlayer.getParameter('buttonElapsedTime');
		for (let i = 0; i < this.activeButtons.length; i++) {
			let button = this.activeButtons[i];
			button.update(now);

			let startTime = i * 100;
			let completion = MathUtil.clamp((buttonElapsedTime - startTime) / 1500, 0, 1);
			completion = MathUtil.ease(EaseType.EaseOutQuart, completion);

			button.container.x = (SCORE_SCREEN_WIDTH - i*(DEFAULT_BUTTON_WIDTH + DEFAULT_BUTTON_HEIGHT/10 + SCORE_SCREEN_HEADER_MARGIN) - 40 * (1-completion)) * this.scalingFactor;
			if (completion === 1) button.container.x = Math.ceil(button.container.x);

			button.container.alpha = completion;

			if (completion > 0) button.enable();
			else button.disable();
		}
	}
}

class LabeledNumericValue {
	public container: PIXI.Container;
	private parent: ScoreScreen;
	private label: PIXI.Text;
	private valueText: PIXI.Text;
	private valueFontSizeScaling: number;

	constructor(parent: ScoreScreen, label: string, initialValue: string, valueFontSizeScaling: number) {
		this.container = new PIXI.Container();
		this.parent = parent;

		this.label = new PIXI.Text(label);
		this.label.style = {
			fontFamily: 'Exo2-SemiBoldItalic',
			fill: colorToHexNumber(THEME_COLORS.AccentGold)
		};
		this.valueText = new PIXI.Text(initialValue);
		this.valueText.style = {
			fontFamily: 'Exo2-Light',
			fill: 0xffffff
		};
		this.valueFontSizeScaling = valueFontSizeScaling;

		this.container.addChild(this.label, this.valueText);
	}

	resize() {
		let scalingFactor = this.parent.scalingFactor;

		this.label.style.fontSize = Math.floor(14.5 * scalingFactor);
		this.valueText.style.fontSize = Math.floor(50 * scalingFactor * this.valueFontSizeScaling);
		this.valueText.y = Math.floor((18 - 5 * this.valueFontSizeScaling) * scalingFactor);
		this.valueText.x = Math.floor(-2 * scalingFactor);
	}

	setValue(val: string) {
		this.valueText.text = val;
	}
}

class JudgementCount {
	public container: PIXI.Container;
	private parent: ScoreScreen;
	private label: PIXI.Text;
	private valueText: PIXI.Text;

	constructor(parent: ScoreScreen, label: string, labelColor: number, initialValue: string) {
		this.container = new PIXI.Container();
		this.parent = parent;

		this.label = new PIXI.Text(label);
		this.label.style = {
			fontFamily: 'FredokaOne-Regular',
			fill: labelColor
		};
		this.valueText = new PIXI.Text(initialValue);
		this.valueText.style = {
			fontFamily: 'Exo2-Bold',
			fill: 0xffffff
		};
		
		this.label.anchor.set(1.0, 0.0);

		this.container.addChild(this.label, this.valueText);
	}

	resize() {
		let scalingFactor = this.parent.scalingFactor;

		this.label.style.fontSize =  Math.floor(14.5 * scalingFactor);
		this.label.pivot.y = Math.floor(this.label.height);

		this.valueText.style.fontSize = Math.floor(22 * scalingFactor);
		this.valueText.x = Math.floor(10 * scalingFactor);
		this.valueText.pivot.y = Math.floor(this.valueText.height * 0.97); // factor because exo2 is weird regaring letter baseline
	}

	setValue(val: string) {
		this.valueText.text = val;
	}
}