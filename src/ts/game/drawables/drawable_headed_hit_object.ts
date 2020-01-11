import { DrawableHitObject } from "./drawable_hit_object";
import { gameState } from "../game_state";
import { mainHitObjectContainer, approachCircleContainer } from "../../visuals/rendering";
import { Point, pointDistance } from "../../util/point";
import { HitCirclePrimitive } from "./hit_circle_primitive";
import { ScoringValue } from "../scoring_value";
import { ProcessedHeadedHitObject } from "../../datamodel/processed/processed_headed_hit_object";

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
		mainHitObjectContainer.addChild(this.head.container);
		if (this.head.approachCircle) approachCircleContainer.addChild(this.head.approachCircle);

		this.position();
	}

	position() {
		let screenCoordinates = gameState.currentPlay.toScreenCoordinates(this.parent.startPoint);

		this.head.container.position.set(screenCoordinates.x, screenCoordinates.y);
		if (this.head.approachCircle) this.head.approachCircle.position.set(screenCoordinates.x, screenCoordinates.y);
	}

	remove() {
		mainHitObjectContainer.removeChild(this.head.container);
		approachCircleContainer.removeChild(this.head.approachCircle);
	}

	abstract hitHead(time: number, judgementOverride?: number): void;
	
	handleButtonDown(osuMouseCoordinates: Point, currentTime: number) {
		let { circleRadiusOsuPx } = gameState.currentPlay;

		let distance = pointDistance(osuMouseCoordinates, this.parent.startPoint);

		if (distance <= circleRadiusOsuPx && this.scoring.head.hit === ScoringValue.NotHit) {
			if (currentTime >= this.parent.startTime - CLICK_IMMUNITY_THRESHOLD && !gameState.currentPlay.hitObjectIsInputLocked(this)) {
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
}