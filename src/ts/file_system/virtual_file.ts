import { VirtualFileSystemEntry, VirtualFileSystemEntryDescription } from "./virtual_file_system_entry";
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

	async getBlob() {
		if (this.blob) return this.blob;

		if (this.isNativeFileSystem) {
			let handle = await this.getHandle();
			return await handle.getFile();
		}

		if (typeof this.resource === "string") {
			let response = await fetch(this.resource);
			return this.blob = await response.blob();
		} else if (this.resource instanceof Blob) {
			return this.blob = this.resource;
		}
	}

	async readAsText() {
		return new Response(await this.getBlob()).text();
	}

	async readAsJson() {
		return new Response(await this.getBlob()).json();
	}

	async readAsArrayBuffer() {
		return new Response(await this.getBlob()).arrayBuffer();
	}

	async getResourceUrl() {
		if (this.cachedResourceUrl !== undefined) return this.cachedResourceUrl;
		return this.cachedResourceUrl = URL.createObjectURL(await this.getBlob());
	}

	async getSize() {
		return (await this.getBlob()).size;
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

	toDescription(): VirtualFileDescription {
		return {
			type: 'file',
			name: this.name,
			isNativeFileSystem: this.isNativeFileSystem
		};
	}

	static fromDescription(description: VirtualFileDescription) {
		let file = new VirtualFile();
		file.name = description.name;
		file.isNativeFileSystem = description.isNativeFileSystem;

		return file;
	}
}

export interface VirtualFileDescription extends VirtualFileSystemEntryDescription {
	type: 'file'
}