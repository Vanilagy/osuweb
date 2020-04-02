import { HitObject } from "../../datamodel/hit_object";
import { Point } from "../../util/point";
import { ProcessedHitObject } from "../../datamodel/processed/processed_hit_object";
import { CurrentTimingPointInfo } from "../../datamodel/processed/processed_beatmap";
import { Color } from "../../util/graphics_util";
import { DrawableBeatmap } from "../drawable_beatmap";
import { PlayEvent } from "../../datamodel/play_events";

export enum RecompositionType {
	None,
	Normal,
	Skin
}

export abstract class DrawableHitObject {
	public drawableBeatmap: DrawableBeatmap;
	public parent: ProcessedHitObject;
	public color: Color; // The combo color of this object
	public colorIndex: number; // The index of the combo color of this object

	/** Specifies the timeframe is which the object is visible and needs to be rendered. */
	public renderStartTime: number;
	/** When true, the hit object has ended its short life as a graphical element and need not be rendered anymore. */
	public renderFinished: boolean;
	public recomposition: RecompositionType = RecompositionType.None;

	protected deathCompletion: number = 0.0;
	
	constructor(drawableBeatmap: DrawableBeatmap, processedHitObject: ProcessedHitObject) {
		this.drawableBeatmap = drawableBeatmap;
		this.parent = processedHitObject;
		
		this.reset();
	}

	protected abstract initSounds(hitObject: HitObject, timingInfo: CurrentTimingPointInfo): void;

	abstract draw(): void;

	compose(updateSkin: boolean) {
		this.recomposition = RecompositionType.None;

		let { colorArray } = this.drawableBeatmap.play;

		this.colorIndex = this.parent.comboInfo.comboNum % colorArray.length;
		this.color = colorArray[this.colorIndex];

		this.position();
	}

	abstract show(currentTime: number): void;

	abstract position(): void;

	update(currentTime: number) {
		if (this.recomposition !== RecompositionType.None) this.compose(this.recomposition === RecompositionType.Skin);
	}

	abstract remove(): void;

	reset() {
		this.renderFinished = false;
	}

	/** @returns A boolean, indicating whether or not the object was handled by the button press. It could be false, for example, if the mouse wasn't over it or the object was already hit. */
	abstract handleButtonDown(osuMouseCoordinates: Point, currentTime: number): boolean;

	abstract handlePlayEvent(event: PlayEvent, osuMouseCoordinates: Point, buttonPressed: boolean, currentTime: number, dt: number): void;

	/** Called when the hit object is about to be lost in the depths of garbage collection. */
	dispose() {}

	setDeathCompletion(completion: number) {
		this.deathCompletion = completion;
	}
}