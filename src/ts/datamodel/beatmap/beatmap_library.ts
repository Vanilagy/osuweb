import { BeatmapSet } from "./beatmap_set";
import { CustomEventEmitter } from "../../util/custom_event_emitter";
import { VirtualDirectory } from "../../file_system/virtual_directory";
import { Task } from "../../multithreading/task";
import { VirtualFileSystemEntry } from "../../file_system/virtual_file_system_entry";
import { globalState } from "../../global_state";
import { removeItem, chooseGrammaticalNumber, addNounToNumber, addUnitToBytes } from "../../util/misc_util";
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

	/** Loads all beatmaps that have fully been stored. */
	async loadStoredBeatmaps() {
		let storedBeatmaps = await globalState.database.getAll('beatmapSet', 'stored', true);
		let beatmapSets: BeatmapSet[] = [];

		for (let desc of storedBeatmaps) {
			if (desc.defective) continue;
			beatmapSets.push(await BeatmapSet.fromDescription(desc, null));
		}

		this.addBeatmapSets(beatmapSets, 0, false, new Set());
	}

	/** Adds beatmap sets and begins loading their metadata. */
	/** @param areNew Indicates that all imported sets are fresh and new and haven't been imported before. */
	async addBeatmapSets(beatmapSets: BeatmapSet[], defectiveSetCount = 0, areNew: boolean, toStore: Set<BeatmapSet>, handlesToRemoveAfterStore: string[] = []) {
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

		// Start a storing task with all beatmap sets needing storing
		let storeNeeded = beatmapSets.filter(x => toStore.has(x) && !x.stored);
		if (storeNeeded.length > 0) {
			let storeTask = new StoreBeatmapsTask({ beatmapSets: storeNeeded, removeHandles: handlesToRemoveAfterStore });
			storeTask.start();
		}

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
	get canBeCancelled() {return false}

	/** Take care of loading beatmaps whose metadata has been stored. This is only really gonna do something for native file system directories. */
	async init() {
		let beatmapSets: BeatmapSet[] = [];
		let toStore = new Set<BeatmapSet>(); // Remember the beatmap sets that still need full storing
		let handlesToRemove = new Set<string>(); // All the directory handle ids that contain atleast one beatmap that still needs full storing

		for (let directory of this.input) {
			// Set the default values
			this.currentType.set(directory, 'undetermined');
			this.ignoreDirectoryNames.set(directory, new Set());

			// Query the database for stored beatmap descriptions for this directory handle
			let handleDescription = await globalState.database.get('directoryHandle', 'id', directory.directoryHandleId);
			let storedDescriptions = await globalState.database.getAll('beatmapSet', 'parentDirectoryHandleId', directory.directoryHandleId);

			for (let desc of storedDescriptions) {
				if (!desc.defective && !desc.stored) { // Stored beatmaps will already have been imported
					// Create the beatmap set
					let beatmapSet = await BeatmapSet.fromDescription(desc, directory);
					beatmapSets.push(beatmapSet);

					if (handleDescription.storeBeatmaps) {
						toStore.add(beatmapSet);
						handlesToRemove.add(directory.directoryHandleId);
					}
				}
				
				// Make sure we don't reimport the beatmap with the same directory name
				this.ignoreDirectoryNames.get(directory).add(desc.directory.name);
			}

			if (storedDescriptions.length) {
				this.currentType.set(directory, 'multiple');
			}
		}

		globalState.beatmapLibrary.addBeatmapSets(beatmapSets, 0, false, toStore, [...handlesToRemove]);
	}

	async resume() {
		if (this.settled) return;
		if (!this.paused) return;
		this.paused = false;

		let idAtStart = this.id;

		for (let directory of this.input) {
			let directoryHandleDescription = await globalState.database.get('directoryHandle', 'id', this.input[0].directoryHandleId);
			// This directory is instructed to store its beatmaps, which means that it's already gone through this pipeline once and now only needs to finish storing the rest of the beatmaps. Therefore continue here, because we don't want to search for new beatmaps.
			if (directoryHandleDescription?.storeBeatmaps) continue;

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

		let approxSizePerBeatmap = 17_889_742_993 / 1656; // A rough estimation based on an actual osu! Songs folder
		let estimatedCopySize = approxSizePerBeatmap * this.beatmapSets.length;
		let criticalLimit = 5 * 10**9; // 5 GB seems reasonable?

		// If a single beatmap was selected, or the user opts in to store, store.
		let doStore = isNew && this.beatmapSets.length > 0 && ((this.currentType.get(this.input[0]) === 'single') || (await globalState.popupManager.createConfirm(
			"Store beatmaps?",
			`Do you want to fully store all imported beatmap sets (${this.beatmapSets.length}) in the browser (including all beatmaps, images, videos, etc.) so that they are available next time without a reload of this folder?\n\nEstimated data to copy: ${addUnitToBytes(estimatedCopySize)}.`, 
			estimatedCopySize >= criticalLimit,
			(estimatedCopySize >= criticalLimit)? "WARNING: The imported folder is very large and will take a long time and a lot of additional disk space to copy." : null
		)) === 'yes');

		globalState.beatmapLibrary.addBeatmapSets(this.beatmapSets, this.defectiveBeatmapSetCount, isNew, new Set(doStore? this.beatmapSets : []), [this.input[0].directoryHandleId]);
		this.setResult({
			beatmapSets: this.beatmapSets,
			defectiveSets: this.defectiveBeatmapSetCount
		});

		// Store all directory handles
		for (let directory of this.input) {
			if (directory.directoryHandleId && this.currentType.get(directory) === 'multiple') {
				let data = await globalState.database.get('directoryHandle', 'id', directory.directoryHandleId);
				if (data) data.permissionGranted = true; // Since this directory has been reimported, permission is now definitely granted.
				else data = {
					handle: await directory.getHandle(),
					id: directory.directoryHandleId,
					permissionGranted: true,
					storeBeatmaps: doStore
				};

				await globalState.database.put('directoryHandle', data);
			} 
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
	get canBeCancelled() {return false}

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
	get canBeCancelled() {return false}

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

/** Completely stores all beatmap sets and their files on disk. */
export class StoreBeatmapsTask extends Task<{
	beatmapSets: BeatmapSet[],
	removeHandles: string[]
}, void> {
	private currentIndex = 0;
	private paused = true;
	private id = 0;

	get descriptor() {return "Storing beatmap sets"}
	get showAutomatically() {return true}
	get isPerformanceIntensive() {return true}
	get canBeCancelled() {return true}

	async init() {}

	async resume() {
		if (this.settled) return;
		if (!this.paused) return;
		this.paused = false;

		let idAtStart = this.id;

		for (this.currentIndex; this.currentIndex < this.input.beatmapSets.length; this.currentIndex++) {
			if (this.id !== idAtStart) return;

			let set = this.input.beatmapSets[this.currentIndex];
			await set.storeDirectory();
		}

		this.setResult();
		globalState.notificationPanel.showNotification("Beatmap storing complete", "All beatmaps have been stored successfully and will now persist between page loads.");

		// Remove all the handles since their contents have been completely stored and we don't want to annoy the user with a permission popup despite there being absolutely no need for a folder import.
		for (let id of this.input.removeHandles) {
			globalState.database.delete('directoryHandle', id);
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
		return {
			completion: this.currentIndex / this.input.beatmapSets.length,
			dataCompleted: this.currentIndex,
			dataTotal: this.input.beatmapSets.length
		};
	}

	async onDestroy() {
		// Set all handles back to not storing beatmaps to make them act like regular directory handles.
		for (let id of this.input.removeHandles) {
			let handleData = await globalState.database.get('directoryHandle', 'id', id);
			handleData.storeBeatmaps = false;

			await globalState.database.put('directoryHandle', handleData);
		}
	}
}