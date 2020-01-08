import { VirtualFile } from "../file_system/virtual_file";
import { startJob } from "../multithreading/job_system";
import { JobTask } from "../multithreading/job";
import { Dimensions } from "./graphics_util";
import { jsonClone } from "./misc_util";

export enum BitmapQuality {
	Low,
	Medium,
	High,
	Full
}

let getMaxDimensionForBitmapQuality = new Map<BitmapQuality, number>();
getMaxDimensionForBitmapQuality.set(BitmapQuality.Low, 512);
getMaxDimensionForBitmapQuality.set(BitmapQuality.Medium, 1024);
getMaxDimensionForBitmapQuality.set(BitmapQuality.High, 2048);

let imageBitmapCache: Map<VirtualFile, Map<BitmapQuality, ImageBitmap | Promise<ImageBitmap>>> = new Map();
export function getBitmapFromImageFile(file: VirtualFile, quality: BitmapQuality) {
	let cached = imageBitmapCache.get(file);
	if (cached) {
		let cachedQuality = cached.get(quality);
		if (cachedQuality) {
			if (cachedQuality instanceof ImageBitmap) return Promise.resolve(cachedQuality);
			else return cachedQuality;
		}
	}

	let promise = new Promise<ImageBitmap>(async (resolve) => {
		let dimensions = await getDimensionsFromImageFile(file);

		if (quality !== BitmapQuality.Full) {
			let max = Math.max(dimensions.width, dimensions.height);
			let ratio = getMaxDimensionForBitmapQuality.get(quality) / max;

			if (ratio < 1) {
				dimensions.width *= ratio;
				dimensions.height *= ratio;

				dimensions.width = Math.ceil(dimensions.width);
				dimensions.height = Math.ceil(dimensions.height);
			}
		}

		let { bitmap } = await startJob(JobTask.GetImageBitmap, {
			imageResource: await file.getBlob(),
			resizeWidth: dimensions.width,
			resizeHeight: dimensions.height
		});

		cached.set(quality, bitmap);
		resolve(bitmap);
	});

	if (!cached) cached = new Map();
	imageBitmapCache.set(file, cached);
	cached.set(quality, promise);

	return promise;
}

let imageDimensionsCache = new Map<VirtualFile, Dimensions>();
export function getDimensionsFromImageFile(file: VirtualFile): Promise<Dimensions> {
	let cached = imageDimensionsCache.get(file);
	if (cached) return Promise.resolve(jsonClone(cached));

	return new Promise<Dimensions>(async (resolve) => {
		let img = new Image();
		img.src = await file.readAsResourceUrl();

		img.onload = () => {
			let dimensions: Dimensions = {
				width: img.width,
				height: img.height
			};

			imageDimensionsCache.set(file, dimensions);
			resolve(jsonClone(dimensions));
		};
	});
}