import { BeatmapSet } from "./beatmap_set";
import { CustomEventEmitter } from "../../util/custom_event_emitter";
import { VirtualDirectory } from "../../file_system/virtual_directory";
import { toPercentageString } from "../../util/misc_util";

// Canonical ranked beatmap folders (so, most) follow this naming scheme
const beatmapFolderRegex = /[0-9]+ (.+?) - (.+)/;

/** Represents a library, storage and loading place for beatmaps. */
export class BeatmapLibrary extends CustomEventEmitter<{
	add: BeatmapSet[],
	change: BeatmapSet
}> {
	public beatmapSets: BeatmapSet[];

	constructor() {
		super();
		this.beatmapSets = [];
	}

	/** Adds beatmap sets to the library from a virtual directory. */
	async addFromDirectory(directory: VirtualDirectory) {
		let newBeatmapSets: BeatmapSet[] = [];

		for await (let entry of directory) {
			if (!(entry instanceof VirtualDirectory)) continue;

			let match = beatmapFolderRegex.exec(entry.name);
			if (match) {
				// Get a quick and dirty estimate of the title and arist as a placeholder before actual metadata is loaded.
				let title = match[2];
				let artist = match[1];

				let newSet = new BeatmapSet(entry);
				newSet.addListener('change', () => this.emit('change', newSet));
				newSet.setBasicMetadata(title, artist);

				newBeatmapSets.push(newSet);
			} else {
				// The folder doesn't follow the usual naming convention. In this case, we pre-parse the metadata.

				let newSet = new BeatmapSet(entry);
				await newSet.loadEntries();

				// Add the change listener after the entries have loaded
				newSet.addListener('change', () => this.emit('change', newSet));

				newBeatmapSets.push(newSet);
			}
		}

		this.beatmapSets.push(...newBeatmapSets);
		this.emit('add', newBeatmapSets);

		// Start loading all entries of the beatmaps
		console.time("Entry load");
		let totalEntries = 0;
		for (let set of newBeatmapSets) {
			await set.loadEntries();
			totalEntries += set.entries.length;
		}
		console.timeEnd("Entry load");
		console.log(`${newBeatmapSets.length} beatmap sets, ${totalEntries} beatmaps loaded.`);

		// Once the entires have loaded, start parsing every beatmap for metadata
		console.time("Metadata load");
		let progress = 0;
		for (let set of newBeatmapSets) {
			await set.loadMetadata();
			progress++;

			if (progress % 20 === 0) console.log(toPercentageString(progress / newBeatmapSets.length, 2));
		}
		console.timeEnd("Metadata load");
	}

	async addFromDirectoryHandle(handle: FileSystemDirectoryHandle) {
		let directory = VirtualDirectory.fromDirectoryHandle(handle);
		await this.addFromDirectory(directory);
	}
}