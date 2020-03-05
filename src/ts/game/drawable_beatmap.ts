import { DrawableHitObject } from "./drawables/drawable_hit_object";
import { DrawableCircle } from "./drawables/drawable_circle";
import { DrawableSlider } from "./drawables/drawable_slider";
import { DrawableSpinner } from "./drawables/drawable_spinner";
import { FollowPoint, FOLLOW_POINT_DISTANCE_THRESHOLD_SQUARED } from "./drawables/follow_point";
import { pointDistanceSquared } from "../util/point";
import { ProcessedBeatmap } from "../datamodel/processed/processed_beatmap";
import { ProcessedHitObject } from "../datamodel/processed/processed_hit_object";
import { ProcessedCircle } from "../datamodel/processed/processed_circle";
import { ProcessedSlider } from "../datamodel/processed/processed_slider";
import { ProcessedSpinner } from "../datamodel/processed/processed_spinner";
import { Play } from "./play";

export class DrawableBeatmap {
	public play: Play;
	public processedBeatmap: ProcessedBeatmap;
	public drawableHitObjects: DrawableHitObject[] = [];
	public followPoints: FollowPoint[] = [];
	public processedToDrawable: Map<ProcessedHitObject, DrawableHitObject> = new Map();

	constructor(play: Play, processedBeatmap: ProcessedBeatmap) {
		this.play = play;
		this.processedBeatmap = processedBeatmap;
	}

	init() {
		for (let i = 0; i < this.processedBeatmap.hitObjects.length; i++) {
			let processedObj = this.processedBeatmap.hitObjects[i];
			let drawable: DrawableHitObject = null;

			if (processedObj instanceof ProcessedCircle) {
				drawable = new DrawableCircle(this, processedObj);
			} else if (processedObj instanceof ProcessedSlider) {
				drawable = new DrawableSlider(this, processedObj);
			} else if (processedObj instanceof ProcessedSpinner) {
				drawable = new DrawableSpinner(this, processedObj);
			}

			this.processedToDrawable.set(processedObj, drawable);
			this.drawableHitObjects.push(drawable);
		}
	}

	draw() {
		for (let i = 0; i < this.drawableHitObjects.length; i++) {
			let drawable = this.drawableHitObjects[i];
			drawable.draw();
		}
	}
	
	generateFollowPoints() {
		for (let i = 1; i < this.processedBeatmap.hitObjects.length; i++) {
			let objA = this.processedBeatmap.hitObjects[i - 1];
			let objB = this.processedBeatmap.hitObjects[i];

			// No follow points to spinners!
			if (objA instanceof ProcessedSpinner || objB instanceof ProcessedSpinner) continue;

			if (objA.comboInfo.comboNum === objB.comboInfo.comboNum && objA.comboInfo.n !== objB.comboInfo.n) {
				let distSquared = pointDistanceSquared(objA.endPoint, objB.startPoint);

				if (distSquared < FOLLOW_POINT_DISTANCE_THRESHOLD_SQUARED) continue;
				this.followPoints.push(new FollowPoint(this, objA, objB));
			}
		}
	}

	reset() {
		for (let i = 0; i < this.drawableHitObjects.length; i++) {
			let drawable = this.drawableHitObjects[i];
			drawable.reset();
		}
		
		for (let i = 0; i < this.followPoints.length; i++) {
			let followPoint = this.followPoints[i];
			followPoint.reset();
		}
	}
}