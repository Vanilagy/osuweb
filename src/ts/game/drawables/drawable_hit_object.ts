import { HitObject } from "../../datamodel/hit_object";
import { Point } from "../../util/point";
import { ProcessedHitObject } from "../../datamodel/processed/processed_hit_object";
import { CurrentTimingPointInfo } from "../../datamodel/processed/processed_beatmap";
import { Color } from "../../util/graphics_util";
import { gameState } from "../game_state";

export abstract class DrawableHitObject {
	public parent: ProcessedHitObject;
	public color: Color; // The combo color of this object
	public colorIndex: number; // The index of the combo color of this object

	/** Specifies the timeframe is which the object is visible and needs to be rendered. */
	public renderStartTime: number;
	/** When true, the hit object has ended its short life as a graphical element and need not be rendered anymore. */
	public renderFinished: boolean;
	
	constructor(processedHitObject: ProcessedHitObject) {
		this.parent = processedHitObject;

		let { colorArray } = gameState.currentPlay;

		this.colorIndex = this.parent.comboInfo.comboNum % colorArray.length;
		this.color = colorArray[this.colorIndex];

		this.reset();
	}

	protected abstract initSounds(hitObject: HitObject, timingInfo: CurrentTimingPointInfo): void;

	abstract draw(): void;

	abstract show(currentTime: number): void;

	abstract position(): void;

	abstract update(currentTime: number): void;

	abstract remove(): void;

	reset() {
		this.renderFinished = false;
	}

	/** @returns A boolean, indicating whether or not the object was handled by the button press. It could be false, for example, if the mouse wasn't over it or the object was already hit. */
	abstract handleButtonDown(osuMouseCoordinates: Point, currentTime: number): boolean;
}