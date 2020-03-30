import { DrawableHitObject } from "./drawable_hit_object";
import { Point, pointDistance } from "../../util/point";
import { HitCirclePrimitive } from "./hit_circle_primitive";
import { ProcessedHeadedHitObject } from "../../datamodel/processed/processed_headed_hit_object";
import { ScoringValue } from "../../datamodel/score";

// This many millisecond before the perfect hit time will the object start to even
// become clickable. Before that, it should do the little shaky-shake, implying it
// was clicked WAY too early.
const CLICK_IMMUNITY_THRESHOLD = 350;

export interface HitObjectHeadScoring {
	hit: ScoringValue,
	time: number
}

export function getDefaultHitObjectHeadScoring(): HitObjectHeadScoring {
	return {
		hit: ScoringValue.NotHit,
		time: null
	};
}

export interface CircleScoring {
	head: HitObjectHeadScoring
}

export function getDefaultCircleScoring(): CircleScoring {
	return {
		head: getDefaultHitObjectHeadScoring()
	};
}

// Keeps track of what the player has successfully hit
export interface SliderScoring {
	head: HitObjectHeadScoring,
	ticks: number,
	repeats: number,
	end: boolean
}

export function getDefaultSliderScoring(): SliderScoring {
	return {
		head: getDefaultHitObjectHeadScoring(),
		ticks: 0,
		repeats: 0,
		end: null
	};
}

export abstract class DrawableHeadedHitObject extends DrawableHitObject {
	public parent: ProcessedHeadedHitObject;

	public head: HitCirclePrimitive;
	public scoring: CircleScoring | SliderScoring;

	show() {
		let controller = this.drawableBeatmap.play.controller;

		controller.hitObjectContainer.addChild(this.head.container);
		if (this.head.approachCircle) controller.approachCircleContainer.addChild(this.head.approachCircle);
	}

	compose(updateSkin: boolean) {
		super.compose(updateSkin);

		this.head.compose();
	}

	position() {
		let screenCoordinates = this.drawableBeatmap.play.toScreenCoordinates(this.parent.startPoint);

		this.head.container.position.set(screenCoordinates.x, screenCoordinates.y);
		if (this.head.approachCircle) this.head.approachCircle.position.set(screenCoordinates.x, screenCoordinates.y);
	}

	remove() {
		let controller = this.drawableBeatmap.play.controller;

		controller.hitObjectContainer.removeChild(this.head.container);
		controller.approachCircleContainer.removeChild(this.head.approachCircle);
	}

	abstract hitHead(time: number, judgementOverride?: number): void;
	
	handleButtonDown(osuMouseCoordinates: Point, currentTime: number) {
		let { circleRadiusOsuPx } = this.drawableBeatmap.play;

		let distance = pointDistance(osuMouseCoordinates, this.parent.startPoint);

		if (distance <= circleRadiusOsuPx && this.scoring.head.hit === ScoringValue.NotHit) {
			if (currentTime >= this.parent.startTime - CLICK_IMMUNITY_THRESHOLD && !this.drawableBeatmap.play.hitObjectIsInputLocked(this)) {
				this.hitHead(currentTime);
				return true;
			} else {
				// Display a shaking animation to indicate that the click was way too early or the note is still locked
				this.head.shake(currentTime);
				return true;
			}
		}

		return false;
	}

	updateHeadElements(currentTime: number) {
		this.head.update(currentTime);
	}

	reset() {
		super.reset();
		if (this.head) this.head.reset();
	}
}