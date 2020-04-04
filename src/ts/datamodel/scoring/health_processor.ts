import { JudgementProcessor } from "./judgement_processor";
import { Judgement } from "./judgement";
import { ProcessedBeatmap } from "../processed/processed_beatmap";
import { BeatmapDifficulty } from "../beatmap_difficulty";
import { MathUtil } from "../../util/math_util";

/** A reasonable allowable error for the minimum health offset from target minimum health. A 1% error is unnoticeable. */
const MINIMUM_HEALTH_ERROR = 0.01;

export class HealthProcessor extends JudgementProcessor {
	public health: number;
	private lastDrainTime: number = null;
	/** The health that is drained in one second */
	private drainRate: number;
	private drainStartTime: number;
	private beatmap: ProcessedBeatmap = null;

	constructor() {
		super();
		this.reset();
	}

	reset() {
		this.health = 1.0;
		this.lastDrainTime = null;
	}

	process(judgement: Judgement, record = false) {
		super.process(judgement, record);

		if (!this.beatmap) return;

		this.update(judgement.time);
		this.health += judgement.getHealthIncrease();

		if (this.health > 1) this.health = 1;
	}

	hookBeatmap(beatmap: ProcessedBeatmap) {
		this.beatmap = beatmap;
		this.drainStartTime = (beatmap.hitObjects.length > 0)? beatmap.hitObjects[0].startTime : Infinity;
	}

	update(time: number) {
		let lastTime = (this.lastDrainTime === null)? this.drainStartTime : this.lastDrainTime;
		let elapsed = time - lastTime;
		
		// Subtract time spent in breaks (in which no health is drained)
		for (let i = 0; i < this.beatmap.breaks.length; i++) {
			let breakEvent = this.beatmap.breaks[i];
			let overlap = MathUtil.calculateIntervalOverlap(lastTime, time, breakEvent.startTime, breakEvent.endTime);

			elapsed -= overlap;
		}

		if (elapsed < 0) return;

		this.health -= this.drainRate * elapsed/1000;
		this.lastDrainTime = time;
	}

	calculateDrainRate() {
		this.drainRate = 1.0;

		let adjustment = 1;
		/** The minimum HP reached in a perfect playthrough of the map. */
		let targetMinimumHealth = BeatmapDifficulty.difficultyRange(this.beatmap.difficulty.HP, 0.95, 0.70, 0.30);

		// failsafe:
		while (adjustment < 2**32) {
			this.reset();
			let lowestHealth = 1.0;

			for (let i = 0; i < this.judgementHistory.length; i++) {
				let judgement = this.judgementHistory[i];

				// Apply health adjustments
				this.update(judgement.time);
				lowestHealth = Math.min(lowestHealth, this.health);
				this.process(judgement);

				// Common scenario for when the drain rate is definitely too harsh
				if (lowestHealth < 0) break;
			}

			// Stop if the resulting health is within a reasonable offset from the target
			if (Math.abs(lowestHealth - targetMinimumHealth) <= MINIMUM_HEALTH_ERROR) break;

			// This effectively works like a binary search - each iteration the search space moves closer to the target, but may exceed it.
			adjustment *= 2;
			this.drainRate += Math.sign(lowestHealth - targetMinimumHealth) / adjustment;
		}

		this.reset();
	}
}