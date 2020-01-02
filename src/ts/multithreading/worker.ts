import { JobTask, JobMessageWrapper, GetBeatmapMetadataJob } from "./job";
import { Beatmap } from "../datamodel/beatmap";
import { ProcessedBeatmap } from "../datamodel/processed/processed_beatmap";
import { DifficultyCalculator } from "../datamodel/difficulty/difficulty_calculator";

self.onmessage = async (e: MessageEvent) => {
    let msg = e.data as JobMessageWrapper;

    for (let i = 0; i < msg.jobs.length; i++) {
		let job = msg.jobs[i];
		
		switch (job.task) {
			case JobTask.GetBeatmapMetadata: {
				let thiiiing = job as GetBeatmapMetadataJob;
				let text = await new Response(thiiiing.beatmapFile).text();

				let beatmap = new Beatmap({
					text: text,
					beatmapSet: null,
					metadataOnly: false
				});
				let processedBeatmap = new ProcessedBeatmap(beatmap, true);
				processedBeatmap.init();
				processedBeatmap.applyStackShift();

				let difficulty = DifficultyCalculator.calculate(processedBeatmap, new Set(), 1.0);

				self.postMessage({
					id: msg.id,
					data: {
						beatmapMetadata: beatmap.getMetadata(),
						difficulty: difficulty
					}
				});
			}; break;
		}

		/*

        switch (job.task) {
            case JobTask.RememberSlider: {
                let rememberSliderJob = job as DrawSliderJob;

                sliderCurveStorage[rememberSliderJob.sliderIndex] = rememberSliderJob;
            }; break;
            case JobTask.DrawSlider: {
                let drawSliderJob = job as DrawSliderJob;

                //drawSliderCurve(drawSliderJob.canvas, drawSliderJob.shapeData, drawSliderJob.screenPixelRatio, drawSliderJob.circleDiameter, drawSliderJob.minX, drawSliderJob.minY, drawSliderJob.color, drawSliderJob.sliderBodyRadius, drawSliderJob.sliderBorder, drawSliderJob.sliderTrackOverride);

                //workerGlobalScope.postMessage(drawSliderJob.id);
            }; break;
            case JobTask.DrawSliderByIndex: {
                let drawSliderJob = sliderCurveStorage[(job as DrawSliderByIndexJob).sliderIndex] as DrawSliderJob;

                //drawSliderCurve(drawSliderJob.canvas, drawSliderJob.shapeData, drawSliderJob.screenPixelRatio, drawSliderJob.circleDiameter, drawSliderJob.minX, drawSliderJob.minY, drawSliderJob.color, drawSliderJob.sliderBodyRadius, drawSliderJob.sliderBorder, drawSliderJob.sliderTrackOverride);

                //workerGlobalScope.postMessage(drawSliderJob.id);
            }; break;
		}
		
		*/
    }
};