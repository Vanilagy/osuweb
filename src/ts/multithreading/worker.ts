import { JobTask, JobResponseWrapper, JobRequestMessage } from "./job";
import { VirtualFile } from "../file_system/virtual_file";
import { BeatmapUtil } from "../util/beatmap_util";

self.onmessage = async (e: MessageEvent) => {
	let msg = e.data as JobRequestMessage;
	let response: typeof msg.responseType;
	let transfer: Transferable[] = [];

	try {
		switch (msg.task) {
			case JobTask.GetBasicBeatmapData: {
				let data = msg.data;
				let file = VirtualFile.fromBlob(data.beatmapResource, null);
				let basicData = await BeatmapUtil.getBasicBeatmapData(file);

				response = basicData;
			}; break;
			case JobTask.GetExtendedBetamapData: {
				let data = msg.data;
				let file = VirtualFile.fromBlob(data.beatmapResource, null);
				let extendedData = await BeatmapUtil.getExtendedBeatmapData(file);

				response = extendedData;
			}; break;
			case JobTask.GetImageBitmap: {
				let data = msg.data;

				let bitmap = await (createImageBitmap as any)(data.imageResource, {
					resizeWidth: data.resizeWidth,
					resizeHeight: data.resizeHeight
				});

				response = bitmap;
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