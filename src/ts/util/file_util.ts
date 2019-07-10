const AUDIO_FILE_EXTENSIONS = ['.mp3', '.wav']; // More?
const IMAGE_FILE_EXTENSIONS = ['.jpg', '.jpeg', '.png']; // More?
const OSU_BEATMAP_FILE_EXTENSIONS = ['.osu'];

export async function readFileAsText(file: File) {
    console.time("Reading file as text");
    return new Promise<string>((resolve) => {
        let reader = new FileReader();
        reader.onload = (e) => {
            console.timeEnd("Reading file as text");
            resolve(reader.result as string);
        };
        reader.readAsText(file);
    });
}

export async function readFileAsArrayBuffer(file: File) {
    console.time("Reading file as array buffer");
    return new Promise<ArrayBuffer>((resolve) => {
        let reader = new FileReader();
        reader.onload = (e) => {
            console.timeEnd("Reading file as array buffer");
            resolve(reader.result as ArrayBuffer);
        };
        reader.readAsArrayBuffer(file);
    });
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
export async function readFileAsLocalResourceUrl(file: File) {
    let arrayBuffer = await readFileAsArrayBuffer(file);
    let blob = new Blob([arrayBuffer]);

    return URL.createObjectURL(blob);
}

// Including the dot. file.jpg => .jpg
export function getFileExtension(fileName: string) {
    let lastDotIndex = fileName.lastIndexOf('.');
    if (lastDotIndex !== -1) return fileName.slice(lastDotIndex);
    return '';
}

export function isAudioFile(fileName: string) {
    let extension = getFileExtension(fileName);
    return AUDIO_FILE_EXTENSIONS.includes(extension);
}

export function isImageFile(fileName: string) {
    let extension = getFileExtension(fileName);
    return IMAGE_FILE_EXTENSIONS.includes(extension);
}

export function isOsuBeatmapFile(fileName: string) {
    let extension = getFileExtension(fileName);
    return OSU_BEATMAP_FILE_EXTENSIONS.includes(extension);
}