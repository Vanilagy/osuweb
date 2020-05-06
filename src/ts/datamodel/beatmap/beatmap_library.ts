import { BeatmapSet } from "./beatmap_set";
import { CustomEventEmitter } from "../../util/custom_event_emitter";
import { VirtualDirectory } from "../../file_system/virtual_directory";
import { toPercentageString } from "../../util/misc_util";
import { Task } from "../../multithreading/task";
import { VirtualFileSystemEntry } from "../../file_system/virtual_file_system_entry";
import { globalState } from "../../global_state";

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

	/** Adds beatmap sets and begins loading their metadata. */
	async addBeatmapSets(newBeatmapSets: BeatmapSet[]) {
		for (let set of newBeatmapSets) {
			set.addListener('change', () => this.emit('change', set));
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

		// Once the entries have loaded, start parsing every beatmap for metadata
		console.time("Metadata load");
		let progress = 0;
		for (let set of newBeatmapSets) {
			await set.loadMetadata();
			progress++;

			if (progress % 20 === 0) console.log(toPercentageString(progress / newBeatmapSets.length, 2));
		}
		console.timeEnd("Metadata load");
	}
}

export class ImportBeatmapsFromDirectoryTask extends Task<VirtualDirectory, BeatmapSet[]> {
	private processed = new Set<VirtualFileSystemEntry>();
	private beatmapSets: BeatmapSet[] = [];
	private paused = true;
	private id = 0;

	async init() {}

	async resume() {
		if (this.settled) return;
		if (!this.paused) return;
		this.paused = false;

		let idAtStart = this.id;

		for await (let entry of this.input) {
			if (this.id !== idAtStart) return;

			// If we've already processed this entry, skip it
			if (this.processed.has(entry)) continue;
			this.processed.add(entry);

			if (!(entry instanceof VirtualDirectory)) continue;

			let match = beatmapFolderRegex.exec(entry.name);
			if (match) {
				// Get a quick and dirty estimate of the title and arist as a placeholder before actual metadata is loaded.
				let title = match[2];
				let artist = match[1];

				let newSet = new BeatmapSet(entry);
				newSet.setBasicMetadata(title, artist);

				this.beatmapSets.push(newSet);
			} else {
				// The folder doesn't follow the usual naming convention. In this case, we pre-parse the metadata.

				let newSet = new BeatmapSet(entry);
				await newSet.loadEntries();

				this.beatmapSets.push(newSet);
			}
		}

		globalState.beatmapLibrary.addBeatmapSets(this.beatmapSets);
		this.setResult(this.beatmapSets);
	}

	pause() {
		if (this.settled) return;

		this.paused = true;
		this.id++;
	}

	getProgress() {
		return {
			dataCompleted: this.processed.size
		};
	}
}