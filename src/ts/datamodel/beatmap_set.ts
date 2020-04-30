import { VirtualDirectory } from "../file_system/virtual_directory";
import { VirtualFile } from "../file_system/virtual_file";
import { Skin } from "../game/skin/skin";
import { BeatmapUtil, BasicBeatmapData } from "../util/beatmap_util";
import { CustomEventEmitter } from "../util/custom_event_emitter";
import { BeatmapEntry } from "./beatmap_entry";
import { JobUtil } from "../multithreading/job_util";
import { Searchable, createSearchableString } from "../util/misc_util";
import { startJob } from "../multithreading/job_system";
import { JobTask } from "../multithreading/job";
import { isOsuBeatmapFile } from "../util/file_util";

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
		if (this.basicData) this.searchableString = BeatmapUtil.getSearchableStringFromBasicData(this.basicData);
		else this.searchableString = createSearchableString([this.title, this.artist]);
	}

	/** Loads all beatmap entries (all the beatmaps of this set). Additionally, loads basic metadata about the beatmap set. */
	loadEntries() {
		// Entries are already loading, return the ongoing promise.
		if (this.entriesLoadingPromise) return this.entriesLoadingPromise;

		let promise = new Promise<void>(async (resolve) => {
			for await (let entry of this.directory) {
				if (!(entry instanceof VirtualFile)) continue;

				if (isOsuBeatmapFile(entry.name)) {
					this.entries.push(new BeatmapEntry(this, entry));
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
				let data = metadata[i];
				if (data.status === 'fulfilled') this.entries[i].extendedMetadata = data.value;
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