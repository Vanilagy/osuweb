import { VirtualFile } from "../file_system/virtual_file";
import { startJob } from "../multithreading/job_system";
import { JobTask, GetBeatmapMetadataResponse } from "../multithreading/job";
import { promiseAllSettled } from "../util/misc_util";

export abstract class BeatmapUtils {
	static async getBeatmapMetadataAndDifficultyFromFiles(beatmapFiles: VirtualFile[]) {
		let promises: Promise<GetBeatmapMetadataResponse>[] = [];

		for (let i = 0; i < beatmapFiles.length; i++) {
			let blob = await beatmapFiles[i].getBlob();
			let promise = startJob(JobTask.GetBeatmapMetadata, {
				beatmapResource: blob
			});

			promises.push(promise);
		}

		return promiseAllSettled(promises);
	}
}