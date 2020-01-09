import { VirtualFile } from "../file_system/virtual_file";
import { JobTask } from "./job";
import { startJob } from "./job_system";
import { promiseAllSettled } from "../util/misc_util";
import { ExtendedBeatmapData } from "../datamodel/beatmap_util";

export abstract class JobUtil {
	static async getBeatmapMetadataAndDifficultyFromFiles(beatmapFiles: VirtualFile[]) {
		let promises: Promise<ExtendedBeatmapData>[] = [];

		for (let i = 0; i < beatmapFiles.length; i++) {
			let blob = await beatmapFiles[i].getBlob();
			let promise = startJob(JobTask.GetExtendedBetamapData, {
				beatmapResource: blob
			});

			promises.push(promise);
		}

		return promiseAllSettled(promises);
	}
}