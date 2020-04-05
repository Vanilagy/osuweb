import { Circle } from "../../datamodel/circle";
import { SHOW_APPROACH_CIRCLE_ON_FIRST_HIDDEN_OBJECT } from "../../util/constants";
import { DrawableHeadedHitObject, CircleScoring, getDefaultCircleScoring } from "./drawable_headed_hit_object";
import { HitCirclePrimitive, HitCirclePrimitiveType } from "./hit_circle_primitive";
import { ProcessedCircle } from "../../datamodel/processed/processed_circle";
import { CurrentTimingPointInfo } from "../../datamodel/processed/processed_beatmap";
import { DrawableBeatmap } from "../drawable_beatmap";
import { ScoringValue } from "../../datamodel/scoring/score";
import { Mod } from "../../datamodel/mods";
import { Judgement } from "../../datamodel/scoring/judgement";
import { HitSoundInfo, generateHitSoundInfo } from "../skin/hit_sound";

export class DrawableCircle extends DrawableHeadedHitObject {
	public parent: ProcessedCircle;

	public scoring: CircleScoring;
	private hitSound: HitSoundInfo;

	constructor(drawableBeatmap: DrawableBeatmap, processedCircle: ProcessedCircle) {
		super(drawableBeatmap, processedCircle);

		this.reset();
		this.initSounds(processedCircle.hitObject, processedCircle.timingInfo);
	}

	protected initSounds(circle: Circle, timingInfo: CurrentTimingPointInfo) {
		let currentTimingPoint = timingInfo.timingPoint;

		this.hitSound = generateHitSoundInfo(circle.hitSound, circle.extras.sampleSet, circle.extras.additionSet, circle.extras.sampleVolume, circle.extras.customIndex, currentTimingPoint, this.parent.startPoint);
	}

	draw() {
		let { approachTime, activeMods } = this.drawableBeatmap.play;

		this.renderStartTime = this.parent.startTime - approachTime;
	
		this.head = new HitCirclePrimitive({
			fadeInStart: this.parent.startTime - approachTime,
			hitObject: this,
			hasApproachCircle: !activeMods.has(Mod.Hidden) || (this.parent.index === 0 && SHOW_APPROACH_CIRCLE_ON_FIRST_HIDDEN_OBJECT),
			hasNumber: true,
			type: HitCirclePrimitiveType.HitCircle
		});
		this.head.container.zIndex = -this.parent.startTime;
	}

	update(currentTime: number) {
		if (this.head.renderFinished) {
			this.renderFinished = true;
			return;
		}

		super.update(currentTime);
		
		this.updateHeadElements(currentTime);
	}

	score(time: number, scoringValue: ScoringValue) {
		this.scoring.head.time = time;
		this.scoring.head.hit = scoringValue;

		HitCirclePrimitive.fadeOutBasedOnHitState(this.head, time, scoringValue !== 0);
		this.drawableBeatmap.play.processJudgement(Judgement.createCircleJudgement(this.parent, scoringValue, time));
	}

	reset() {
		super.reset();
		this.scoring = getDefaultCircleScoring();
	}

	hitHead(time: number, scoringValueOverride?: number) {
		if (this.scoring.head.hit !== ScoringValue.None) return;

		let { processedBeatmap, scoreProcessor } = this.drawableBeatmap.play;

		let timeInaccuracy = time - this.parent.startTime;
		let scoringValue: ScoringValue;

		if (scoringValueOverride !== undefined) {
			scoringValue = scoringValueOverride;
		} else {
			let hitDelta = Math.abs(timeInaccuracy);
			scoringValue = processedBeatmap.difficulty.getScoringValueForHitDelta(hitDelta);
		}

		this.score(time, scoringValue);
		
		if (scoringValue !== ScoringValue.Miss) {
			const hud = this.drawableBeatmap.play.controller.hud;

			this.drawableBeatmap.play.playHitSound(this.hitSound);
			hud.accuracyMeter.addAccuracyLine(timeInaccuracy, time);
			scoreProcessor.addHitInaccuracy(timeInaccuracy);
		}
	}
}