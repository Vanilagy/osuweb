import { VirtualFile } from "../file_system/virtual_file";
import { startJob } from "../multithreading/job_system";
import { Dimensions } from "./graphics_util";
import { shallowObjectClone, bytesToString, bytesToStringFromView } from "./misc_util";
import { getFileExtension } from "./file_util";

const PNG_SIGNATURE = 'PNG\r\n\x1a\n';
const PNG_IMAGE_HEADER_CHUNK_NAME = 'IHDR';
const PNG_FRIED_CHUNK_NAME = 'CgBI'; // Used to detect "fried" png's: http://www.jongware.com/pngdefry.html

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
		let dimensions: Dimensions;
		try {
			dimensions = await getDimensionsFromImageFile(file);
		} catch (e) {
			resolve(null);
			return;
		}

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

		let bitmap: any;

		try {
			bitmap = await startJob("getImageBitmap", {
				resourceUrl: await file.readAsResourceUrl(),
				resizeWidth: dimensions.width,
				resizeHeight: dimensions.height
			}, null, 0); // Do it all on one worker to avoid stuttering
		} catch (e) {
			console.error(e);
			resolve(null);

			return;
		}

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

	return new Promise<Dimensions>(async (resolve, reject) => {
		let ext = getFileExtension(file.name);
		let dimensions: Dimensions;

		if (ext === ".jpg" || ext === ".jpeg") {
			dimensions = await getJpgDimensions(file);
		} else if (ext === ".png") {
			dimensions = await getPngDimensions(file);
		}

		// It could be that we didn't find dimensions or the dimensions are negative (idk why, but it has happened)
		if (dimensions && dimensions.width > 0 && dimensions.height > 0) {
			imageDimensionsCache.set(file, dimensions);
			resolve(shallowObjectClone(dimensions));

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
		img.onerror = (e) => {
			reject(e)
		};
	});
}

export function validatePng(view: DataView) {
	if (bytesToStringFromView(view, 1, 7) === PNG_SIGNATURE) {
		let chunkName = bytesToStringFromView(view, 12, 4);
		if (chunkName === PNG_FRIED_CHUNK_NAME) {
			chunkName = bytesToStringFromView(view, 28, 4);
		}
		if (chunkName !== PNG_IMAGE_HEADER_CHUNK_NAME) return false;
		return true;
	}

	return false;
}

export async function getPngDimensions(file: VirtualFile): Promise<Dimensions> {
	let blob = await file.getBlob();
	let start = blob.slice(0, 40);
	let arrayBuffer = await start.arrayBuffer();
	let view = new DataView(arrayBuffer);

	if (!validatePng(view)) return null;

	if (bytesToStringFromView(view, 12, 4) === PNG_FRIED_CHUNK_NAME) {
		return {
			width: view.getInt32(32),
			height: view.getInt32(36)
		};
	} else {
		return {
			width: view.getInt32(16),
			height: view.getInt32(20)
		};
	}
}

export function validateJpg(view: DataView) {
	return view.getUint8(0) === 0xff && view.getUint8(1) == 0xd8;
}

// Taken from https://github.com/nodeca/probe-image-size/blob/master/lib/parse_sync/jpeg.js
export async function getJpgDimensions(file: VirtualFile): Promise<Dimensions> {
	let blob = await file.getBlob();
	let start = blob.slice(0, 2**16);
	let arrayBuffer = await start.arrayBuffer();
	let data = new Uint8Array(arrayBuffer);

	if (data.length < 2) return null;
	let view = new DataView(arrayBuffer);

	if (!validateJpg(view)) return null;
  
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