import { BeatmapSet } from "./beatmap_set";
import { CustomEventEmitter } from "../../util/custom_event_emitter";
import { VirtualDirectory } from "../../file_system/virtual_directory";
import { Task } from "../../multithreading/task";
import { VirtualFileSystemEntry } from "../../file_system/virtual_file_system_entry";
import { globalState } from "../../global_state";
import { startJob } from "../../multithreading/job_system";
import { removeItem, wait } from "../../util/misc_util";
import { BeatmapEntry } from "./beatmap_entry";
import { VirtualFile } from "../../file_system/virtual_file";
import { isOsuBeatmapFile } from "../../util/file_util";

// Canonical ranked beatmap folders (so, most) follow this naming scheme
const beatmapFolderRegex = /[0-9]+ (.+?) - (.+)/;

/** Represents a library, storage and loading place for beatmaps. */
export class BeatmapLibrary extends CustomEventEmitter<{
	add: BeatmapSet[],
	change: BeatmapSet,
	remove: BeatmapSet,
	removeEntry: BeatmapEntry
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
			set.addListener('remove', () => {
				removeItem(this.beatmapSets, set);
				this.emit('remove', set);
			});
			set.addListener('removeEntry', (entry) => this.emit('removeEntry', entry));
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
	/** The selected input directory could either be a directory of beatmap directories, or just a single beatmap directory. Which one is the case needs to be detected first, and this variable reflects the state of that detection. */
	private currentType: 'undetermined' | 'multiple' | 'single' = 'undetermined';
	private defectiveBeatmapSetCount = 0;

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

			if (entry instanceof VirtualFile) {
				// If we already know we're searching through a list of beatmap directories, we can ignore files
				if (this.currentType === 'multiple') continue;

				if (isOsuBeatmapFile(entry.name)) {
					// If we find a single .osu beatmap file, we can assume we're in a single beatmap folder.
					this.currentType = 'single';
					
					let beatmapSet = new BeatmapSet(this.input);

					// Load entries and metadata here instead of later, so that the import into the carousel is instant
					await beatmapSet.loadEntries();
					await beatmapSet.loadMetadata();

					this.beatmapSets = beatmapSet.defective? [] : [beatmapSet];
					break;
				}
			}

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

				if (!newSet.defective) this.beatmapSets.push(newSet);
				else this.defectiveBeatmapSetCount++;
			}

			// If we've seen multiple beatmap directories already, we can assume we're in a directory of beatmap directories.
			if (this.beatmapSets.length >= 5) this.currentType = 'multiple';
		}

		if (this.currentType === 'undetermined') this.currentType = 'multiple';

		if (this.defectiveBeatmapSetCount > 0 && this.currentType === 'multiple') {
			console.info(this.defectiveBeatmapSetCount + " beatmap set(s) not imported because they were defective.");
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
		return (this.currentType === 'multiple')? {
			dataCompleted: this.beatmapSets.length
		} : null;
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
	private processedBeatmaps: number = 0;
	private totalBeatmaps: number = 0;

	get descriptor() {return "Processing beatmap metadata"}
	get show() {return true}
	get isPerformanceIntensive() {return true}

	async init() {
		let total = 0;

		for (let i = 0; i < this.input.length; i++) {
			total += this.input[i].entries.length;
		}

		this.totalBeatmaps = total;
	}

	async resume() {
		if (this.settled) return;
		if (!this.paused) return;
		this.paused = false;

		let idAtStart = this.id;

		for (this.currentIndex; this.currentIndex < this.input.length; this.currentIndex++) {
			if (this.id !== idAtStart) return;

			let set = this.input[this.currentIndex];
			await set.loadMetadata();

			this.processedBeatmaps += set.entries.length;
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
		if (this.totalBeatmaps === 0) return null;

		return {
			completion: this.processedBeatmaps / this.totalBeatmaps,
			dataCompleted: this.processedBeatmaps,
			dataTotal: this.totalBeatmaps
		};
	}
}