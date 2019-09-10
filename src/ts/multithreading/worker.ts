import { Job, JobTask, DrawSliderJob, JobMessageWrapper, DrawSliderByIndexJob } from "./job";
import { drawSliderCurve } from "../game/slider_curve_drawer";

let workerGlobalScope = self as any; // Hacky, but eh. TypeScript made it hard ¯\_(ツ)_/¯

let sliderCurveStorage: any = {};

workerGlobalScope.onmessage = (e: MessageEvent) => {
    let msg = e.data as JobMessageWrapper;

    //console.log(msg.jobs.length);

    //console.time()

    for (let i = 0; i < msg.jobs.length; i++) {
        let job = msg.jobs[i];

        //console.log(job)

        switch (job.task) {
            case JobTask.RememberSlider: {
                let rememberSliderJob = job as DrawSliderJob;

                sliderCurveStorage[rememberSliderJob.sliderIndex] = rememberSliderJob;
            }; break;
            case JobTask.DrawSlider: {
                let drawSliderJob = job as DrawSliderJob;

                drawSliderCurve(drawSliderJob.canvas, drawSliderJob.shapeData, drawSliderJob.pixelRatio, drawSliderJob.circleDiameter, drawSliderJob.minX, drawSliderJob.minY, drawSliderJob.color, drawSliderJob.sliderBodyRadius, drawSliderJob.sliderBorder, drawSliderJob.sliderTrackOverride);

                //workerGlobalScope.postMessage(drawSliderJob.id);
            }; break;
            case JobTask.DrawSliderByIndex: {
                let drawSliderJob = sliderCurveStorage[(job as DrawSliderByIndexJob).sliderIndex] as DrawSliderJob;

                drawSliderCurve(drawSliderJob.canvas, drawSliderJob.shapeData, drawSliderJob.pixelRatio, drawSliderJob.circleDiameter, drawSliderJob.minX, drawSliderJob.minY, drawSliderJob.color, drawSliderJob.sliderBodyRadius, drawSliderJob.sliderBorder, drawSliderJob.sliderTrackOverride);

                //workerGlobalScope.postMessage(drawSliderJob.id);
            }; break;
        }
    }

    workerGlobalScope.postMessage(msg.id);

    //console.timeEnd()
};