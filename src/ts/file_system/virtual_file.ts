import { VirtualFileSystemEntry } from "./virtual_file_system_entry";
import { getFilenameWithoutExtension, getFileExtension } from "../util/file_util";
import { assert } from "../util/misc_util";

export class VirtualFile extends VirtualFileSystemEntry {
	private resource: Blob | File | FileSystemFileHandle | string = null;
	/** Every resource will eventually be converted to a blob. */
	private blob: Blob = null;
	private cachedResourceUrl: string;

	private constructor() {
		super();
	}

	/** Ensure the existence of a Blob for this file, based on the resource it is based on. */
	async load() {
		if (this.blob) return;

		if (typeof this.resource === "string") {
			let response = await fetch(this.resource);
			this.blob = await response.blob();
		} else if (this.resource instanceof Blob) {
			this.blob = this.resource;
		} else if (this.isNativeFileSystem) {
			// TODO: Does this lead to an eventual fill-up of memory, if we keep all the blobs? Have to test for large directories.
			let handle = await this.getHandle();
			this.blob = await handle.getFile();
		}
	}

	async readAsText() {
		await this.load();
		return new Response(this.blob).text();
	}

	async readAsJson() {
		await this.load();
		return new Response(this.blob).json();
	}

	async readAsArrayBuffer() {
		await this.load();
		return new Response(this.blob).arrayBuffer();
	}

	async getResourceUrl() {
		if (this.cachedResourceUrl !== undefined) return this.cachedResourceUrl;

		await this.load();
		return this.cachedResourceUrl = URL.createObjectURL(this.blob);
	}
	
	async getBlob() {
		await this.load();
		return this.blob;
	}

	async getSize() {
		await this.load();
		if (this.blob) return this.blob.size;
		return null;
	}

	getLastModifiedDate() {
		if (this.resource instanceof File) return new Date(this.resource.lastModified);
		return null;
	}

	getNameWithoutExtension() {
		return getFilenameWithoutExtension(this.name);
	}

	getExtension() {
		return getFileExtension(this.name);
	}

	revokeResourceUrl() {
		if (this.cachedResourceUrl === undefined) return;
		URL.revokeObjectURL(this.cachedResourceUrl);
	}

	/** If this file is based on the Native File System API, get the corresponding file handle object. */
	async getHandle(): Promise<FileSystemFileHandle> {
		assert(this.isNativeFileSystem);

		if (this.resource) return this.resource as FileSystemFileHandle;
		else {
			let parentHandle = await this.parent.getHandle();
			let fileHandle = await parentHandle.getFile(this.name);
			return fileHandle;
		}
	}

	static fromUrl(url: string, resourceName: string) {
		let newFile = new VirtualFile();

		newFile.resource = url;
		newFile.name = resourceName;

		return newFile;
	}

	static fromFile(file: File) {
		let newFile = new VirtualFile();

		newFile.resource = file;
		newFile.name = file.name;

		return newFile;
	}

	static fromBlob(blob: Blob, resourceName: string) {
		let newFile = new VirtualFile();

		newFile.resource = blob;
		newFile.name = resourceName;

		return newFile;
	}

	static fromFileHandle(handle: FileSystemFileHandle, saveHandle = true) {
		let newFile = new VirtualFile();

		newFile.isNativeFileSystem = true;
		if (saveHandle) newFile.resource = handle;
		newFile.name = handle.name;

		return newFile;
	}
}