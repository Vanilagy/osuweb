import { Judgement } from "./judgement";
import { PlayEvent, PlayEventType } from "../play_events";
import { ProcessedCircle } from "../processed/processed_circle";
import { ScoringValue } from "./score";
import { ProcessedSlider } from "../processed/processed_slider";
import { ProcessedSpinner } from "../processed/processed_spinner";

export abstract class JudgementProcessor {
	protected judgementHistory: Judgement[] = [];

	resetHistory() {
		this.judgementHistory.length = 0;
	}

	process(judgement: Judgement, record = false) {
		if (record) this.judgementHistory.push(judgement);
	}
	
	simulateAutoplay(playEvents: PlayEvent[]) {
		for (let i = 0; i < playEvents.length; i++) {
			let event = playEvents[i];

			switch (event.type) {
				case PlayEventType.PerfectHeadHit:
					this.process(Judgement.createCircleJudgement(event.hitObject as ProcessedCircle, ScoringValue.Hit300, event.time), true);
					break;
				case PlayEventType.SliderHead: case PlayEventType.SliderRepeat: case PlayEventType.SliderTick:
					this.process(Judgement.createSliderEventJudgement(event, true), true);
					break;
				case PlayEventType.SliderEnd:
					this.process(Judgement.createSliderEventJudgement(event, true), true);
					this.process(Judgement.createSliderTotalJudgement(event.hitObject as ProcessedSlider, ScoringValue.Hit300), true);
					break;
				case PlayEventType.SpinnerEnd:
					this.process(Judgement.createSpinnerTotalJudgement(event.hitObject as ProcessedSpinner, ScoringValue.Hit300), true);
					break;
			}
		}
	}
}