import { DrawableHitObject, RecompositionType } from "./drawables/drawable_hit_object";
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
import { PlayEvent, PlayEventType } from "../datamodel/play_events";
import { Mod, RELAX_HIT_RELATIVE_TIME } from "../datamodel/mods";
import { DrawableHeadedHitObject } from "./drawables/drawable_headed_hit_object";

export class DrawableBeatmap {
	public play: Play;
	public processedBeatmap: ProcessedBeatmap;
	public drawableHitObjects: DrawableHitObject[] = [];
	public followPoints: FollowPoint[] = [];
	public processedToDrawable: Map<ProcessedHitObject, DrawableHitObject> = new Map();

	private currentHitObjectIndex: number;
	private onscreenHitObjects: DrawableHitObject[] = [];
	private showHitObjectsQueue: DrawableHitObject[] = [];
	private currentFollowPointIndex = 0;
	private onscreenFollowPoints: FollowPoint[];

	private playEvents: PlayEvent[] = [];
	private currentSustainedEvents: PlayEvent[];
	private currentPlayEvent: number = 0;

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
		
		console.time("Play event generation");
		this.playEvents = this.processedBeatmap.getAllPlayEvents();
		console.timeEnd("Play event generation");

		this.generateFollowPoints();
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

		this.currentHitObjectIndex = 0;

		if (this.onscreenHitObjects) {
			for (let hitObject of this.onscreenHitObjects) {
				hitObject.remove();
			}
		}
		this.onscreenHitObjects = [];

		if (this.onscreenFollowPoints) {
			for (let followPoint of this.onscreenFollowPoints) {
				followPoint.remove();
			}
		}
		this.onscreenFollowPoints = [];

		this.showHitObjectsQueue = [];
		this.currentPlayEvent = 0;
		this.currentSustainedEvents = [];
		this.currentFollowPointIndex = 0;
	}

	render(currentTime: number) {
		// Show new hit objects
		for (let i = 0; i < this.showHitObjectsQueue.length; i++) {
			let hitObject = this.showHitObjectsQueue[i];
			hitObject.show(currentTime);
		}
		this.showHitObjectsQueue.length = 0;

		// Update hit objects on screen, or remove them if necessary
		for (let i = 0; i < this.onscreenHitObjects.length; i++) {
			let hitObject = this.onscreenHitObjects[i];

			hitObject.update(currentTime);

			if (hitObject.renderFinished) {
				// Hit object can now safely be removed from the screen

				hitObject.remove();
				this.onscreenHitObjects.splice(i--, 1);

				continue;
			}
		}

		// Render follow points
		for (let i = this.currentFollowPointIndex; i < this.followPoints.length; i++) {
			let followPoint = this.followPoints[i];
			if (currentTime < followPoint.renderStartTime) break;

			this.onscreenFollowPoints.push(followPoint);
			followPoint.show();

			this.currentFollowPointIndex++;
		}

		for (let i = 0; i < this.onscreenFollowPoints.length; i++) {
			let followPoint = this.onscreenFollowPoints[i];

			followPoint.update(currentTime);

			if (followPoint.renderFinished) {
				followPoint.remove();
				this.onscreenFollowPoints.splice(i--, 1);
			}
		}
	}

	tick(currentTime: number, dt: number) {
		let osuMouseCoordinates = this.play.getOsuMouseCoordinatesFromCurrentMousePosition();
		let buttonPressed = this.play.controller.inputController.isAnyButtonPressed() || this.play.activeMods.has(Mod.Relax);

		// Add new hit objects to screen
		for (this.currentHitObjectIndex; this.currentHitObjectIndex < this.drawableHitObjects.length; this.currentHitObjectIndex++) {
			let hitObject = this.drawableHitObjects[this.currentHitObjectIndex];
			if (currentTime < hitObject.renderStartTime) break;

			this.onscreenHitObjects.push(hitObject);
			this.showHitObjectsQueue.push(hitObject);
		}
		
		// Call regular play event handlers
		for (this.currentPlayEvent; this.currentPlayEvent < this.playEvents.length; this.currentPlayEvent++) {
			let playEvent = this.playEvents[this.currentPlayEvent];
			if (playEvent.time > currentTime) break;

			if (playEvent.endTime !== undefined) {
				this.currentSustainedEvents.push(playEvent);
				continue;
			}
			
			let drawable = this.processedToDrawable.get(playEvent.hitObject);
			drawable.handlePlayEvent(playEvent, osuMouseCoordinates, buttonPressed, currentTime, dt);
		}

		// Call sustained play event handlers
		for (let i = 0; i < this.currentSustainedEvents.length; i++) {
			let playEvent = this.currentSustainedEvents[i];
			if (currentTime >= playEvent.endTime) {
				this.currentSustainedEvents.splice(i--, 1);
				continue;
			}
			
			let drawable = this.processedToDrawable.get(playEvent.hitObject);
			drawable.handlePlayEvent(playEvent, osuMouseCoordinates, buttonPressed, currentTime, dt);
		}

		if (this.play.activeMods.has(Mod.Relax)) {
			// Handle automatically hitting hit objects when Relax is used

			for (let i = 0; i < this.onscreenHitObjects.length; i++) {
				let hitObject = this.onscreenHitObjects[i];
				if (!(hitObject instanceof DrawableHeadedHitObject)) continue;
	
				let relativeTime = currentTime - hitObject.parent.startTime;
				if (relativeTime < RELAX_HIT_RELATIVE_TIME) continue;
	
				// If this variable is true, it means that just one tick ago, relax wasn't going to hit the object. In this case we assume that the mouse has been over the hit object at the exact time that relax would start hitting it.
				let useExactTime = relativeTime - dt < RELAX_HIT_RELATIVE_TIME;
				hitObject.handleButtonDown(osuMouseCoordinates, useExactTime? hitObject.parent.startTime - RELAX_HIT_RELATIVE_TIME : currentTime);
			}
		}
	}

	compose(updateSkin: boolean, triggerInstantly: boolean) {
		for (let i = 0; i < this.drawableHitObjects.length; i++) {
			let drawable = this.drawableHitObjects[i];
			
			if (triggerInstantly) drawable.compose(updateSkin);
			else drawable.recomposition = updateSkin? RecompositionType.Skin : RecompositionType.Normal;
		}

		for (let i = 0; i < this.followPoints.length; i++) {
			let followPoint = this.followPoints[i];

			if (triggerInstantly) followPoint.compose(updateSkin);
			else followPoint.recomposition = updateSkin? RecompositionType.Skin : RecompositionType.Normal;
		}
	}

	dispose() {
		for (let i = 0; i < this.drawableHitObjects.length; i++) {
			let drawable = this.drawableHitObjects[i];
			drawable.dispose();
		}
	}

	playEventsCompleted() {
		return this.currentPlayEvent >= this.playEvents.length;
	}

	stopHitObjectSounds() {
		for (let hitObject of this.onscreenHitObjects) {
			if (hitObject instanceof DrawableSlider) {
				hitObject.setHoldingState(false, 0);
			} else if (hitObject instanceof DrawableSpinner) {
				hitObject.stopSpinningSound();
			}
		}
	}
	
	handleButtonDown() {
		let currentTime = this.play.getCurrentSongTime();
		let osuMouseCoordinates = this.play.getOsuMouseCoordinatesFromCurrentMousePosition();

		for (let i = 0; i < this.onscreenHitObjects.length; i++) {
			let hitObject = this.onscreenHitObjects[i];
			let handled = hitObject.handleButtonDown(osuMouseCoordinates, currentTime);

			if (handled) break; // One button press can only affect one hit object.
		}
	}

	handleMouseMove() {
		let currentTime = this.play.getCurrentSongTime();
		let osuMouseCoordinates = this.play.getOsuMouseCoordinatesFromCurrentMousePosition();
		let pressed = this.play.controller.inputController.isAnyButtonPressed() || this.play.activeMods.has(Mod.Relax);

		for (let i = 0; i < this.onscreenHitObjects.length; i++) {
			let hitObject = this.onscreenHitObjects[i];

			if (hitObject instanceof DrawableSpinner && !this.play.activeMods.has(Mod.SpunOut)) {
				let spinner = hitObject as DrawableSpinner;
				spinner.handleMouseMove(osuMouseCoordinates, currentTime, pressed);
			}
		}
	}

	heldSliderRightNow() {
		for (let drawable of this.onscreenHitObjects) {
			if (drawable instanceof DrawableSlider && drawable.isBeingHeld()) return true;
		}

		return false;
	}
}