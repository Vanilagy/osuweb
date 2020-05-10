import { BeatmapSet } from "./beatmap_set";
import { CustomEventEmitter } from "../../util/custom_event_emitter";
import { VirtualDirectory } from "../../file_system/virtual_directory";
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

		let loadEntriesTask = new LoadBeatmapEntriesTask(newBeatmapSets);
		loadEntriesTask.start();

		let loadMetadataTask = new LoadBeatmapMetadataTask(newBeatmapSets);
		loadMetadataTask.waitFor(loadEntriesTask);
	}
}

/** Imports all beatmap sets from a directory. */
export class ImportBeatmapsFromDirectoryTask extends Task<VirtualDirectory, BeatmapSet[]> {
	private processed = new Set<VirtualFileSystemEntry>();
	private beatmapSets: BeatmapSet[] = [];
	private paused = true;
	private id = 0;

	get descriptor() {return "Importing directory"}
	get show() {return false}
	get isPerformanceIntensive() {return true}

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

	isPaused() {
		return this.paused;
	}

	getProgress() {
		return {
			dataCompleted: this.processed.size
		};
	}
}

/** Loads all the entries in a list of beatmap sets. */
export class LoadBeatmapEntriesTask extends Task<BeatmapSet[], void> {
	private currentIndex = 0;
	private paused = true;
	private id = 0;

	get descriptor() {return "Importing beatmaps"}
	get show() {return true}
	get isPerformanceIntensive() {return true}

	async init() {}

	async resume() {
		if (this.settled) return;
		if (!this.paused) return;
		this.paused = false;

		console.log("LESUME")

		let idAtStart = this.id;

		for (this.currentIndex; this.currentIndex < this.input.length; this.currentIndex++) {
			if (this.id !== idAtStart) return;

			let set = this.input[this.currentIndex];
			await set.loadEntries();
		}

		this.setResult();
	}

	pause() {
		if (this.settled) return;

		this.paused = true;
		this.id++;
	}

	isPaused() {
		return this.paused;
	}

	getProgress() {
		return {
			completion: this.currentIndex / this.input.length,
			dataCompleted: this.currentIndex,
			dataTotal: this.input.length
		};
	}
}

/** Loads the metadata for every beatmap in a list of beatmap sets. */
export class LoadBeatmapMetadataTask extends Task<BeatmapSet[], void> {
	private currentIndex = 0;
	private paused = true;
	private id = 0;

	get descriptor() {return "Processing beatmap metadata"}
	get show() {return true}
	get isPerformanceIntensive() {return true}

	async init() {}

	async resume() {
		if (this.settled) return;
		if (!this.paused) return;
		this.paused = false;

		let idAtStart = this.id;

		for (this.currentIndex; this.currentIndex < this.input.length; this.currentIndex++) {
			if (this.id !== idAtStart) return;

			let set = this.input[this.currentIndex];
			await set.loadMetadata();
		}

		this.setResult();
	}

	pause() {
		if (this.settled) return;

		this.paused = true;
		this.id++;
	}

	isPaused() {
		return this.paused;
	}

	getProgress() {
		return {
			completion: this.currentIndex / this.input.length,
			dataCompleted: this.currentIndex,
			dataTotal: this.input.length
		};
	}
}