import { VirtualFile } from "../file_system/virtual_file";
import { startJob } from "../multithreading/job_system";
import { Dimensions } from "./graphics_util";
import { shallowObjectClone } from "./misc_util";
import { getFileExtension } from "./file_util";

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

let imageBitmapCache: WeakMap<VirtualFile, Map<BitmapQuality, ImageBitmap | Promise<ImageBitmap>>> = new WeakMap();

/** Create a bitmap from an image file with a certain quality level. If the bitmap already exists, the cached version is returned to avoid recomputing the bitmap. */
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

		let bitmap = await startJob("getImageBitmap", {
			resourceUrl: await file.readAsResourceUrl(),
			resizeWidth: dimensions.width,
			resizeHeight: dimensions.height
		}, null, 0); // Do it all on one worker to avoid stuttering

		cached.set(quality, bitmap);
		resolve(bitmap);
	});

	if (!cached) cached = new Map();
	imageBitmapCache.set(file, cached);
	cached.set(quality, promise);

	return promise;
}

export function hasBitmapFromImageFile(file: VirtualFile, quality: BitmapQuality) {
	let cached = imageBitmapCache.get(file);
	if (cached) {
		let cachedQuality = cached.get(quality);
		if (cachedQuality instanceof ImageBitmap) return true;
	}

	return false;
}

let imageDimensionsCache = new WeakMap<VirtualFile, Dimensions>();
export function getDimensionsFromImageFile(file: VirtualFile): Promise<Dimensions> {
	let cached = imageDimensionsCache.get(file);
	if (cached) return Promise.resolve(shallowObjectClone(cached));

	return new Promise<Dimensions>(async (resolve) => {
		let ext = getFileExtension(file.name);

		if (ext === ".jpg" || ext === ".jpeg") {
			let dimensions = await getJpgDimensions(file);

			if (dimensions && dimensions.width > 0 && dimensions.height > 0) {
				resolve(dimensions);
				return;
			}
		} else if (ext === ".png") {
			resolve(await getPngDimensions(file));
			return;
		}

		// If we reach this point, then we weren't able to get the dimensions quickly. We go the long route and decode the whole thing.

		let img = new Image();
		img.src = await file.readAsResourceUrl();

		img.onload = () => {
			let dimensions: Dimensions = {
				width: img.width,
				height: img.height
			};

			imageDimensionsCache.set(file, dimensions);
			resolve(shallowObjectClone(dimensions));
		};
	});
}

export async function getPngDimensions(file: VirtualFile): Promise<Dimensions> {
	let blob = await file.getBlob();
	let start = blob.slice(0, 24);
	let arrayBuffer = await start.arrayBuffer();
	let view = new DataView(arrayBuffer);

	return {
		width: view.getInt32(16),
		height: view.getInt32(20)
	};
}

// Taken from https://github.com/nodeca/probe-image-size/blob/master/lib/parse_sync/jpeg.js
export async function getJpgDimensions(file: VirtualFile): Promise<Dimensions> {
	let blob = await file.getBlob();
	let start = blob.slice(0, 2**16);
	let arrayBuffer = await start.arrayBuffer();
	let data = new Uint8Array(arrayBuffer);

	if (data.length < 2) return null;
	let view = new DataView(arrayBuffer);
  
	// first marker of the file MUST be 0xFFD8
	if (data[0] !== 0xFF || data[1] !== 0xD8) return null;
  
	var offset = 2;
  
	for (;;) {
		if (data.length - offset < 2) return null;
		// not a JPEG marker
		if (data[offset++] !== 0xFF) return null;
	
		var code = data[offset++];
		var length;
	
		// skip padding bytes
		while (code === 0xFF) code = data[offset++];
	
		// standalone markers, according to JPEG 1992,
		// http://www.w3.org/Graphics/JPEG/itu-t81.pdf, see Table B.1
		if ((0xD0 <= code && code <= 0xD9) || code === 0x01) {
			length = 0;
		} else if (0xC0 <= code && code <= 0xFE) {
			// the rest of the unreserved markers
			if (data.length - offset < 2) return null;
	
			length = view.getUint16(offset) - 2;
			offset += 2;
		} else {
			// unknown markers
			return null;
		}
	
		if (code === 0xD9 /* EOI */ || code === 0xDA /* SOS */) {
			// end of the datastream
			return null;
		}
	
		if (length >= 5 &&
			(0xC0 <= code && code <= 0xCF) &&
			code !== 0xC4 && code !== 0xC8 && code !== 0xCC) {
	
			if (data.length - offset < length) return null;
	
			return {
				width: view.getUint16(offset + 3),
				height: view.getUint16(offset + 1),
			};
		}
  
		offset += length;
	}
};