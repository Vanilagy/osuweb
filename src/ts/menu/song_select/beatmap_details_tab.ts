import { getGlobalScalingFactor } from "../../visuals/ui";
import { INFO_PANEL_WIDTH } from "./beatmap_info_panel";
import { InterpolatedCounter } from "../../util/graphics_util";
import { EaseType, MathUtil } from "../../util/math_util";
import { padNumberWithZeroes } from "../../util/misc_util";
import { ExtendedBeatmapData } from "../../datamodel/beatmap_util";

const CIRCLE_CIZE_CAP = 7;
const HP_DRAIN_CAP = 10;
const OVERALL_DIFFICULTY_CAP = 10;
const APPROACH_RATE_CAP = 10;
const STAR_RATING_CAP = 10;

export class BeatmapDetailsTab {
	public container: PIXI.Container;
	private background: PIXI.Sprite;

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

	private backgroundSizeInterpolator: InterpolatedCounter;

	constructor() {
		this.container = new PIXI.Container();

		this.background = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.background.tint = 0x000000;
		this.background.alpha = 0.4;

		this.container.addChild(this.background);

		this.lengthAttribute = new NamedNumericalAttribute('Length', (val: number) => {
			let seconds = Math.floor(val / 1000);
			return Math.floor(seconds / 60) + ':' + padNumberWithZeroes((seconds & 60), 2);
		});
		this.bpmAttribute = new NamedNumericalAttribute('BPM');
		this.objectCountAttribute = new NamedNumericalAttribute('Objects');
		this.circleCountAttribute = new NamedNumericalAttribute('Circles');
		this.sliderCountAttribute = new NamedNumericalAttribute('Sliders');
		this.spinnerCountAttribute = new NamedNumericalAttribute('Spinners');

		this.allNumericalAttributes = [this.lengthAttribute, this.bpmAttribute, this.objectCountAttribute, this.circleCountAttribute, this.sliderCountAttribute, this.spinnerCountAttribute];
		for (let a of this.allNumericalAttributes) this.container.addChild(a.container);

		this.divider = new PIXI.Graphics();
		this.container.addChild(this.divider);

		this.circleSizeAttribute = new RangedAttribute('Circle Size', CIRCLE_CIZE_CAP, 1, 0xffffff);
		this.hpDrainAttribute = new RangedAttribute('HP Drain', HP_DRAIN_CAP, 1, 0xffffff);
		this.overallDifficultyAttribute = new RangedAttribute('Accuracy', OVERALL_DIFFICULTY_CAP, 1, 0xffffff);
		this.approachRateAttribute = new RangedAttribute('Approach Rate', APPROACH_RATE_CAP, 1, 0xffffff);
		this.starRatingAttribute = new RangedAttribute('Star Rating', STAR_RATING_CAP, 2, 0xffdd55);

		this.allRangedAttributes = [this.circleSizeAttribute, this.hpDrainAttribute, this.overallDifficultyAttribute, this.approachRateAttribute, this.starRatingAttribute];
		for (let a of this.allRangedAttributes) this.container.addChild(a.container);

		this.tagsHeader = new PIXI.Text('Tags');
		this.tagsContents = new PIXI.Text('N/A');
		this.container.addChild(this.tagsHeader, this.tagsContents);

		this.resize();

		this.backgroundSizeInterpolator = new InterpolatedCounter({
			initial: this.background.height,
			ease: EaseType.EaseOutCubic,
			duration: 150
		});
	}

	loadBeatmapData(extendedData: ExtendedBeatmapData) {
		this.lengthAttribute.setValue(extendedData.playableLength);
		this.bpmAttribute.setValue(extendedData.bpmMax);
		this.objectCountAttribute.setValue(extendedData.objectCount);
		this.circleCountAttribute.setValue(extendedData.circleCount);
		this.sliderCountAttribute.setValue(extendedData.sliderCount);
		this.spinnerCountAttribute.setValue(extendedData.spinnerCount);

		this.circleSizeAttribute.setValue(extendedData.difficulty.CS);
		this.hpDrainAttribute.setValue(extendedData.difficulty.HP);
		this.overallDifficultyAttribute.setValue(extendedData.difficulty.OD);
		this.approachRateAttribute.setValue(extendedData.difficulty.AR);
		this.starRatingAttribute.setValue(extendedData.difficultyAttributes.starRating);

		this.tagsContents.text = extendedData.tags || 'N/A';
		this.updateBackgroundSize();
	}

	resize() {
		let scalingFactor = getGlobalScalingFactor();

		this.background.width = Math.floor(INFO_PANEL_WIDTH * scalingFactor);

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

		this.tagsHeader.style = {
			fontFamily: 'Exo2',
			fill: 0xffffff,
			textBaseline: 'alphabetic',
			fontWeight: 'bold',
			fontSize: Math.floor(12 * scalingFactor)
		};
		this.tagsHeader.x = Math.floor(20 * scalingFactor);
		this.tagsHeader.y = Math.floor(125 * scalingFactor);

		this.tagsContents.style = {
			fontFamily: 'Exo2',
			fill: 0xffffff,
			textBaseline: 'alphabetic',
			fontSize: Math.floor(11 * scalingFactor),
			wordWrap: true,
			wordWrapWidth: Math.floor(INFO_PANEL_WIDTH * 0.9 * scalingFactor)
		};
		this.tagsContents.x = Math.floor(20 * scalingFactor);
		this.tagsContents.y = Math.floor(145 * scalingFactor);

		this.background.height = this.getProperBackgroundSize();
		if (this.backgroundSizeInterpolator) this.backgroundSizeInterpolator.reset(this.background.height);
	}

	private getProperBackgroundSize() {
		return Math.floor(this.tagsContents.y + this.tagsContents.height + 15 * getGlobalScalingFactor());
	}

	private updateBackgroundSize() {
		this.backgroundSizeInterpolator.setGoal(this.getProperBackgroundSize());
	}

	update() {
		this.background.height = this.backgroundSizeInterpolator.getCurrentValue();

		for (let a of this.allNumericalAttributes) a.update();
		for (let a of this.allRangedAttributes) a.update();
	}
}

class NamedNumericalAttribute {
	public container: PIXI.Container;
	private attributeName: string;
	private nameText: PIXI.Text;
	private valueText: PIXI.Text;
	private interpolator: InterpolatedCounter;
	private formatter: (val: number) => string;

	constructor(attributeName: string, formatter: (val: number) => string = (val: number) => String(Math.round(val))) {
		this.attributeName = attributeName;
		this.formatter = formatter;
		this.container = new PIXI.Container();

		this.nameText = new PIXI.Text(this.attributeName + ':');
		this.nameText.anchor.set(0.0, 1.0);
		this.valueText = new PIXI.Text('-');
		this.valueText.anchor.set(1.0, 1.0);

		this.container.addChild(this.nameText);
		this.container.addChild(this.valueText);

		this.interpolator = new InterpolatedCounter({
			initial: 0,
			duration: 333,
			ease: EaseType.EaseOutCubic
		});
	}

	resize() {
		let scalingFactor = getGlobalScalingFactor();

		this.nameText.style = {
			fontFamily: 'Exo2',
			fill: 0xffffff,
			textBaseline: 'alphabetic',
			fontSize: Math.floor(12 * scalingFactor)
		};

		this.valueText.style = {
			fontFamily: 'Exo2',
			fill: 0xffdd55,
			fontWeight: 'bold',
			textBaseline: 'alphabetic',
			fontSize: Math.floor(16 * scalingFactor)
		};
		this.valueText.x = Math.floor(95 * scalingFactor);
		this.valueText.y = Math.floor(2 * scalingFactor);
	}

	setValue(value: number) {
		this.interpolator.setGoal(value);
	}

	update() {
		let value = this.interpolator.getCurrentValue();
		this.valueText.text = this.formatter(value);
	}
}

class RangedAttribute {
	public container: PIXI.Container;
	private name: string;
	private nameText: PIXI.Text;
	private barBackground: PIXI.Sprite;
	private barProgress: PIXI.Sprite;
	private valueText: PIXI.Text;
	private barInterpolator: InterpolatedCounter;
	private numberInterpolator: InterpolatedCounter;
	private cap: number;
	private decimals: number;

	constructor(name: string, cap: number, decimals: number, color: number) {
		this.name = name;
		this.cap = cap;
		this.decimals = decimals;
		this.container = new PIXI.Container();

		this.nameText = new PIXI.Text(this.name);
		this.container.addChild(this.nameText);

		this.barBackground = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.barBackground.tint = 0x000000;
		this.barBackground.alpha = 0.7;
		this.container.addChild(this.barBackground);

		this.barProgress = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.barProgress.tint = color;
		this.container.addChild(this.barProgress);

		this.valueText = new PIXI.Text("1.23");
		this.container.addChild(this.valueText);

		this.barInterpolator = new InterpolatedCounter({
			initial: 0,
			duration: 333,
			ease: EaseType.EaseOutElastic,
			p: 0.9
		});
		this.numberInterpolator = new InterpolatedCounter({
			initial: 0,
			duration: 250,
			ease: EaseType.EaseOutCubic
		});
	}

	resize() {
		let scalingFactor = getGlobalScalingFactor();

		this.nameText.style = {
			fontFamily: 'Exo2',
			fill: 0xffffff,
			textBaseline: 'alphabetic',
			fontSize: Math.floor(10 * scalingFactor)
		};
		this.nameText.y = Math.floor(-4 * scalingFactor);

		this.barBackground.x = Math.floor(78 * scalingFactor);
		this.barBackground.width = Math.floor(140 * scalingFactor);
		this.barBackground.height = Math.floor(6 * scalingFactor);
		this.barProgress.x = this.barBackground.x;
		this.barProgress.width = Math.floor(40 * scalingFactor);
		this.barProgress.height = this.barBackground.height;

		this.valueText.style = {
			fontFamily: 'Exo2',
			fill: 0xffffff,
			textBaseline: 'alphabetic',
			fontWeight: 'bold',
			fontSize: Math.floor(10 * scalingFactor)
		};
		this.valueText.y = Math.floor(-4 * scalingFactor);
		this.centerText();
	}
	
	private centerText() {
		let scalingFactor = getGlobalScalingFactor();

		this.valueText.x = Math.floor(232 * scalingFactor) - Math.floor(this.valueText.width / 2);
	}

	setValue(val: number) {
		this.barInterpolator.setGoal(val);
		this.numberInterpolator.setGoal(val);
	}

	update() {
		let scalingFactor = getGlobalScalingFactor();
		let barValue = this.barInterpolator.getCurrentValue();
		let percent = MathUtil.clamp(barValue / this.cap, 0, 1);

		this.barProgress.width = Math.floor(140 * scalingFactor * percent);

		this.valueText.text = this.numberInterpolator.getCurrentValue().toFixed(this.decimals);
		this.centerText();
	}
}