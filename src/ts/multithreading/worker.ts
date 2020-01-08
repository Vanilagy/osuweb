import { JobTask, JobResponseWrapper, JobRequestMessage, GetBeatmapMetadataRequest } from "./job";
import { Beatmap } from "../datamodel/beatmap";
import { ProcessedBeatmap } from "../datamodel/processed/processed_beatmap";
import { DifficultyCalculator } from "../datamodel/difficulty/difficulty_calculator";

self.onmessage = async (e: MessageEvent) => {
	let msg = e.data as JobRequestMessage;
	let response: typeof msg.responseType;
	let transfer: Transferable[] = [];

	try {
		switch (msg.task) {
			case JobTask.GetBeatmapMetadata: {
				let data = msg.data;
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
			case JobTask.GetImageBitmap: {
				let data = msg.data;

				let bitmap = await (createImageBitmap as any)(data.imageResource, {
					resizeWidth: data.resizeWidth,
					resizeHeight: data.resizeHeight
				});

				response = {
					bitmap
				};
				transfer.push(bitmap);
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
	} as JobResponseWrapper, null, transfer);
};