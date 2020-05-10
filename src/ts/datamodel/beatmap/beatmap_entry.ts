import { BeatmapSet } from "./beatmap_set";
import { ExtendedBeatmapData } from "../../util/beatmap_util";
import { VirtualFile } from "../../file_system/virtual_file";

/** Represents a wrapper for a beatmap. Contains beatmap metadata as well the beatmap resource used to obtain the actual full beatmap. */
export class BeatmapEntry {
	public beatmapSet: BeatmapSet;
	/** Just like 'version' in Beatmap. */
	public version: string = null;
	public extendedMetadata: ExtendedBeatmapData = null;
	public resource: VirtualFile;

	constructor(beatmapSet: BeatmapSet, resource: VirtualFile) {
		this.beatmapSet = beatmapSet;
		this.resource = resource;
	}
}