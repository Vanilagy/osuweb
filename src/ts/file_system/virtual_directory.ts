import { VirtualFileSystemEntry } from "./virtual_file_system_entry";
import { VirtualFile } from "./virtual_file";
import { splitPath } from "../util/file_util";

export class VirtualDirectory extends VirtualFileSystemEntry {
	private entries: Map<string, VirtualFileSystemEntry>;
	private caseInsensitiveEntries: Map<string, VirtualFileSystemEntry>;
	public networkFallbackUrl: string;
	public failedNetworkFallbacks: Set<string>; // In order to prevent hitting the network twice for a 404 resource.

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

	async getEntryByPath(name: string, caseSensitive = false) {
		if (name === null || name === undefined) return null;

		let parts = splitPath(name);
		let currentDirectory: VirtualDirectory = this;

		for (let i = 0; i < parts.length; i++) {
			let part = parts[i];
			let entry: VirtualFileSystemEntry;

			if (part === '.') entry = currentDirectory;
			else if (part === '..') entry = currentDirectory.parent;
			else entry = caseSensitive? currentDirectory.entries.get(part) : currentDirectory.caseInsensitiveEntries.get(part.toLowerCase());
			
			if (entry) {
				if (i === parts.length-1) return entry;
				else if (entry instanceof VirtualDirectory) currentDirectory = entry;
				else break;
			} else {
				break;
			}
		}

		let entry = caseSensitive? this.entries.get(name) : this.caseInsensitiveEntries.get(name.toLowerCase());
		if (entry) return entry;

		if (this.networkFallbackUrl) {
			let url = this.networkFallbackUrl + '/' + name; // We ignore case sensitivity here
			if (this.failedNetworkFallbacks.has(url)) return null;

			let response = await fetch(url);
			if (response.ok) {
				let blob = await response.blob();
				let file = VirtualFile.fromBlob(blob, name);

				this.addEntry(file);
				return file;
			} else {
				this.failedNetworkFallbacks.add(url);
			}
		}

		return null;
	}

	async getFileByPath(name: string, caseSensitive = false) {
		let entry = await this.getEntryByPath(name, caseSensitive);

		if (entry instanceof VirtualFile) return entry as VirtualFile;
		return null;
	}

	forEach(func: (entry: VirtualFileSystemEntry) => any) {
		this.entries.forEach((entry) => {
			func(entry);
		});
	}

	forEachFile(func: (entry: VirtualFile) => any) {
		this.entries.forEach((entry) => {
			if (entry instanceof VirtualFile) func(entry);
		});
	}

	*[Symbol.iterator]() {
		for (let entry of this.entries) {
			yield entry[1];
		}
	}

	/** Load all files in this directory. */
	loadShallow() {
		let arr: Promise<void>[] = [];
		this.forEach((entry) => {
			if (entry instanceof VirtualFile) arr.push(entry.load());
		});

		return Promise.all(arr);
	}

	/** Load all files in this directory and its subdirectories. */
	loadDeep() {
		let arr: Promise<void>[] = [];

		function addFilesInDirectory(dir: VirtualDirectory) {
			dir.forEach((entry) => {
				if (entry instanceof VirtualFile) arr.push(entry.load());
				else addFilesInDirectory(entry as VirtualDirectory);
			});
		}
		addFilesInDirectory(this);

		return Promise.all(arr);
	}

	static fromFileList(list: FileList) {
		let root = new VirtualDirectory("");

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

		let cache = new Map();

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
}