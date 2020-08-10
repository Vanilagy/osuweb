import { VirtualFileSystemEntry, VirtualFileSystemEntryDescription } from "./virtual_file_system_entry";
import { VirtualFile, VirtualFileDescription } from "./virtual_file";
import { splitPath } from "../util/file_util";
import { assert } from "../util/misc_util";
import { globalState } from "../global_state";

export class VirtualDirectory extends VirtualFileSystemEntry {
	private entries: Map<string, VirtualFileSystemEntry>;
	private caseInsensitiveEntries: Map<string, VirtualFileSystemEntry>;
	
	/** If this is set, and a file is requested but not found, the network will be hit relative to this url to find the file. */
	public networkFallbackUrl: string;
	/** In order to prevent hitting the network twice for a 404 resource. */
	private failedNetworkFallbacks: Set<string>;

	/** If the directory was created using the Native File System API, this will be set. */
	private directoryHandle: FileSystemDirectoryHandle = null
	/** The id of the handle which can be used to retrieve it from the database. */
	public directoryHandleId: string = null;
	/** Since iterating a directory handle is async, this flag will be set to true if we have successfully iterated over all entries in the directory (which then will be cached). */
	private directoryHandleEntriesIterated = false; 
	/** Used to wait for the next entry to be read, see usage. */
	private directoryHandleWaiter: Promise<void>;
	/** If this is true, the directory's contents must be fetched from IndexedDB first. */
	public requiresDatabaseImport = false;
	private databaseImportPromise: Promise<void>;

	constructor(name: string) {
		super();

		this.name = name;
		this.networkFallbackUrl = null;
		this.entries = new Map();
		this.caseInsensitiveEntries = new Map();
		this.failedNetworkFallbacks = new Set();
	}

	/** Adds an entry to this directory. */
	addEntry(entry: VirtualFileSystemEntry) {
		this.entries.set(entry.name, entry);
		this.caseInsensitiveEntries.set(entry.name.toLowerCase(), entry);

		entry.setParent(this);
	}

	/** Removes an entry from this directory. Note: If this directory is based on the Native File System API, this method won't do anything (yet). */
	removeEntry(entry: VirtualFileSystemEntry) {
		if (this.isNativeFileSystem) return;

		this.entries.delete(entry.name);
		this.caseInsensitiveEntries.delete(entry.name.toLowerCase());
	}

	/** Gets an entry in this directory by path. */
	async getEntryByPath(path: string, caseSensitive = false) {
		if (path === null || path === undefined) return null;

		let parts = splitPath(path);
		let currentDirectory: VirtualDirectory = this;

		for (let i = 0; i < parts.length; i++) {
			if (currentDirectory.requiresDatabaseImport) await currentDirectory.importFromDatabase();

			let part = parts[i];
			let entry: VirtualFileSystemEntry;

			if (part === '.') entry = currentDirectory; // Stay in the current directory
			else if (part === '..') entry = currentDirectory.parent; // Go up a level
			else {
				if (currentDirectory.isNativeFileSystem) {
					// If this directory is based on the Native File System API, finding an entry works slightly differently.
					// First, we try and get the entry the normal way (OS file system lookup is always case-insensitive!)
					entry = currentDirectory.caseInsensitiveEntries.get(part.toLowerCase());

					if (!entry) {
						// If no entry was found, so we'll do a file system request
						let handle = await currentDirectory.getHandle();

						try {
							if (part.includes('.')) { // If file
								let fileHandle = await handle.getFile(part);
								let fileEntry = VirtualFile.fromFileHandle(fileHandle, false);
								currentDirectory.addEntry(fileEntry);
								entry = fileEntry;
							} else { // If directory
								let directoryHandle = await handle.getDirectory(part);
								let directoryEntry = VirtualDirectory.fromDirectoryHandle(directoryHandle, false);
								currentDirectory.addEntry(directoryEntry);
								entry = directoryEntry;
							}
						} catch (e) {}
					}
				} else {
					entry = caseSensitive? currentDirectory.entries.get(part) : currentDirectory.caseInsensitiveEntries.get(part.toLowerCase());
				}
			}
			
			if (entry) {
				if (i === parts.length-1) return entry; // We found the entry!
				else if (entry instanceof VirtualDirectory) currentDirectory = entry; // Step into the directory.
				else break;
			} else {
				break;
			}
		}

		if (this.networkFallbackUrl) {
			// Go hit the network and see if the file's there. Somewhere.

			let url = this.networkFallbackUrl + '/' + parts.join('/'); // We ignore case sensitivity here
			if (this.failedNetworkFallbacks.has(url)) return null;

			let response = await fetch(url);
			if (response.ok) {
				let blob = await response.blob();
				let file = VirtualFile.fromBlob(blob, path);

				this.addEntry(file);
				return file;
			} else {
				// Remember that this URL is not OK.
				this.failedNetworkFallbacks.add(url);
			}
		}

		return null;
	}

	async getFileByPath(path: string, caseSensitive = false) {
		let entry = await this.getEntryByPath(path, caseSensitive);

		if (entry instanceof VirtualFile) return entry as VirtualFile;
		return null;
	}

	async getAllEntries() {
		let entries: VirtualFileSystemEntry[] = [];

		for await (let entry of this) {
			entries.push(entry);
		}

		return entries;
	}

	/** Iterates through all entries in the directory handle (native file system-only!) */
	private async iterateHandle() {
		let resolver: Function;
		this.directoryHandleWaiter = new Promise(resolve => resolver = resolve);

		let handle = await this.getHandle();
		let entries = await handle.getEntries();

		for await (let entry of entries) {
			let fileSystemEntry: VirtualFileSystemEntry;

			// Check if it's already been added
			let existingEntry = this.entries.get(entry.name);
			if (existingEntry) continue;

			// Create a new virtual file system entry based on the type
			if (entry instanceof FileSystemFileHandle) {
				fileSystemEntry = VirtualFile.fromFileHandle(entry, false);
			} else if (entry instanceof FileSystemDirectoryHandle) {
				fileSystemEntry = VirtualDirectory.fromDirectoryHandle(entry, false);
			}

			// Add it to the entries cache
			this.addEntry(fileSystemEntry);

			resolver();
			this.directoryHandleWaiter = new Promise(resolve => resolver = resolve);
		}

		resolver();

		// When we reach this point, we'll have iterated through the entire directory once, meaning we have cached all entries and don't need to iterate over the directory directly again.
		this.directoryHandleEntriesIterated = true;
	}

	async *[Symbol.asyncIterator]() {
		if (this.isNativeFileSystem && !this.directoryHandleWaiter) this.iterateHandle();
		if (this.requiresDatabaseImport) await this.importFromDatabase();

		await this.directoryHandleWaiter;

		// Kind of a hacky construct going on here, because we wait inside the iterator for the iterated data structure to get larger so that iteration doesn't stop. Hey, works!
		for (let [, entry] of this.entries) {
			yield entry;

			// If there still are new entries coming in the pipeline, wait for them.
			if (this.isNativeFileSystem && !this.directoryHandleEntriesIterated) await this.directoryHandleWaiter;
		}
	}

	/** If this directory is based on the Native File System API, get the corresponding directory handle object. */
	async getHandle(): Promise<FileSystemDirectoryHandle> {
		assert(this.isNativeFileSystem);

		if (this.directoryHandle) {
			return this.directoryHandle;
		} else {
			let parentHandle = await this.parent.getHandle();
			let handle = await parentHandle.getDirectory(this.name);

			return handle;
		}
	}

	/** Load all files in this directory. */
	async loadShallow() {
		let arr: Promise<Blob>[] = [];
		for await (let entry of this) {
			if (entry instanceof VirtualFile) arr.push(entry.getBlob());
		}

		return Promise.all(arr);
	}

	/** Load all files in this directory and its subdirectories. */
	async loadDeep() {
		let arr: Promise<Blob>[] = [];

		async function addFilesInDirectory(dir: VirtualDirectory) {
			for await (let entry of dir) {
				if (entry instanceof VirtualFile) arr.push(entry.getBlob());
				else addFilesInDirectory(entry as VirtualDirectory);
			}
		}
		await addFilesInDirectory(this);

		return Promise.all(arr);
	}

	/** Creates a directory structure from a FileList, which is what you get from an <input type="file"> thing. */
	static fromFileList(list: FileList) {
		let root = new VirtualDirectory("");

		/** Creates a directory at a certain path, creating all necessary directories on the path as it goes. */
		function createIteratively(dir: VirtualDirectory, pathSegments: string[], index: number): VirtualDirectory {
			let currentDir = dir;

			while (true) {
				if (index >= pathSegments.length - 1) return currentDir;

				let entry = currentDir.entries.get(pathSegments[index]) as VirtualDirectory;
				if (!entry) {
					entry = new VirtualDirectory(pathSegments[index]);
					currentDir.addEntry(entry);
				}

				currentDir = entry;
				index++;
			}
		}

		// Cache directories by their path for faster lookup
		let cache = new Map<string, VirtualDirectory>();

		for (let i = 0; i < list.length; i++) {
			let file = list[i];
			let relativePath = (file as any).webkitRelativePath as string;
			if (relativePath === undefined) throw new Error("webkitRelativePath not defined.");

			let d = relativePath.slice(0, relativePath.lastIndexOf("/"));
			let parentDir = cache.get(d) as VirtualDirectory;
			if (!parentDir) {
				let pathSegments = relativePath.split("/");
				root.name = pathSegments[0];

				parentDir = createIteratively(root, pathSegments, 1);
				cache.set(d, parentDir);
			}
			
			parentDir.addEntry(VirtualFile.fromFile(file));
		}

		return root;
	}

	/** Creates a directory from a FileSystemDirectoryHandle (Native File System API) */
	static fromDirectoryHandle(handle: FileSystemDirectoryHandle, saveHandle = true, handleId?: string) {
		let root = new VirtualDirectory(handle.name);
		root.isNativeFileSystem = true;
		if (saveHandle) {
			root.directoryHandle = handle;
			root.directoryHandleId = handleId;
		}

		return root;
	}

	async toDescription(storeData: boolean): Promise<VirtualDirectoryDescription> {
		return {
			type: 'directory',
			name: this.name,
			id: this.id,
			isNativeFileSystem: this.isNativeFileSystem && !storeData,
			directoryHandleId: this.directoryHandleId,
			entries: storeData? await this.decribeEntries() : null
		};
	}

	private async decribeEntries() {
		let descriptions: VirtualFileSystemEntryDescription[] = [];

		for await (let entry of this) {
			descriptions.push(await entry.toDescription(true));
		}

		return descriptions;
	}

	static async fromDescription(description: VirtualDirectoryDescription) {
		let directory = new VirtualDirectory(description.name);
		directory.isNativeFileSystem = description.isNativeFileSystem;
		directory.id = description.id;

		if (description.directoryHandleId) {
			directory.directoryHandleId = description.directoryHandleId;
			// Get the handle from the database
			let handle = (await globalState.database.get('directoryHandle', 'id', description.directoryHandleId))?.handle;
			if (handle) directory.directoryHandle = handle;
		}

		if (description.entries) {
			for (let entryDescription of description.entries) {
				let entry;

				if (entryDescription.type === 'directory') {
					entry = await VirtualDirectory.fromDescription(entryDescription as VirtualDirectoryDescription);
				} else {
					entry = VirtualFile.fromDescription(entryDescription as VirtualFileDescription);
				}

				directory.addEntry(entry);
			}
		}

		return directory;
	}

	/** Imports the directory's contents from IndexedDB. */
	private importFromDatabase() {
		if (!this.requiresDatabaseImport) return;
		if (this.databaseImportPromise) return this.databaseImportPromise;

		this.databaseImportPromise = new Promise(async resolve => {
			let description = await globalState.database.get('directory', 'id', this.id);

			if (description.entries) {
				for (let entryDescription of description.entries) {
					let entry;
	
					if (entryDescription.type === 'directory') {
						entry = await VirtualDirectory.fromDescription(entryDescription as VirtualDirectoryDescription);
					} else {
						entry = VirtualFile.fromDescription(entryDescription as VirtualFileDescription);
					}
	
					this.addEntry(entry);
				}
			}
	
			this.requiresDatabaseImport = false;
			resolve();
		});

		return this.databaseImportPromise;
	}
}

export interface VirtualDirectoryDescription extends VirtualFileSystemEntryDescription {
	type: 'directory',
	directoryHandleId?: string,
	entries?: VirtualFileSystemEntryDescription[]
}