import { BeatmapSet } from "./beatmap_set";
import { CustomEventEmitter } from "../../util/custom_event_emitter";
import { VirtualDirectory } from "../../file_system/virtual_directory";
import { Task } from "../../multithreading/task";
import { VirtualFileSystemEntry } from "../../file_system/virtual_file_system_entry";
import { globalState } from "../../global_state";
import { startJob } from "../../multithreading/job_system";
import { removeItem, wait, chooseGrammaticalNumber, addNounToNumber } from "../../util/misc_util";
import { BeatmapEntry } from "./beatmap_entry";
import { VirtualFile } from "../../file_system/virtual_file";
import { isOsuBeatmapFile } from "../../util/file_util";
import { NotificationType } from "../../menu/notifications/notification";

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
	/** @param areNew Indicates that all imported sets are fresh and new and haven't been imported before. */
	async addBeatmapSets(beatmapSets: BeatmapSet[], defectiveSetCount = 0, areNew: boolean) {
		for (let set of beatmapSets) {
			set.addListener('change', () => this.emit('change', set));
			set.addListener('remove', () => {
				removeItem(this.beatmapSets, set);
				this.emit('remove', set);
			});
			set.addListener('removeEntry', (entry) => this.emit('removeEntry', entry));
		}

		this.beatmapSets.push(...beatmapSets);
		this.emit('add', beatmapSets);

		let entryLoadNeeded = beatmapSets.filter(x => !x.entriesLoaded);
		let metadataLoadNeeded = beatmapSets.filter(x => !x.metadataLoaded);
		let loadEntriesTask: LoadBeatmapEntriesTask;
		let loadMetadataTask: LoadBeatmapMetadataTask;

		if (entryLoadNeeded.length > 0) {
			loadEntriesTask = new LoadBeatmapEntriesTask(entryLoadNeeded);
			loadEntriesTask.start();
		}

		if (metadataLoadNeeded.length > 0) {
			loadMetadataTask = new LoadBeatmapMetadataTask(metadataLoadNeeded);
			if (loadEntriesTask) loadMetadataTask.waitFor(loadEntriesTask);
			else loadMetadataTask.start(); // Start it directly, since there is no other task to wait for

			globalState.notificationPanel.showNotification("Beatmap import ongoing", `Importing ${addNounToNumber(beatmapSets.length, "beatmap set", "beatmap sets")}...`, NotificationType.Neutral, true);
		}

		const complete = async () => {
			// Generate the import completion notification
			if (!loadMetadataTask) {
				if (beatmapSets.length === 0 && areNew) {
					globalState.notificationPanel.showNotification("Beatmap import", "No beatmaps have been imported.", NotificationType.Warning);
				}

				return;
			}

			let loadMetadataResult = await loadMetadataTask.getResult();
			loadMetadataResult.defectiveSets += defectiveSetCount; // Add the sets that were already ruled out in the initial scanthrough of the folder

			let str = `${addNounToNumber(loadMetadataResult.processedBeatmaps, "beatmap", "beatmaps")} from ${addNounToNumber(beatmapSets.length - loadMetadataResult.defectiveSets, "beatmap set", "beatmap sets")} have been imported successfully. `;

			let errorSentence = "";
			let errorElementCount = 0;

			if (loadMetadataResult.defectiveEntries > 0) {
				errorSentence += `${addNounToNumber(loadMetadataResult.defectiveEntries, "beatmap", "beatmaps")}`;
				errorElementCount += loadMetadataResult.defectiveEntries;
			}
			if (loadMetadataResult.defectiveSets > 0) {
				if (errorSentence.length > 0) errorSentence += " and ";
				errorSentence += `${addNounToNumber(loadMetadataResult.defectiveSets, "beatmap set", "beatmap sets")}`;
				errorElementCount += loadMetadataResult.defectiveSets;
			}
			if (errorElementCount > 0) {
				errorSentence += ` ${chooseGrammaticalNumber(errorElementCount, "was", "were")} not imported because ${chooseGrammaticalNumber(errorElementCount, "it was", "they were")} defective.`;
				str += ' ' + errorSentence;
			}

			globalState.notificationPanel.showNotification("Beatmap import completed", str, NotificationType.Neutral);
		};

		if (loadMetadataTask) loadMetadataTask.getResult().then(complete);
		else complete();
	}

	reopenImportedDirectories(directories: VirtualDirectory[]) {
		if (directories.length === 0) return;

		let task = new ImportBeatmapsFromDirectoriesTask(directories);
		task.start();
		task.show(); // Actually show the task in the notification panel
	}
}

/** Imports all beatmap sets from a list of directories. */
export class ImportBeatmapsFromDirectoriesTask extends Task<VirtualDirectory[], {
	beatmapSets: BeatmapSet[],
	defectiveSets: number
}> {
	private processed = new Set<VirtualFileSystemEntry>();
	/** Per directory, the names of entries that should be ignored when iterating. */
	private ignoreDirectoryNames = new WeakMap<VirtualDirectory, Set<string>>();
	private beatmapSets: BeatmapSet[] = [];
	private paused = true;
	private id = 0;
	/** The selected input directories could either be a directory of beatmap directories, or just a single beatmap directory. Which one is the case needs to be detected first, and this variable stores the state of that detection. */
	private currentType: WeakMap<VirtualDirectory, 'undetermined' | 'multiple' | 'single'> = new WeakMap();
	private defectiveBeatmapSetCount = 0;

	get descriptor() {return "Scanning for new beatmaps"}
	get showAutomatically() {return false}
	get isPerformanceIntensive() {return true}

	async init() {
		let storedBeatmapSets: BeatmapSet[] = [];

		for (let directory of this.input) {
			// Set the default values
			this.currentType.set(directory, 'undetermined');
			this.ignoreDirectoryNames.set(directory, new Set());

			// Query the database for stored beatmap descriptions for this directory handle
			let storedDescriptions = await globalState.database.getAll('beatmapSet', 'parentDirectoryHandleId', directory.directoryHandleId);

			for (let desc of storedDescriptions) {
				if (!desc.defective) {
					// Create the beatmap set
					let beatmapSet = await BeatmapSet.fromDescription(desc, directory);
					storedBeatmapSets.push(beatmapSet);
				}
				
				// Make sure we don't reimport the beatmap with the same directory name
				this.ignoreDirectoryNames.get(directory).add(desc.directory.name);
			}

			if (storedDescriptions.length) {
				this.currentType.set(directory, 'multiple');
			}
		}

		globalState.beatmapLibrary.addBeatmapSets(storedBeatmapSets, 0, false);
	}

	async resume() {
		if (this.settled) return;
		if (!this.paused) return;
		this.paused = false;

		let idAtStart = this.id;

		for (let directory of this.input) {
			for await (let entry of directory) {
				if (this.id !== idAtStart) return;
	
				// If we've already processed this entry, skip it
				if (this.processed.has(entry)) continue;
				this.processed.add(entry);
	
				if (entry instanceof VirtualFile) {
					// If we already know we're searching through a list of beatmap directories, we can ignore files
					if (this.currentType.get(directory) === 'multiple') continue;
	
					if (isOsuBeatmapFile(entry.name)) {
						// If we find a single .osu beatmap file, we can assume we're in a single beatmap folder.
						this.currentType.set(directory, 'single');
						
						let beatmapSet = new BeatmapSet(directory);
	
						// Load entries and metadata here instead of later, so that the import into the carousel is instant
						await beatmapSet.loadEntries();
						await beatmapSet.loadMetadata();
	
						this.beatmapSets = beatmapSet.defective? [] : [beatmapSet];
						break;
					}
				}
	
				if (!(entry instanceof VirtualDirectory)) continue;
				if (this.ignoreDirectoryNames.get(directory).has(entry.name)) continue;
	
				let match = beatmapFolderRegex.exec(entry.name);
				if (match) {
					// Get a quick and dirty estimate of the title and arist as a placeholder before actual metadata is loaded.
					let title = match[2];
					let artist = match[1];
	
					let newSet = new BeatmapSet(entry);
					newSet.setBasicMetadata(title, artist, null, true);
	
					this.beatmapSets.push(newSet);
				} else {
					// The folder doesn't follow the usual naming convention. In this case, we pre-parse the metadata.
					let newSet = new BeatmapSet(entry);
					await newSet.loadEntries();
	
					if (!newSet.defective) this.beatmapSets.push(newSet);
					else this.defectiveBeatmapSetCount++;
				}
	
				// If we've seen multiple beatmap directories already, we can assume we're in a directory of beatmap directories.
				if (this.beatmapSets.length >= 5) this.currentType.set(directory, 'multiple');
			}
	
			if (this.currentType.get(directory) === 'undetermined') this.currentType.set(directory, 'multiple');
		}

		// Count it as new if there is exactly one directory input that hasn't yet been stored in the database
		let isNew = this.input.length === 1 && !(await globalState.database.get('directoryHandle', 'id', this.input[0].directoryHandleId));

		globalState.beatmapLibrary.addBeatmapSets(this.beatmapSets, this.defectiveBeatmapSetCount, isNew);
		this.setResult({
			beatmapSets: this.beatmapSets,
			defectiveSets: this.defectiveBeatmapSetCount
		});

		// Store all directory handles
		for (let directory of this.input) {
			if (directory.directoryHandleId && this.currentType.get(directory) === 'multiple') await globalState.database.put('directoryHandle', {
				handle: await directory.getHandle(),
				id: directory.directoryHandleId,
				permissionGranted: true
			});
		}
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
		return (this.beatmapSets.length >= 5)? {
			dataCompleted: this.beatmapSets.length
		} : null;
	}

	getProgressMessage() {
		return `Found ${addNounToNumber(this.beatmapSets.length, 'new beatmap set', 'new beatmap sets')} (${this.processed.size} scanned)`;
	}
}

/** Loads all the entries in a list of beatmap sets. */
export class LoadBeatmapEntriesTask extends Task<BeatmapSet[], void> {
	private currentIndex = 0;
	private paused = true;
	private id = 0;

	get descriptor() {return "Importing beatmap sets"}
	get showAutomatically() {return true}
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
export class LoadBeatmapMetadataTask extends Task<BeatmapSet[], {
	defectiveEntries: number,
	defectiveSets: number,
	processedBeatmaps: number
}> {
	private currentIndex = 0;
	private paused = true;
	private id = 0;
	private processedBeatmaps: number = 0;
	private totalBeatmaps: number = 0;
	private defectiveEntries = 0;
	private defectiveSets = 0;

	get descriptor() {return "Processing beatmap metadata"}
	get showAutomatically() {return true}
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
			let entryCountBefore = set.entries.length;
			await set.loadMetadata();

			if (set.defective) this.defectiveSets++;
			this.defectiveEntries += entryCountBefore - set.entries.length;
			this.processedBeatmaps += set.entries.length;
		}

		this.setResult({
			defectiveEntries: this.defectiveEntries,
			defectiveSets: this.defectiveSets,
			processedBeatmaps: this.processedBeatmaps
		});
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