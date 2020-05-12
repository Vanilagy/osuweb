import { VirtualFileSystemEntry } from "./virtual_file_system_entry";
import { VirtualFile } from "./virtual_file";
import { splitPath } from "../util/file_util";

export class VirtualDirectory extends VirtualFileSystemEntry {
	private entries: Map<string, VirtualFileSystemEntry>;
	private caseInsensitiveEntries: Map<string, VirtualFileSystemEntry>;
	
	/** If this is set, and a file is requested but not found, the network will be hit relative to this url to find the file. */
	public networkFallbackUrl: string;
	/** In order to prevent hitting the network twice for a 404 resource. */
	private failedNetworkFallbacks: Set<string>;
	/** If the directory was created using the Native File System API, this will be set. */
	private directoryHandle: FileSystemDirectoryHandle;
	/** Cache the entries object in the hope that stuff won't freeze up (the API is still buggy!) */
	private directoryHandleEntries: ReturnType<FileSystemDirectoryHandle["getEntries"]> = null;
	/** Since iterating a directory handle is async, this flag will be set to true if we have successfully iterated over all entries in the directory (which then will be cached). */
	private directoryHandleEntriesIterated = false;
	private readied = false;

	constructor(name: string) {
		super();

		this.name = name;
		this.networkFallbackUrl = null;
		this.entries = new Map();
		this.caseInsensitiveEntries = new Map();
		this.failedNetworkFallbacks = new Set();
	}

	addEntry(entry: VirtualFileSystemEntry) {
		this.entries.set(entry.name, entry);
		this.caseInsensitiveEntries.set(entry.name.toLowerCase(), entry);

		entry.setParent(this);
	}

	removeEntry(entry: VirtualFileSystemEntry) {
		this.entries.delete(entry.name);
		this.caseInsensitiveEntries.delete(entry.name.toLowerCase());
	}

	/** Gets an entry in this directory by path. */
	async getEntryByPath(path: string, caseSensitive = false) {
		if (path === null || path === undefined) return null;

		let parts = splitPath(path);
		let currentDirectory: VirtualDirectory = this;

		for (let i = 0; i < parts.length; i++) {
			let part = parts[i];
			let entry: VirtualFileSystemEntry;

			await currentDirectory.ready();

			if (part === '.') entry = currentDirectory; // Stay in the current directory
			else if (part === '..') entry = currentDirectory.parent; // Go up a level!
			else entry = caseSensitive? currentDirectory.entries.get(part) : currentDirectory.caseInsensitiveEntries.get(part.toLowerCase());
			
			if (entry) {
				if (i === parts.length-1) return entry; // We found the file!
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

	/** Prepares all directory entries. */
	async ready() {
		if (this.readied) return;
		if (!this.directoryHandle) {
			this.readied = true;
			return;
		}

		// Iterating over all elements will load them
		for await (let e of this) {}

		this.readied = true;
	}

	async getAllEntries() {
		let entries: VirtualFileSystemEntry[] = [];

		for await (let entry of this) {
			entries.push(entry);
		}

		return entries;
	}

	async *[Symbol.asyncIterator]() {
		// If we have a directory handle, use that handle's async iterator
		if (this.directoryHandle && !this.directoryHandleEntriesIterated) {
			let entries = await (this.directoryHandleEntries ?? (this.directoryHandleEntries = this.directoryHandle.getEntries()));

			for await (let entry of entries) {
				let fileSystemEntry: VirtualFileSystemEntry;

				// Check if it's already been added
				let existingEntry = this.entries.get(entry.name);
				if (existingEntry) {
					yield existingEntry;
					continue;
				}

				// Create a new virtual file system entry based on the type
				if (entry instanceof FileSystemFileHandle) {
					fileSystemEntry = VirtualFile.fromFileHandle(entry);
				} else if (entry instanceof FileSystemDirectoryHandle) {
					fileSystemEntry = VirtualDirectory.fromDirectoryHandle(entry);
				}

				// Add it to the entries cache
				this.addEntry(fileSystemEntry);
				yield fileSystemEntry;
			}

			// When we reach this point, we'll have iterated through the entire directory once, meaning we have cached all entries and don't need to iterate over the directory directly again.
			this.directoryHandleEntriesIterated = true;
			return;
		}

		for (let entry of this.entries) {
			yield entry[1];
		}
	}

	/** Load all files in this directory. */
	async loadShallow() {
		let arr: Promise<void>[] = [];
		for await (let entry of this) {
			if (entry instanceof VirtualFile) arr.push(entry.load());
		}

		return Promise.all(arr);
	}

	/** Load all files in this directory and its subdirectories. */
	async loadDeep() {
		let arr: Promise<void>[] = [];

		async function addFilesInDirectory(dir: VirtualDirectory) {
			for await (let entry of dir) {
				if (entry instanceof VirtualFile) arr.push(entry.load());
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
	static fromDirectoryHandle(handle: FileSystemDirectoryHandle) {
		let root = new VirtualDirectory(handle.name);
		root.directoryHandle = handle;

		return root;
	}
}