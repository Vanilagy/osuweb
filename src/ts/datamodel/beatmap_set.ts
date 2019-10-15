import { isOsuBeatmapFile } from "../util/file_util";
import { VirtualDirectory } from "../file_system/virtual_directory";
import { VirtualFile } from "../file_system/virtual_file";
import { Skin } from "../game/skin/skin";

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

    async getBeatmapSkin() {
        let skin = new Skin(this.directory);
        await skin.init();

        return skin;
    }
}