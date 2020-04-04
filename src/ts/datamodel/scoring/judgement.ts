import { ScoringValue } from "./score";
import { ProcessedHitObject } from "../processed/processed_hit_object";
import { Point } from "../../util/point";
import { ProcessedCircle } from "../processed/processed_circle";
import { ProcessedSlider } from "../processed/processed_slider";
import { PlayEvent, PlayEventType } from "../play_events";
import { ProcessedSpinner } from "../processed/processed_spinner";

// By default, each maximum judgement restores 5% of total health.
const DEFAULT_MAX_HEALTH_INCREASE = 0.05;

export class Judgement {
	public value: ScoringValue;
	public isRaw: boolean;
	public affectsCombo: boolean;
	public hitObject: ProcessedHitObject;
	public time: number;
	public positionOverride?: Point;
	public suppressDrawable: boolean;
	public customNumericValue: number;
	public geki = false;
	public katu = false;

	constructor(value: ScoringValue, isRaw: boolean, affectsCombo: boolean, hitObject: ProcessedHitObject, time: number, positionOverride: Point = null, suppressDrawable = false) {
		this.value = value;
		this.isRaw = isRaw;
		this.affectsCombo = affectsCombo;
		this.hitObject = hitObject;
		this.time = time;
		this.positionOverride = positionOverride;
		this.suppressDrawable = suppressDrawable;
		this.customNumericValue = null;
	}

	getNumericScoreValue() {
		if (this.customNumericValue !== null) return this.customNumericValue;
		else return this.value as number;
	}

	setCustomNumericScoreValue(val: number) {
		this.customNumericValue = val;
	}

	getHealthIncrease() {
		switch (this.value) {
			case ScoringValue.Hit300: return DEFAULT_MAX_HEALTH_INCREASE * 1.0;
			case ScoringValue.Hit100: return DEFAULT_MAX_HEALTH_INCREASE * 0.5;
			case ScoringValue.Hit50: return DEFAULT_MAX_HEALTH_INCREASE * -0.05;
			case ScoringValue.Miss: return DEFAULT_MAX_HEALTH_INCREASE * -1.0;
			case ScoringValue.SliderHead: case ScoringValue.SliderRepeat: case ScoringValue.SliderTick: case ScoringValue.SliderEnd: return DEFAULT_MAX_HEALTH_INCREASE;
			default: return 0;
		}
	}

	getTextureName() {
		if (this.geki) return "hit300g";
		if (this.katu) return (this.value === ScoringValue.Hit300)? "hit300k" : "hit100k";

		switch (this.value) {
			case ScoringValue.Hit300: return "hit300";
			case ScoringValue.Hit100: return "hit100";
			case ScoringValue.Hit50: return "hit50";
			case ScoringValue.Miss: return "hit0";
			case ScoringValue.SliderTick: return "sliderPoint10";
			case ScoringValue.SliderHead: case ScoringValue.SliderRepeat: return "sliderPoint30";
			default: return null;
		}
	}

	getPosition() {
		return this.positionOverride || this.hitObject.endPoint;
	}

	isDrawable() {
		return !this.suppressDrawable && (!this.isRaw || this.value === ScoringValue.SliderRepeat || this.value === ScoringValue.SliderTick);
	}

	static createCircleJudgement(circle: ProcessedCircle, value: ScoringValue, time: number) {
		return new Judgement(value, false, true, circle, time);
	}

	static createSliderHeadJudgement(slider: ProcessedSlider, value: ScoringValue, time: number) {
		return new Judgement(value, true, true, slider, time, slider.startPoint);
	}

	static createSliderEventJudgement(sliderEvent: PlayEvent, hit: boolean) {
		let value: ScoringValue = ScoringValue.Miss;

		if (hit) {
			if (sliderEvent.type === PlayEventType.SliderHead) value = ScoringValue.SliderHead;
			else if (sliderEvent.type === PlayEventType.SliderRepeat) value = ScoringValue.SliderRepeat;
			else if (sliderEvent.type === PlayEventType.SliderTick) value = ScoringValue.SliderTick;
			else if (sliderEvent.type === PlayEventType.SliderEnd) value = ScoringValue.SliderEnd;
		}

		let suppressDrawable = sliderEvent.type === PlayEventType.SliderEnd;

		return new Judgement(value, true, true, sliderEvent.hitObject, sliderEvent.time, sliderEvent.position, suppressDrawable);
	}

	static createSliderTotalJudgement(slider: ProcessedSlider, value: ScoringValue) {
		return new Judgement(value, false, false, slider, slider.endTime);
	}

	static createSpinnerSpinBonus(spinner: ProcessedSpinner, bonusAmount: number, time: number) {
		let judgement = new Judgement(ScoringValue.Custom, true, false, spinner, time);
		judgement.setCustomNumericScoreValue(bonusAmount);

		return judgement;
	}

	static createSpinnerTotalJudgement(spinner: ProcessedSpinner, value: ScoringValue) {
		return new Judgement(value, false, true, spinner, spinner.endTime);
	}
}