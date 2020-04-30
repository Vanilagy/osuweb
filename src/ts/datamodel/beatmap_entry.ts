import { ExtendedBeatmapData } from "../util/beatmap_util";
import { VirtualFile } from "../file_system/virtual_file";
import { BeatmapSet } from "./beatmap_set";

/** Represents a wrapper for a beatmap. Contains beatmap metadata as well the beatmap resource used to obtain the actual full beatmap. */
export class BeatmapEntry {
	public beatmapSet: BeatmapSet;
	public extendedMetadata: ExtendedBeatmapData;
	public resource: VirtualFile;

	constructor(beatmapSet: BeatmapSet, resource: VirtualFile) {
		this.beatmapSet = beatmapSet;
		this.resource = resource;
	}
}