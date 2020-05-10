import { CustomEventEmitter } from "../../util/custom_event_emitter";
import { Searchable, createSearchableString } from "../../util/misc_util";
import { VirtualFile } from "../../file_system/virtual_file";
import { VirtualDirectory } from "../../file_system/virtual_directory";
import { BasicBeatmapData, BeatmapUtil } from "../../util/beatmap_util";
import { BeatmapEntry } from "./beatmap_entry";
import { isOsuBeatmapFile } from "../../util/file_util";
import { startJob } from "../../multithreading/job_system";
import { JobTask } from "../../multithreading/job";
import { JobUtil } from "../../multithreading/job_util";
import { Skin } from "../../game/skin/skin";

/** Extracts artist, title, mapper and version from a beatmap file name. */
const metadataExtractor = /^(.+) - (.+) \((.+)\) \[(.+)\]\.osu$/;

export class BeatmapSet extends CustomEventEmitter<{change: void}> implements Searchable {
	// These lower-case versions exist to enable faster sorting
	public title: string;
	public titleLowerCase: string;
	public artist: string;
	public artistLowerCase: string;
	public creator: string;
	public creatorLowerCase: string;

	public imageFile: VirtualFile;
	public directory: VirtualDirectory;
	/** Basic data about the beatmap "representing" this beatmap set. Just gotta pick one. */
	public basicData: BasicBeatmapData = null;
	public searchableString: string = "";

	public entries: BeatmapEntry[] = [];

	private entriesLoadingPromise: Promise<void>;
	public entriesLoaded = false;
	private metadataLoadingPromise: Promise<void>;
	public metadataLoaded = false;

	constructor(directory: VirtualDirectory) {
		super();
		this.directory = directory;
	}

	setBasicMetadata(title: string, artist: string, creator?: string) {
		this.title = title;
		this.titleLowerCase = title.toLowerCase();
		this.artist = artist;
		this.artistLowerCase = artist.toLowerCase();
		this.creator = creator;
		this.creatorLowerCase = creator?.toLowerCase();

		this.updateSearchableString();
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

		let promise = new Promise<void>(async (resolve) => {
			for await (let fileEntry of this.directory) {
				if (!(fileEntry instanceof VirtualFile)) continue;

				if (isOsuBeatmapFile(fileEntry.name)) {
					let beatmapEntry = new BeatmapEntry(this, fileEntry);
					let match = metadataExtractor.exec(fileEntry.name);

					if (match && match[4] !== undefined) {
						// We were able to extract the version name from the file name.
						beatmapEntry.version = match[4];
					} else {
						// We weren't able to extract the version name easily. In this case, go parse the beatmap.
						let blob = await fileEntry.getBlob();
						let basicData = await startJob(JobTask.GetBasicBeatmapData, {
							beatmapResource: blob
						});

						beatmapEntry.version = basicData.version;
					}

					this.entries.push(beatmapEntry);
				}
			}

			let blob = await this.entries[0].resource.getBlob();
			this.basicData = await startJob(JobTask.GetBasicBeatmapData, {
				beatmapResource: blob
			});
			this.setBasicMetadata(this.basicData.title, this.basicData.artist, this.basicData.creator);

			this.entriesLoaded = true;
			this.emit('change');

			resolve();
		});
		this.entriesLoadingPromise = promise;

		return promise;
	}

	/** Loads the complete metadata of all the entries in the set (including difficulty). */
	loadMetadata() {
		// Entries is already loading, return the ongoing promise.
		if (this.metadataLoadingPromise) return this.metadataLoadingPromise;

		let promise = new Promise<void>(async (resolve) => {
			if (!this.entriesLoaded) await this.loadEntries();

			let allFiles = this.entries.map(x => x.resource);
			let metadata = await JobUtil.getBeatmapMetadataAndDifficultyFromFiles(allFiles);
	
			for (let i = 0; i < this.entries.length; i++) {
				let entry = this.entries[i];
				let data = metadata[i];

				if (data.status === 'fulfilled') {
					entry.extendedMetadata = data.value;
					entry.version = data.value.version;
				}
			}
	
			this.metadataLoaded = true;
			this.emit('change');

			resolve();
		});
		this.metadataLoadingPromise = promise;

		return promise;
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
}