import { Circle } from "../../datamodel/circle";
import { gameState } from "../game_state";
import { SHOW_APPROACH_CIRCLE_ON_FIRST_HIDDEN_OBJECT } from "../../util/constants";
import { accuracyMeter } from "../hud/hud";
import { DrawableHeadedHitObject, CircleScoring, getDefaultCircleScoring } from "./drawable_headed_hit_object";
import { HitCirclePrimitive, HitCirclePrimitiveType } from "./hit_circle_primitive";
import { ScoringValue } from "../scoring_value";
import { Mod } from "../mods/mods";
import { HitSoundInfo, generateHitSoundInfo } from "../skin/sound";
import { ProcessedCircle } from "../../datamodel/processed/processed_circle";
import { CurrentTimingPointInfo } from "../../datamodel/processed/processed_beatmap";

export class DrawableCircle extends DrawableHeadedHitObject {
	public parent: ProcessedCircle;

	public scoring: CircleScoring;
	private hitSound: HitSoundInfo;

	constructor(processedCircle: ProcessedCircle) {
		super(processedCircle);

		this.reset();
		this.initSounds(processedCircle.hitObject, processedCircle.timingInfo);
	}

	protected initSounds(circle: Circle, timingInfo: CurrentTimingPointInfo) {
		let currentTimingPoint = timingInfo.timingPoint;

		this.hitSound = generateHitSoundInfo(circle.hitSound, circle.extras.sampleSet, circle.extras.additionSet, circle.extras.sampleVolume, circle.extras.customIndex, currentTimingPoint, this.parent.startPoint);
	}

	draw() {
		let { approachTime, activeMods } = gameState.currentPlay;

		this.renderStartTime = this.parent.startTime - gameState.currentPlay.approachTime;
	
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

		this.updateHeadElements(currentTime);
	}

	score(time: number, judgement: number) {
		let scoreCounter = gameState.currentPlay.scoreCounter;

		this.scoring.head.time = time;
		this.scoring.head.hit = judgement;

		HitCirclePrimitive.fadeOutBasedOnHitState(this.head, time, judgement !== 0);
		scoreCounter.add(judgement, false, true, true, this, time);
	}

	reset() {
		super.reset();
		this.scoring = getDefaultCircleScoring();
	}

	hitHead(time: number, judgementOverride?: number) {
		if (this.scoring.head.hit !== ScoringValue.NotHit) return;

		let { processedBeatmap } = gameState.currentPlay;

		let timeInaccuracy = time - this.parent.startTime;
		let judgement: number;

		if (judgementOverride !== undefined) {
			judgement = judgementOverride;
		} else {
			let hitDelta = Math.abs(timeInaccuracy);
			judgement = processedBeatmap.difficulty.getJudgementForHitDelta(hitDelta);
		}

		this.score(time, judgement);
		if (judgement !== 0) {
			gameState.currentGameplaySkin.playHitSound(this.hitSound);
			accuracyMeter.addAccuracyLine(timeInaccuracy, time);
		}
	}
}