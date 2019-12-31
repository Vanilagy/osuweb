import { ProcessedHitObject } from "./processed_hit_object";
import { gameState } from "../../game/game_state";
import { PlayEvent, PlayEventType } from "../play_events";

export abstract class ProcessedHeadedHitObject extends ProcessedHitObject {
	public stackHeight: number = 0;

	abstract applyStackPosition(): void;

	addPlayEvents(playEventArray: PlayEvent[]) {
        let { processedBeatmap } = gameState.currentPlay;

        playEventArray.push({
            type: PlayEventType.PerfectHeadHit,
            hitObject: this,
            time: this.startTime,
            position: this.startPoint
        });

        playEventArray.push({
            type: PlayEventType.HeadHitWindowEnd,
            hitObject: this,
            time: this.startTime + processedBeatmap.difficulty.getHitDeltaForJudgement(50)
        });
    }
}