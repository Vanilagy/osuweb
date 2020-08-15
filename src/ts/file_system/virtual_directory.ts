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
	/** Used to wait for the next entry to be read, see usage. */
	private iterationWaiter: Promise<void>;
	/** If this is true, the directory's contents must be fetched from IndexedDB first. */
	public requiresDatabaseImport = false;
	private databaseImportPromise: Promise<void>;

	private directoryEntry: FileSystemDirectoryEntry;
	/** Is used together with directoryEntry. */
	private readied = true;

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
			if (!currentDirectory.readied) await currentDirectory.ready();

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
		this.iterationWaiter = new Promise(resolve => resolver = resolve);
		
		// Explanation: The NativeFileSystemAPI seems buggy and directory iteration can silently terminate when there are multiple disk accesses at once, however iteration stays stuck in the middle of the iterator. Here, if we don't see a new file within 10 seconds, we retry the whole thing and give it another shot.

		const iterate = async () => {
			let timeoutId = setTimeout(() => iterate(), 10000);

			let handle = await this.getHandle();
			let entries = await handle.getEntries();

			for await (let entry of entries) {
				clearTimeout(timeoutId);
				timeoutId = setTimeout(() => iterate(), 10000);

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
				this.iterationWaiter = new Promise(resolve => resolver = resolve);
			}

			clearTimeout(timeoutId);
			resolver();
		};
		iterate();
	}

	/** Iterates through all entries in the directory entry, obtained from drag-and-drop. */
	private async iterateEntry() {
		let resolver: Function;
		this.iterationWaiter = new Promise(resolve => resolver = resolve);

		let reader = this.directoryEntry.createReader();

		const getEntries = async () => {
			// Read the next bit of entries (usually ~100)
			let entries = await new Promise(resolve => reader.readEntries(resolve)) as FileSystemEntry[];
			if (!entries.length) return; // Terminate

			for (let i = 0; i < entries.length; i++) {
				let item = entries[i];

				if (item.isFile) {
					this.addEntry(VirtualFile.fromFileEntry(item as FileSystemFileEntry));
				} else {
					this.addEntry(VirtualDirectory.fromDirectoryEntry(item as FileSystemDirectoryEntry));
				}
			}

			resolver();
			this.iterationWaiter = new Promise(resolve => resolver = resolve);

			// Keep reading more
			await getEntries();
		};
		await getEntries();

		resolver();
	}

	async *[Symbol.asyncIterator]() {
		if (this.isNativeFileSystem && !this.iterationWaiter) this.iterateHandle();
		if (this.directoryEntry && !this.iterationWaiter) this.iterateEntry();
		if (this.requiresDatabaseImport) await this.importFromDatabase();

		await this.iterationWaiter;

		let iteratedCount = 0;

		// Kind of a hacky construct going on here, because we wait inside the iterator for the iterated data structure to get larger so that iteration doesn't stop. Hey, works!
		for (let [, entry] of this.entries) {
			yield entry;

			iteratedCount++;

			// If we're at the end of the list and there still are new entries coming in the pipeline, wait for them.
			if (this.iterationWaiter && iteratedCount === this.entries.size) await this.iterationWaiter;
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

	/** If there's a way to get the entries again, this clears all entries and resets the necessary state accordingly. */
	refresh() {
		if (this.isNativeFileSystem || this.directoryEntry) {
			this.entries.clear();
			this.caseInsensitiveEntries.clear();

			this.iterationWaiter = null;
			if (this.directoryEntry) this.readied = false;
		}

		if (this.databaseImportPromise) {
			this.entries.clear();
			this.caseInsensitiveEntries.clear();

			this.requiresDatabaseImport = true;
			this.databaseImportPromise = null;
		}
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

	/** ...meaning from https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryEntry */
	static fromDirectoryEntry(entry: FileSystemDirectoryEntry) {
		let directory = new VirtualDirectory(entry.name);
		directory.directoryEntry = entry;
		directory.readied = false;

		return directory;
	}

	async ready() {
		if (this.readied) return;

		for await (let e of this) if (!e) console.log(e);
		this.readied = true;
	}

	static async fromZipFile(file: VirtualFile) {
		let arrayBuffer = await file.readAsArrayBuffer();
		let zip = await JSZip.loadAsync(arrayBuffer);
		let root = new VirtualDirectory(file.getNameWithoutExtension());

		for (let path in zip.files) {
			let zipFile = zip.files[path];
			let directoryPath = path.slice(0, Math.max(path.lastIndexOf('/'), 0));

			let directory = directoryPath? await root.getEntryByPath(directoryPath) as VirtualDirectory : root;
			if (!directory) {
				// Create the needed subdirectories
				
				let parts = directoryPath.split('/');
				directory = root;

				for (let part of parts) {
					let subDir = await directory.getEntryByPath(part) as VirtualDirectory;
					if (!subDir) {
						subDir = new VirtualDirectory(part);
						directory.addEntry(subDir);	
					}

					directory = subDir;
				}
			}

			if (zipFile.dir) continue;

			let file = VirtualFile.fromZipObject(zipFile);
			directory.addEntry(file);
		}

		return root;
	}
}

export interface VirtualDirectoryDescription extends VirtualFileSystemEntryDescription {
	type: 'directory',
	directoryHandleId?: string,
	entries?: VirtualFileSystemEntryDescription[]
}