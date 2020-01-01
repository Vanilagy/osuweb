import { ProcessedHitObject } from "../processed/processed_hit_object";
import { ProcessedSlider } from "../processed/processed_slider";
import { PlayEvent, PlayEventType } from "../play_events";
import { pointDistance, clonePoint } from "../../util/point";
import { ProcessedSpinner } from "../processed/processed_spinner";
import { MathUtil } from "../../util/math_util";

const NORMALZED_RADIUS = 52;

export class DifficultyHitObject {
	public baseObject: ProcessedHitObject;
	public lastObject: ProcessedHitObject;
	public lastLastObject: ProcessedHitObject;
	public deltaTime: number;
	public jumpDistance: number = 0;
	public travelDistance: number = 0;
	public angle?: number = null;
	public strainTime: number;
	private radius: number;

	constructor(hitObject: ProcessedHitObject, lastLastObject: ProcessedHitObject, lastObject: ProcessedHitObject, clockRate: number) {
		this.baseObject = hitObject;
		this.lastObject = lastObject;
		this.lastLastObject = lastLastObject;
		this.deltaTime = (hitObject.startTime - lastObject.startTime) / clockRate;

		this.setDistances();

		// Every strain interval is hard capped at the equivalent of 375 BPM streaming speed as a safety measure
		this.strainTime = Math.max(50, this.deltaTime);
	}

	setDistances() {
		this.radius = this.baseObject.processedBeatmap.difficulty.getCirclePixelSize() / 2;
		// We will scale distances by this factor, so we can assume a uniform circle size among beatmaps.
		let scalingFactor = NORMALZED_RADIUS / this.radius;

		if (this.radius < 30) {
			let smallCircleBonus = Math.min(30 - this.radius, 5) / 50;
			scalingFactor *= 1 + smallCircleBonus;
		}

		if (this.lastObject instanceof ProcessedSlider) {
			this.computeSliderCursorPosition(this.lastObject);
			this.travelDistance = this.lastObject.lazyTravelDistance * scalingFactor;
		}

		let lastCursorPosition = this.getEndCursorPosition(this.lastObject);

		// Don't need to jump to reach spinners
		if (!(this.baseObject instanceof ProcessedSpinner)) {
			this.jumpDistance = pointDistance(this.baseObject.startPoint, lastCursorPosition) * Math.sqrt(scalingFactor);
		}

		if (this.lastLastObject !== null) {
			let lastLastCursorPosition = this.getEndCursorPosition(this.lastLastObject);

			let v1x = lastLastCursorPosition.x - this.lastLastObject.startPoint.x,
				v1y = lastLastCursorPosition.y - this.lastLastObject.startPoint.y,
				v2x = this.baseObject.startPoint.x - lastCursorPosition.x,
				v2y = this.baseObject.startPoint.y - lastCursorPosition.y;

			let dot = v1x * v2x + v1y * v2y;
			let det = v1x * v2y + v1y * v2x;

			this.angle = Math.abs(Math.atan2(det, dot));
		}
	}

	private computeSliderCursorPosition(slider: ProcessedSlider) {
		if (slider.lazyEndPosition !== null) return;

		slider.lazyEndPosition = clonePoint(slider.startPoint);

		let approxFollowCircleRadius = this.radius * 3;
		let sliderEvents: PlayEvent[] = [];
		slider.addPlayEvents(sliderEvents);

		for (let i = 0; i < sliderEvents.length; i++) {
			let event = sliderEvents[i];
			if (!(event.type === PlayEventType.SliderRepeat || event.type === PlayEventType.SliderTick || event.type === PlayEventType.SliderEnd)) continue;

			let diffX = event.position.x - slider.lazyEndPosition.x;
			let diffY = event.position.y - slider.lazyEndPosition.y;
			let len = MathUtil.fastHypot(diffX, diffY);

			if (len > approxFollowCircleRadius) {
				let dist = (len - approxFollowCircleRadius) / len;
				
				slider.lazyEndPosition.x += diffX * dist;
				slider.lazyEndPosition.y += diffY * dist;
				slider.lazyTravelDistance += dist;
			}
		}
	}

	private getEndCursorPosition(hitObject: ProcessedHitObject) {
		let pos = hitObject.startPoint;

		if (hitObject instanceof ProcessedSlider) {
			this.computeSliderCursorPosition(hitObject);
			pos = hitObject.lazyEndPosition || pos;
		}

		return pos;
	}
}