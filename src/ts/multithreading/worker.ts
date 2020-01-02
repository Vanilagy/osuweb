import { JobTask, JobResponseWrapper, JobRequestMessage } from "./job";
import { Beatmap } from "../datamodel/beatmap";
import { ProcessedBeatmap } from "../datamodel/processed/processed_beatmap";
import { DifficultyCalculator } from "../datamodel/difficulty/difficulty_calculator";

self.onmessage = async (e: MessageEvent) => {
	let msg = e.data as JobRequestMessage;
	let data = msg.data;
	let response: typeof msg.responseType;

	try {
		switch (msg.task) {
			case JobTask.GetBeatmapMetadata: {
				let text = await new Response(data.beatmapResource).text();
	
				let beatmap = new Beatmap({
					text: text,
					beatmapSet: null,
					metadataOnly: false
				});
				let processedBeatmap = new ProcessedBeatmap(beatmap, true);
				processedBeatmap.init();
				processedBeatmap.applyStackShift();
	
				let difficulty = DifficultyCalculator.calculate(processedBeatmap, new Set(), 1.0);
				
				response = {
					metadata: beatmap.getNonTrivialMetadata(),
					difficulty: difficulty
				};
			}; break;
		}
	} catch (e) {
		self.postMessage({
			id: msg.id,
			status: 'rejected',
			reason: e
		} as JobResponseWrapper, null);
	}

	self.postMessage({
		id: msg.id,
		status: 'fulfilled',
		data: response
	} as JobResponseWrapper, null);
};