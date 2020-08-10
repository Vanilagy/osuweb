import { BeatmapSet } from "./beatmap_set";
import { ExtendedBeatmapData } from "../../util/beatmap_util";

/** Represents a wrapper for a beatmap. Contains beatmap metadata as well as the path to the beatmap resource. */
export class BeatmapEntry {
	public beatmapSet: BeatmapSet;
	/** Just like 'version' in Beatmap. */
	public version: string = null;
	public extendedMetadata: ExtendedBeatmapData = null;
	public path: string;

	constructor(beatmapSet: BeatmapSet, path: string) {
		this.beatmapSet = beatmapSet;
		this.path = path;
	}

	async getFile() {
		return this.beatmapSet.directory.getFileByPath(this.path);
	}

	async toDescription(): Promise<BeatmapEntryDescription> {
		return {
			path: this.path,
			version: this.version,
			extendedMetadata: this.extendedMetadata
		};
	}

	static fromDescription(description: BeatmapEntryDescription, beatmapSet: BeatmapSet) {
		let entry = new BeatmapEntry(beatmapSet, description.path);
		entry.version = description.version;
		entry.extendedMetadata = description.extendedMetadata;

		return entry;
	}
}

export interface BeatmapEntryDescription {
	path: string,
	version: string,
	extendedMetadata: ExtendedBeatmapData
}