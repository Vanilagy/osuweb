import { CustomEventEmitter } from "../../util/custom_event_emitter";
import { Searchable, createSearchableString } from "../../util/misc_util";
import { VirtualFile } from "../../file_system/virtual_file";
import { VirtualDirectory } from "../../file_system/virtual_directory";
import { BasicBeatmapData, BeatmapUtil } from "../../util/beatmap_util";
import { BeatmapEntry } from "./beatmap_entry";
import { isOsuBeatmapFile } from "../../util/file_util";
import { startJob } from "../../multithreading/job_system";
import { JobUtil } from "../../multithreading/job_util";
import { Skin } from "../../game/skin/skin";

/** Extracts artist, title, mapper and version from a beatmap file name. */
const metadataExtractor = /^(.+) - (.+) \((.+)\) \[(.+)\]\.osu$/;

export class BeatmapSet extends CustomEventEmitter<{change: void}> implements Searchable {
	// These lower-case versions exist to enable faster sorting
	public title: string = "<title>";
	public titleLowerCase: string = "<title>";
	public artist: string = "<artist>";
	public artistLowerCase: string = "<artist>";
	public creator: string = "<creator>";
	public creatorLowerCase: string = "<creator>";

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

	getVersionFromFileName(fileName: string) {
		let openingBracketPos = fileName.lastIndexOf('[');
		let closingBracketPos = fileName.lastIndexOf(']');

		if (openingBracketPos < 0 || closingBracketPos < 0) return null;

		return fileName.substr(openingBracketPos, closingBracketPos - openingBracketPos);
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

					let version = this.getVersionFromFileName(fileEntry.name);

					if (version !== null) {
						// We were able to extract the version name from the file name.
						beatmapEntry.version = version;
					} else {
						beatmapEntry.version = "loading...";
					}

					this.entries.push(beatmapEntry);
				}
			}

			try {
				let blob = await this.entries[0].resource.getBlob();
				this.basicData = await startJob("getBasicBeatmapData", blob);
				this.setBasicMetadata(this.basicData.title, this.basicData.artist, this.basicData.creator);

				this.entriesLoaded = true;
			} catch (e) {
				console.log(this.directory);
				//console.log(this.entries[0].resource);
				console.log("HAAAAAAAAAA");
			}
			
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
		if (!this.basicData) return;

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
				} else {
					console.log(data, this);
					
					this.entries.splice(i, 1);
					metadata.splice(i, 1);
					i--;
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