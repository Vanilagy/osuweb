import { isOsuBeatmapFile, isAudioFile, isImageFile } from "../util/file_util";

export class BeatmapSet {
    public files: File[];
    public osuFiles: File[] = [];
    public audioFiles: File[] = [];
    public imgFiles: File[] = [];

    constructor(files: File[]) {
        this.files = files;

        for (let file of this.files) {
            if (isOsuBeatmapFile(file.name)) {
                this.osuFiles.push(file);
            } else if (isAudioFile(file.name)) {
                this.audioFiles.push(file);
            } else if (isImageFile(file.name)) {
                this.imgFiles.push(file);
            }
        }
    }
}