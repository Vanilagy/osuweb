import { CustomEventEmitter } from "../../util/custom_event_emitter";
import { Searchable, createSearchableString, removeItem, assert } from "../../util/misc_util";
import { VirtualFile } from "../../file_system/virtual_file";
import { VirtualDirectory, VirtualDirectoryDescription } from "../../file_system/virtual_directory";
import { BasicBeatmapData, BeatmapUtil } from "../../util/beatmap_util";
import { BeatmapEntry, BeatmapEntryDescription } from "./beatmap_entry";
import { isOsuBeatmapFile } from "../../util/file_util";
import { startJob } from "../../multithreading/job_system";
import { JobUtil } from "../../multithreading/job_util";
import { Skin } from "../../game/skin/skin";
import { globalState } from "../../global_state";
import { NotificationType } from "../../menu/notifications/notification";

/** Extracts artist, title, mapper and version from a beatmap file name. */
const metadataExtractor = /^(.+) - (.+) \((.+)\) \[(.+)\]\.osu$/;

export class BeatmapSet extends CustomEventEmitter<{change: void, remove: void, removeEntry: BeatmapEntry}> implements Searchable {
	public id: string;

	// These lower-case versions exist to enable faster sorting
	public title: string;
	public titleLowerCase: string;
	public artist: string;
	public artistLowerCase: string;
	public creator: string;
	public creatorLowerCase: string;

	public directory: VirtualDirectory;
	/** Whether or not this entire beatmap, including all files, has been stored. */
	public stored = false;
	/** Basic data about the beatmap "representing" this beatmap set. Just gotta pick one. */
	public basicData: BasicBeatmapData = null;
	public searchableString: string = "";

	public entries: BeatmapEntry[] = [];

	private entriesLoadingPromise: Promise<void>;
	public entriesLoaded = false;
	private metadataLoadingPromise: Promise<void>;
	public metadataLoaded = false;
	/** Whether or not this beatmap set is defective and/or as been removed. Reasons for defectiveness often include errors during file loading. Defective beatmap sets should not be used! */
	public defective = false;

	constructor(directory: VirtualDirectory, id?: string) {
		super();

		this.id = id ?? ULID.ulid(); // Generate a new ID if necessary
		this.directory = directory;
	}

	setBasicMetadata(title: string, artist: string, creator?: string, doStore = false) {
		this.title = title;
		this.titleLowerCase = title.toLowerCase();
		this.artist = artist;
		this.artistLowerCase = artist.toLowerCase();
		this.creator = creator;
		this.creatorLowerCase = creator?.toLowerCase();

		this.updateSearchableString();
		if (doStore) this.storeMetadata();
	}

	updateSearchableString() {
		// If basic data is already loaded, create the searchable string from that data. Otherwise, use the metadata from this beatmap set itself.
		if (this.basicData) {
			// Note! This doesn't include any difficulty names.
			let arr = [this.basicData.title, this.basicData.artist, this.basicData.creator, this.basicData.tags];
			if (this.basicData.titleUnicode) arr.push(this.basicData.titleUnicode);
			if (this.basicData.artistUnicode) arr.push(this.basicData.artistUnicode);

			this.searchableString = createSearchableString(arr);
		} else {
			this.searchableString = createSearchableString([this.title, this.artist]);
		}
	}

	/** Loads all beatmap entries (all the beatmaps of this set). Additionally, loads basic metadata about the beatmap set. */
	loadEntries() {
		// Entries are already loading, return the ongoing promise.
		if (this.entriesLoadingPromise) return this.entriesLoadingPromise;
		if (this.entriesLoaded) return;

		let promise = new Promise<void>(async (resolve) => {
			for await (let fileEntry of this.directory) {
				if (!(fileEntry instanceof VirtualFile)) continue;

				outer:
				if (isOsuBeatmapFile(fileEntry.name)) {
					let beatmapEntry = new BeatmapEntry(this, fileEntry.name);
					let match = metadataExtractor.exec(fileEntry.name);

					if (match && match[4] !== undefined) {
						// We were able to extract the version name from the file name.
						beatmapEntry.version = match[4];
					} else {
						try {
							// We weren't able to extract the version name easily. In this case, go parse the beatmap.
							let blob = await fileEntry.getBlob();
							let basicData: BasicBeatmapData;
							basicData = await startJob("getBasicBeatmapData", blob);

							beatmapEntry.version = basicData.version;
						} catch (e) {
							// There was an error getting basic beatmap data; discard this beatmap entry.
							break outer;
						}
					}

					this.entries.push(beatmapEntry);
				}
			}

			if (this.entries.length === 0) {
				// Beatmap sets with zero beatmaps are practically useless and shouldn't even be considered beatmap sets.
				this.defective = true;
			} else {
				try {
					let blob = await (await this.entries[0].getFile()).getBlob();
					this.basicData = await startJob("getBasicBeatmapData", blob);
					this.setBasicMetadata(this.basicData.title, this.basicData.artist, this.basicData.creator);
	
					this.entriesLoaded = true;
					this.emit('change');
				} catch (e) {
					console.info("Error loading entries for beatmap set: ", e);
					this.defective = true;
				}
			}

			if (this.defective) {
				this.remove();
				globalState.notificationPanel.showNotification("Error importing beatmap set", `Could not import the folder "${this.directory.name}".`, NotificationType.Error);
			}
			
			await this.storeMetadata();
			resolve();
		});
		this.entriesLoadingPromise = promise;

		return promise;
	}

	/** Loads the complete metadata of all the entries in the set (including difficulty). */
	loadMetadata() {
		// Metadata is already loading, return the ongoing promise.
		if (this.metadataLoadingPromise) return this.metadataLoadingPromise;
		if (!this.basicData || this.defective) return;
		if (this.metadataLoaded) return;

		let promise = new Promise<void>(async (resolve) => {
			if (!this.entriesLoaded) await this.loadEntries();

			let allFiles = await Promise.all(this.entries.map(x => x.getFile()));
			let metadata = await JobUtil.getBeatmapMetadataAndDifficultyFromFiles(allFiles);
			let i = 0;
	
			for (let entry of this.entries.slice()) { // Duplicate the array as it could shrink during iteration
				let data = metadata[i++];

				if (data.status === 'fulfilled') {
					entry.extendedMetadata = data.value;
					entry.version = data.value.version;
				} else {
					console.info("Error loading metadata: ", this, data.reason);
					this.removeEntry(entry);

					globalState.notificationPanel.showNotification("Error loading beatmap difficulty", `Could not load beatmap "${entry.path}" in beatmap set "${this.directory.name}"`, NotificationType.Error);
				}
			}
	
			this.metadataLoaded = true;
			this.emit('change');

			await this.storeMetadata();
			resolve();
		});
		this.metadataLoadingPromise = promise;

		return promise;
	}

	/** Removes this beatmap set and labels it as defective. */
	remove() {
		this.defective = true;
		this.emit('remove');

		globalState.database.delete('beatmapSet', this.id);
	}

	/** Removes a specific beatmap entry. */
	removeEntry(entry: BeatmapEntry) {
		let removed = removeItem(this.entries, entry);
		if (!removed) return;

		this.emit('removeEntry', entry);
		if (this.entries.length === 0) this.remove();
	}

	async getBeatmapSkin() {
		let skin = new Skin(this.directory);
		await skin.init();

		return skin;
	}

	async getStoryboardFile() {
		for await (let entry of this.directory) {
			if (entry instanceof VirtualFile && entry.name.endsWith(".osb")) return entry;
		}

		return null;
	}

	async getBackgroundImage() {
		return this.basicData && await this.entries[0].beatmapSet.directory.getFileByPath(this.basicData.imageName);
	}

	/** Returns an identifier for the song of this beatmap set. Can be compared to other beatmaps to see if they represent the same song. Should be fine for most cases! */
	getSongIdentifier() {
		// Using the "unit separator" control symbol here.
		return this.title + '\u0031' + this.artist;
	}

	/** Stores the necessary metadata to, together with the files, completely reconstruct this beatmap set. */
	async storeMetadata() {
		await globalState.database.put('beatmapSet', await this.toDescription());
	}

	/** Stores everything, so metadata and all files. */
	async storeDirectory() {
		if (this.stored) return;

		let description = await this.directory.toDescription(true);
		await globalState.database.put('directory', description);

		this.stored = true;
		await this.storeMetadata();
	}

	async toDescription(): Promise<BeatmapSetDescription> {
		return {
			id: this.id,
			directory: await this.directory.toDescription(false),
			parentDirectoryHandleId: this.directory.parent?.directoryHandleId,
			stored: this.stored,
			basicData: this.basicData,
			entries: await Promise.all(this.entries.map(entry => entry.toDescription())),
			title: this.title,
			artist: this.artist,
			creator: this.creator,
			entriesLoaded: this.entriesLoaded,
			metadataLoaded: this.metadataLoaded,
			defective: this.defective
		};
	}

	static async fromDescription(description: BeatmapSetDescription, parentDirectory: VirtualDirectory) {
		assert(!description.defective); // Defective beatmaps should never reach this method

		let directory = await VirtualDirectory.fromDescription(description.directory);
		if (description.stored) {
			directory.requiresDatabaseImport = true;
			directory.isNativeFileSystem = false;
		}

		parentDirectory?.addEntry(directory);
		let set = new BeatmapSet(directory, description.id);

		set.setBasicMetadata(description.title, description.artist, description.creator);
		set.basicData = description.basicData;
		set.entries = description.entries.map(entry => BeatmapEntry.fromDescription(entry, set));
		set.entriesLoaded = description.entriesLoaded;
		set.metadataLoaded = description.metadataLoaded;
		set.updateSearchableString();
		set.stored = description.stored;

		return set;
	}
}

export interface BeatmapSetDescription {
	id: string,
	directory: VirtualDirectoryDescription,
	/** Incase the parent directory is a directory handle, store its ID so we can load this beatmap from the database when the same folder is selected again. */
	parentDirectoryHandleId?: string,
	stored: boolean,
	basicData: BasicBeatmapData,
	entries: BeatmapEntryDescription[],
	title: string,
	artist: string,
	creator: string,
	entriesLoaded: boolean,
	metadataLoaded: boolean,
	defective: boolean
}