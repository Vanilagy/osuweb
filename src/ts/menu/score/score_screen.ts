import { Beatmap } from "../../datamodel/beatmap";
import { ExtendedBeatmapData } from "../../util/beatmap_util";
import { currentWindowDimensions, REFERENCE_SCREEN_HEIGHT } from "../../visuals/ui";
import { InteractionGroup, Interactivity } from "../../input/interactivity";
import { calculateRatioBasedScalingFactor, colorToHexNumber, colorToHexString } from "../../util/graphics_util";
import { THEME_COLORS } from "../../util/constants";
import { scoreGradeTextures } from "../components/score_grade_icon";
import { ModIcon } from "../components/mod_icon";
import { Mod } from "../../game/mods/mods";
import { MathUtil, EaseType } from "../../util/math_util";
import { BeatmapHeaderPanel } from "../components/beatmap_header_panel";
import { VirtualFile } from "../../file_system/virtual_file";
import { padNumberWithZeroes, toPercentageString, EMPTY_FUNCTION } from "../../util/misc_util";
import { ScoreGrade, Score } from "../../datamodel/score";
import { createPolygonTexture } from "../../util/pixi_util";
import { Interpolator } from "../../util/interpolation";
import { globalState } from "../../global_state";
import { Button, ButtonPivot } from "../components/button";

const SCORE_SCREEN_WIDTH = 615;
const SCORE_SCREEN_HEIGHT = 342;
const SCORE_SCREEN_HEADER_HEIGHT = 95;
const SCORE_SCREEN_HEADER_MARGIN = 8;
const ROW_MARGIN = 152;
const BUTTON_WIDTH = 140;
const BUTTON_HEIGHT = 35;

export class ScoreScreen {
	public container: PIXI.Container;
	private centerContainer: PIXI.Container;
	public interactionGroup: InteractionGroup;
	public scalingFactor: number = 1.0;

	private header: BeatmapHeaderPanel;

	private mainContainer: PIXI.Container;
	private background: PIXI.Sprite;
	
	private gradeIcon: PIXI.Sprite;

	private modIconContainer: PIXI.Container;
	private modIcons: ModIcon[];

	private labeledNumericValues: LabeledNumericValue[];
	private scoreLabel: LabeledNumericValue;
	private maxComboLabel: LabeledNumericValue;
	private accuracyLabel: LabeledNumericValue;

	private judgementCounts: JudgementCount[];
	private judgement300Count: JudgementCount;
	private judgement100Count: JudgementCount;
	private judgement50Count: JudgementCount;
	private judgementMissCount: JudgementCount;

	private miscInfoText: PIXI.Text;
	private playedByText: PIXI.Text;

	private buttonContainer: PIXI.Container;
	private buttons: Button[];

	constructor() {
		this.container = new PIXI.Container();
		this.centerContainer = new PIXI.Container();
		this.container.addChild(this.centerContainer);

		this.interactionGroup = Interactivity.createGroup();

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
		this.mainContainer.addChild(this.gradeIcon);

		this.modIconContainer = new PIXI.Container();
		this.mainContainer.addChild(this.modIconContainer);

		let dt = new ModIcon(Mod.DoubleTime);
		let hd = new ModIcon(Mod.Hidden);
		this.modIcons = [hd, dt];
		for (let m of this.modIcons) this.modIconContainer.addChild(m.container);

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

		this.miscInfoText = new PIXI.Text("error: -8.41ms - +3.13ms\nunstable rate: 157.16");
		this.miscInfoText.anchor.set(1.0, 1.0);
		this.miscInfoText.alpha = 0.8;
		this.mainContainer.addChild(this.miscInfoText);

		this.playedByText = new PIXI.Text("Played by Vanilagy on 2019/01/01 12:45:56");
		this.playedByText.alpha = 0.66;
		this.mainContainer.addChild(this.playedByText);

		this.buttonContainer = new PIXI.Container();
		this.centerContainer.addChild(this.buttonContainer);

		let closeButton = new Button(BUTTON_WIDTH, BUTTON_HEIGHT, 15, ButtonPivot.TopRight, "go to menu", colorToHexNumber(THEME_COLORS.PrimaryBlue));
		let retryButton = new Button(BUTTON_WIDTH, BUTTON_HEIGHT, 15, ButtonPivot.TopRight, "play again", 0x909090);
		let watchReplayButton = new Button(BUTTON_WIDTH, BUTTON_HEIGHT, 15, ButtonPivot.TopRight, "watch replay", 0x909090);
		this.buttons = [closeButton, retryButton, watchReplayButton];
		for (let b of this.buttons) this.buttonContainer.addChild(b.container);

		closeButton.setupInteraction(this.interactionGroup, () => {
			globalState.gameplayController.endPlay();
			this.hide();
		});
		retryButton.setupInteraction(this.interactionGroup, () => {
			globalState.gameplayController.restart();
			this.hide();
		});
		watchReplayButton.setupInteraction(this.interactionGroup, EMPTY_FUNCTION);

		this.hide();
		this.resize();
	}

	hide() {
		this.container.visible = false;
		this.interactionGroup.disable();
	}

	show() {
		this.container.visible = true;
		this.interactionGroup.enable();
	}

	load(score: Score, beatmap: Beatmap | ExtendedBeatmapData, imageFile: VirtualFile) {
		this.header.loadImage(imageFile);
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
	}
	
	resize() {
		this.scalingFactor = calculateRatioBasedScalingFactor(currentWindowDimensions.width, currentWindowDimensions.height, 16/9, REFERENCE_SCREEN_HEIGHT);

		this.header.resize(this.scalingFactor);

		this.background.width = Math.floor(SCORE_SCREEN_WIDTH * this.scalingFactor);
		this.background.height = Math.floor(SCORE_SCREEN_HEIGHT * this.scalingFactor);

		this.gradeIcon.width = MathUtil.floorToMultiple(150 * this.scalingFactor, 2);
		this.gradeIcon.height = this.gradeIcon.width;
		this.gradeIcon.x = Math.floor((SCORE_SCREEN_WIDTH - 100) * this.scalingFactor);
		this.gradeIcon.y = Math.floor(100 * this.scalingFactor);

		this.modIconContainer.x = this.gradeIcon.x;
		this.modIconContainer.y = this.gradeIcon.y + 100 * this.scalingFactor;

		let i = 0;
		for (let m of this.modIcons) {
			m.resize(35 * this.scalingFactor);

			m.container.x = Math.floor(i * 42 * this.scalingFactor);

			i++;
		}

		this.modIconContainer.pivot.x = Math.floor(this.modIconContainer.width / 2);

		i = 0;
		for (let v of this.labeledNumericValues) {
			v.resize();

			v.container.x = 40;
			if (i === 2) v.container.x += ROW_MARGIN;
			v.container.x = Math.floor(v.container.x * this.scalingFactor);
			
			v.container.y = 26;
			if (i > 0) v.container.y += 86;
			v.container.y = Math.floor(v.container.y * this.scalingFactor);

			i++;
		}

		i = 0;
		for (let c of this.judgementCounts) {
			c.resize();

			c.container.x = 66;
			if (i % 2 === 1) c.container.x += ROW_MARGIN;
			c.container.x = Math.floor(c.container.x * this.scalingFactor);
			
			c.container.y = SCORE_SCREEN_HEIGHT - 82;
			if (i >= 2) c.container.y += 50;
			c.container.y = Math.floor(c.container.y * this.scalingFactor);

			i++;
		}

		this.miscInfoText.style = {
			fontFamily: 'Exo2-Light',
			fill: 0xffffff,
			fontSize: Math.floor(12 * this.scalingFactor),
			align: 'right'
		};
		this.miscInfoText.x = Math.floor((SCORE_SCREEN_WIDTH - 46) * this.scalingFactor);
		this.miscInfoText.y = Math.floor((SCORE_SCREEN_HEIGHT - 32) * this.scalingFactor);

		this.playedByText.style = {
			fontFamily: 'Exo2-LightItalic',
			fill: 0xffffff,
			fontSize: Math.floor(10 * this.scalingFactor),
		};
		this.playedByText.pivot.x = Math.floor(this.playedByText.width / 2);
		this.playedByText.x = Math.floor((SCORE_SCREEN_WIDTH / 2) * this.scalingFactor);
		this.playedByText.y = Math.floor(6 * this.scalingFactor);

		this.mainContainer.y = Math.floor((SCORE_SCREEN_HEADER_HEIGHT + SCORE_SCREEN_HEADER_MARGIN) * this.scalingFactor);

		this.buttonContainer.y = Math.floor((SCORE_SCREEN_HEADER_HEIGHT + SCORE_SCREEN_HEIGHT + 2*SCORE_SCREEN_HEADER_MARGIN) * this.scalingFactor);
		i = 0;
		for (let b of this.buttons) {
			b.resize(this.scalingFactor);

			b.container.x = Math.floor((SCORE_SCREEN_WIDTH - i*(BUTTON_WIDTH + BUTTON_HEIGHT/10 + SCORE_SCREEN_HEADER_MARGIN)) * this.scalingFactor);

			i++;
		}

		this.centerContainer.x = Math.floor(currentWindowDimensions.width / 2);
		this.centerContainer.y = Math.floor(currentWindowDimensions.height / 2);
		this.centerContainer.pivot.x = Math.floor(this.centerContainer.width / 2);
		this.centerContainer.pivot.y = Math.floor(this.centerContainer.height / 2 + 15 * this.scalingFactor);
	}

	update(now: number) {
		for (let b of this.buttons) b.update(now);
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
		this.valueText = new PIXI.Text(initialValue);
		this.valueFontSizeScaling = valueFontSizeScaling;

		this.container.addChild(this.label, this.valueText);
	}

	resize() {
		let scalingFactor = this.parent.scalingFactor;

		this.label.style = {
			fontFamily: 'Exo2-SemiBoldItalic',
			fill: colorToHexNumber(THEME_COLORS.AccentGold),
			fontSize: Math.floor(14.5 * scalingFactor),
		};

		this.valueText.style = {
			fontFamily: 'Exo2-Light',
			fill: 0xffffff,
			fontSize: Math.floor(50 * scalingFactor * this.valueFontSizeScaling),
		};
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
	private labelColor: number;
	private valueText: PIXI.Text;

	constructor(parent: ScoreScreen, label: string, labelColor: number, initialValue: string) {
		this.container = new PIXI.Container();
		this.parent = parent;

		this.label = new PIXI.Text(label);
		this.labelColor = labelColor;
		this.valueText = new PIXI.Text(initialValue);
		
		this.label.anchor.set(1.0, 0.0);

		this.container.addChild(this.label, this.valueText);
	}

	resize() {
		let scalingFactor = this.parent.scalingFactor;

		this.label.style = {
			fontFamily: 'FredokaOne-Regular',
			fill: this.labelColor,
			fontSize: Math.floor(14.5 * scalingFactor),
		};
		this.label.pivot.y = Math.floor(this.label.height);

		this.valueText.style = {
			fontFamily: 'Exo2-Bold',
			fill: 0xffffff,
			fontSize: Math.floor(22 * scalingFactor),
		};
		this.valueText.x = Math.floor(10 * scalingFactor);
		this.valueText.pivot.y = Math.floor(this.valueText.height * 0.96); // factor because exo2 is weird regaring letter baseline
	}

	setValue(val: string) {
		this.valueText.text = val;
	}
}