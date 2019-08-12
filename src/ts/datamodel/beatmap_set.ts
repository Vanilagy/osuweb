import { isOsuBeatmapFile, isAudioFile, isImageFile } from "../util/file_util";
import { VirtualDirectory } from "../file_system/virtual_directory";
import { VirtualFile } from "../file_system/virtual_file";

export class BeatmapSet {
    public directory: VirtualDirectory;

    constructor(directory: VirtualDirectory) {
        this.directory = directory;
    }

    getBeatmapFiles() {
        let arr: VirtualFile[] = [];

        this.directory.forEach((entry) => {
            if (entry instanceof VirtualFile && isOsuBeatmapFile(entry.name)) arr.push(entry);
        });

        return arr;
    }
}