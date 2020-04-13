import { isOsuBeatmapFile } from "../util/file_util";
import { VirtualDirectory } from "../file_system/virtual_directory";
import { VirtualFile } from "../file_system/virtual_file";
import { Skin } from "../game/skin/skin";
import { Beatmap } from "./beatmap";
import { BeatmapUtil } from "../util/beatmap_util";

export class BeatmapSet {
	public directory: VirtualDirectory;
	public representingBeatmap: Beatmap = null;
	public searchableString: string = "";

	constructor(directory: VirtualDirectory) {
		this.directory = directory;
	}

	async init() {
		let representingBeatmapFile = this.getBeatmapFiles()[0];
		if (representingBeatmapFile) {
			let text = await representingBeatmapFile.readAsText();

			this.representingBeatmap = new Beatmap({
				text: text,
				beatmapSet: this,
				metadataOnly: true
			});

			this.searchableString = this.representingBeatmap.getSearchableString();
		}
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

	getStoryboardFile() {
		for (let entry of this.directory) {
			if (entry instanceof VirtualFile && entry.name.endsWith(".osb")) return entry;
		}

		return null;
	}
}