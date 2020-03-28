import { INFO_PANEL_WIDTH, BeatmapInfoPanel, BeatmapInfoPanelTab } from "./beatmap_info_panel";
import { EaseType, MathUtil } from "../../util/math_util";
import { padNumberWithZeroes } from "../../util/misc_util";import { InterpolatedValueChanger } from "../../util/interpolation";
import { ExtendedBeatmapData } from "../../util/beatmap_util";
import { THEME_COLORS } from "../../util/constants";
import { colorToHexNumber } from "../../util/graphics_util";

const CIRCLE_CIZE_CAP = 7;
const HP_DRAIN_CAP = 10;
const OVERALL_DIFFICULTY_CAP = 10;
const APPROACH_RATE_CAP = 10;
const STAR_RATING_CAP = 10;

export class BeatmapDetailsTab implements BeatmapInfoPanelTab {
	public parent: BeatmapInfoPanel;
	public container: PIXI.Container;

	private allNumericalAttributes: NamedNumericalAttribute[];
	private lengthAttribute: NamedNumericalAttribute;
	private bpmAttribute: NamedNumericalAttribute;
	private objectCountAttribute: NamedNumericalAttribute;
	private circleCountAttribute: NamedNumericalAttribute;
	private sliderCountAttribute: NamedNumericalAttribute;
	private spinnerCountAttribute: NamedNumericalAttribute;

	private divider: PIXI.Graphics;

	private allRangedAttributes: RangedAttribute[];
	private circleSizeAttribute: RangedAttribute;
	private hpDrainAttribute: RangedAttribute;
	private overallDifficultyAttribute: RangedAttribute;
	private approachRateAttribute: RangedAttribute;
	private starRatingAttribute: RangedAttribute;

	private tagsHeader: PIXI.Text;
	private tagsContents: PIXI.Text;

	constructor(parent: BeatmapInfoPanel) {
		this.parent = parent;
		this.container = new PIXI.Container();

		this.lengthAttribute = new NamedNumericalAttribute(this, 'Length', (val: number) => {
			let seconds = Math.floor(val / 1000);
			return Math.floor(seconds / 60) + ':' + padNumberWithZeroes((seconds % 60), 2);
		});
		this.bpmAttribute = new NamedNumericalAttribute(this, 'BPM');
		this.objectCountAttribute = new NamedNumericalAttribute(this, 'Objects');
		this.circleCountAttribute = new NamedNumericalAttribute(this, 'Circles');
		this.sliderCountAttribute = new NamedNumericalAttribute(this, 'Sliders');
		this.spinnerCountAttribute = new NamedNumericalAttribute(this, 'Spinners');

		this.allNumericalAttributes = [this.lengthAttribute, this.bpmAttribute, this.objectCountAttribute, this.circleCountAttribute, this.sliderCountAttribute, this.spinnerCountAttribute];
		for (let a of this.allNumericalAttributes) this.container.addChild(a.container);

		this.divider = new PIXI.Graphics();
		this.container.addChild(this.divider);

		this.circleSizeAttribute = new RangedAttribute(this, 'Circle Size', CIRCLE_CIZE_CAP, 1, 0xffffff);
		this.hpDrainAttribute = new RangedAttribute(this, 'HP Drain', HP_DRAIN_CAP, 1, 0xffffff);
		this.overallDifficultyAttribute = new RangedAttribute(this, 'Accuracy', OVERALL_DIFFICULTY_CAP, 1, 0xffffff);
		this.approachRateAttribute = new RangedAttribute(this, 'Approach Rate', APPROACH_RATE_CAP, 1, 0xffffff);
		this.starRatingAttribute = new RangedAttribute(this, 'Star Rating', STAR_RATING_CAP, 2, colorToHexNumber(THEME_COLORS.AccentGold));

		this.allRangedAttributes = [this.circleSizeAttribute, this.hpDrainAttribute, this.overallDifficultyAttribute, this.approachRateAttribute, this.starRatingAttribute];
		for (let a of this.allRangedAttributes) this.container.addChild(a.container);

		this.tagsHeader = new PIXI.Text('Tags');
		this.tagsHeader.style = {
			fontFamily: 'Exo2-Regular',
			fill: 0xffffff,
			textBaseline: 'alphabetic',
			fontWeight: 'bold'
		};
		this.tagsContents = new PIXI.Text('N/A');
		this.tagsContents.style = {
			fontFamily: 'Exo2-Regular',
			fill: 0xffffff,
			textBaseline: 'alphabetic',
			wordWrap: true
		};
		this.container.addChild(this.tagsHeader, this.tagsContents);
	}

	loadBeatmapData(extendedData: ExtendedBeatmapData) {
		let now = performance.now();

		this.lengthAttribute.setValue(extendedData.playableLength, now);
		this.bpmAttribute.setValue(extendedData.bpmMax, now);
		this.objectCountAttribute.setValue(extendedData.objectCount, now);
		this.circleCountAttribute.setValue(extendedData.circleCount, now);
		this.sliderCountAttribute.setValue(extendedData.sliderCount, now);
		this.spinnerCountAttribute.setValue(extendedData.spinnerCount, now);

		this.circleSizeAttribute.setValue(extendedData.difficulty.CS, now);
		this.hpDrainAttribute.setValue(extendedData.difficulty.HP, now);
		this.overallDifficultyAttribute.setValue(extendedData.difficulty.OD, now);
		this.approachRateAttribute.setValue(extendedData.difficulty.AR, now);
		this.starRatingAttribute.setValue(extendedData.difficultyAttributes.starRating, now);

		this.tagsContents.text = extendedData.tags || 'N/A';
		this.emitBackgroundHeight();
	}

	resize() {
		let scalingFactor = this.parent.scalingFactor;

		this.allNumericalAttributes.forEach((attribute, i) => {
			attribute.container.x = Math.floor(((i % 2 === 0)? 20 : 147) * scalingFactor);
			attribute.container.y = Math.floor((25 + Math.floor(i / 2) * 30) * scalingFactor);

			attribute.resize();
		});

		this.divider.clear();
		this.divider.lineStyle(1, 0xffffff, 0.15);
		this.divider.moveTo(0, 0);
		this.divider.lineTo(0, Math.floor(92 * scalingFactor));
		this.divider.x = Math.floor((INFO_PANEL_WIDTH / 2) * scalingFactor) - 0.5;

		this.allRangedAttributes.forEach((attribute, i) => {
			attribute.container.x = Math.floor(270 * scalingFactor);
			attribute.container.y = Math.floor((13 + i * 16) * scalingFactor);

			attribute.resize();
		});

		this.tagsHeader.style.fontSize = Math.floor(12 * scalingFactor);
		this.tagsHeader.x = Math.floor(20 * scalingFactor);
		this.tagsHeader.y = Math.floor(125 * scalingFactor);

		this.tagsContents.style.fontSize = Math.floor(11 * scalingFactor);
		this.tagsContents.style.wordWrapWidth = Math.floor(INFO_PANEL_WIDTH * 0.9 * scalingFactor);
		this.tagsContents.x = Math.floor(20 * scalingFactor);
		this.tagsContents.y = Math.floor(145 * scalingFactor);

		this.emitBackgroundHeight();
	}

	private getProperBackgroundHeight() {
		let scalingFactor = this.parent.scalingFactor;
		return (this.tagsContents.y + this.tagsContents.height + 15 * scalingFactor) / scalingFactor;
	}

	private emitBackgroundHeight() {
		this.parent.setTabBackgroundNormalizedHeight(this, this.getProperBackgroundHeight());
	}

	update(now: number) {
		for (let a of this.allNumericalAttributes) a.update(now);
		for (let a of this.allRangedAttributes) a.update(now);
	}

	focus() {
		this.emitBackgroundHeight();
	}
}

class NamedNumericalAttribute {
	public container: PIXI.Container;
	private parent: BeatmapDetailsTab;
	private attributeName: string;
	private nameText: PIXI.Text;
	private valueText: PIXI.Text;
	private interpolator: InterpolatedValueChanger;
	private formatter: (val: number) => string;

	constructor(parent: BeatmapDetailsTab, attributeName: string, formatter: (val: number) => string = (val: number) => String(Math.round(val))) {
		this.attributeName = attributeName;
		this.formatter = formatter;
		this.container = new PIXI.Container();
		this.parent = parent;

		this.nameText = new PIXI.Text(this.attributeName + ':');
		this.nameText.style = {
			fontFamily: 'Exo2-Light',
			fill: 0xffffff,
			textBaseline: 'alphabetic'
		};
		this.nameText.anchor.set(0.0, 1.0);
		this.valueText = new PIXI.Text('-');
		this.valueText.style = {
			fontFamily: 'Exo2-Bold',
			fill: colorToHexNumber(THEME_COLORS.AccentGold),
			textBaseline: 'alphabetic'
		};
		this.valueText.anchor.set(1.0, 1.0);

		this.container.addChild(this.nameText);
		this.container.addChild(this.valueText);

		this.interpolator = new InterpolatedValueChanger({
			initial: 0,
			duration: 333,
			ease: EaseType.EaseOutCubic
		});
	}

	resize() {
		let scalingFactor = this.parent.parent.scalingFactor;

		this.nameText.style.fontSize = Math.floor(12 * scalingFactor);
		this.valueText.style.fontSize = Math.floor(16 * scalingFactor);
		this.valueText.x = Math.floor(95 * scalingFactor);
		this.valueText.y = Math.floor(2 * scalingFactor);
	}

	setValue(value: number, now: number) {
		this.interpolator.setGoal(value, now);
	}

	update(now: number) {
		let value = this.interpolator.getCurrentValue(now);
		this.valueText.text = this.formatter(value);
	}
}

class RangedAttribute {
	public container: PIXI.Container;
	private parent: BeatmapDetailsTab;
	private name: string;
	private nameText: PIXI.Text;
	private barBackground: PIXI.Sprite;
	private barProgress: PIXI.Sprite;
	private valueText: PIXI.Text;
	private barInterpolator: InterpolatedValueChanger;
	private numberInterpolator: InterpolatedValueChanger;
	private cap: number;
	private decimals: number;

	constructor(parent: BeatmapDetailsTab, name: string, cap: number, decimals: number, color: number) {
		this.name = name;
		this.cap = cap;
		this.decimals = decimals;
		this.container = new PIXI.Container();
		this.parent = parent;

		this.nameText = new PIXI.Text(this.name);
		this.nameText.style = {
			fontFamily: 'Exo2-Light',
			fill: 0xffffff,
			textBaseline: 'alphabetic'
		};
		this.container.addChild(this.nameText);

		this.barBackground = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.barBackground.tint = 0x000000;
		this.barBackground.alpha = 0.7;
		this.container.addChild(this.barBackground);

		this.barProgress = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.barProgress.tint = color;
		this.container.addChild(this.barProgress);

		this.valueText = new PIXI.Text("0");
		this.valueText.style = {
			fontFamily: 'Exo2-Bold',
			fill: 0xffffff,
			textBaseline: 'alphabetic'
		};
		this.container.addChild(this.valueText);

		this.barInterpolator = new InterpolatedValueChanger({
			initial: 0,
			duration: 333,
			ease: EaseType.EaseOutElastic,
			p: 0.9
		});
		this.numberInterpolator = new InterpolatedValueChanger({
			initial: 0,
			duration: 250,
			ease: EaseType.EaseOutCubic
		});
	}

	resize() {
		let scalingFactor = this.parent.parent.scalingFactor;

		this.nameText.style.fontSize = Math.floor(10 * scalingFactor);
		this.nameText.y = Math.floor(-4 * scalingFactor);

		this.barBackground.x = Math.floor(78 * scalingFactor);
		this.barBackground.width = Math.floor(140 * scalingFactor);
		this.barBackground.height = Math.floor(6 * scalingFactor);
		this.barProgress.x = this.barBackground.x;
		this.barProgress.width = Math.floor(40 * scalingFactor);
		this.barProgress.height = this.barBackground.height;

		this.valueText.style.fontSize = Math.floor(10 * scalingFactor);
		this.valueText.y = Math.floor(-4 * scalingFactor);
		this.centerText();
	}
	
	private centerText() {
		let scalingFactor = this.parent.parent.scalingFactor;

		this.valueText.x = Math.floor(232 * scalingFactor) - Math.floor(this.valueText.width / 2);
	}

	setValue(val: number, now: number) {
		this.barInterpolator.setGoal(val, now);
		this.numberInterpolator.setGoal(val, now);
	}

	update(now: number) {
		let scalingFactor = this.parent.parent.scalingFactor;
		let barValue = this.barInterpolator.getCurrentValue(now);
		let percent = MathUtil.clamp(barValue / this.cap, 0, 1);

		this.barProgress.width = Math.floor(140 * scalingFactor * percent);

		this.valueText.text = this.numberInterpolator.getCurrentValue(now).toFixed(this.decimals);
		this.centerText();
	}
}