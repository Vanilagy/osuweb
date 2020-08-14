const AUDIO_FILE_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.opus']; // More?
const IMAGE_FILE_EXTENSIONS = ['.jpg', '.jpeg', '.png']; // More?
const OSU_BEATMAP_FILE_EXTENSIONS = ['.osu'];

export async function readFileAsText(file: File) {
	return new Response(file).text();
}

export async function readFileAsArrayBuffer(file: File) {
	return new Response(file).arrayBuffer();
}

export async function readFileAsDataUrl(file: File) {
	console.time("Reading file as data URL");
	return new Promise<string>((resolve) => {
		let reader = new FileReader();
		reader.onload = (e) => {
			console.timeEnd("Reading file as data URL");
			resolve(reader.result as string);
		};
		reader.readAsDataURL(file);
	});
}

// TODO: Excessively calling this function, even with the same file, will keep creating new resources and filling up RAM. We'll likely need some more sophisticated storage object for this.
export function readFileAsLocalResourceUrl(file: File) {
	return URL.createObjectURL(file);
}

/** Including the dot. file.jpg => .jpg */
export function getFileExtension(filename: string) {
	let lastDotIndex = filename.lastIndexOf('.');
	if (lastDotIndex !== -1) return filename.slice(lastDotIndex);
	return '';
}

export function getFilenameWithoutExtension(filename: string) {
	let lastDotIndex = filename.lastIndexOf('.');
	if (lastDotIndex !== -1) return filename.slice(0, lastDotIndex);
	return filename;
}

export function isAudioFile(filename: string) {
	let extension = getFileExtension(filename);
	return AUDIO_FILE_EXTENSIONS.includes(extension);
}

export function isImageFile(filename: string) {
	let extension = getFileExtension(filename);
	return IMAGE_FILE_EXTENSIONS.includes(extension);
}

export function isOsuBeatmapFile(filename: string) {
	let extension = getFileExtension(filename);
	return OSU_BEATMAP_FILE_EXTENSIONS.includes(extension);
}

export function isOsuArchiveFile(filename: string) {
	return filename.endsWith('.osz');
}

/** Splits a path into its components. Should work both for POSIX and for Windows-y paths. */
export function splitPath(path: string) {
	let splitPosix = path.split('/');
	let splitStupid = path.split('\\');
	let split = (splitStupid.length > splitPosix.length)? splitStupid : splitPosix;

	for (let i = 0; i < split.length; i++) {
		if (split[i] === '') split.splice(i--, 1);
	}

	return split;
}