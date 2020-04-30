import { VirtualFileSystemEntry } from "./virtual_file_system_entry";
import { getFilenameWithoutExtension } from "../util/file_util";

export class VirtualFile extends VirtualFileSystemEntry {
	private resource: Blob | File | FileSystemFileHandle | string;
	/** Every resource will eventually be converted to a blob. */
	private blob: Blob = null;
	private cachedResourceUrl: string;

	private constructor() {
		super();
	}

	async load() {
		if (this.blob) return;

		if (typeof this.resource === "string") {
			let response = await fetch(this.resource);
			this.blob = await response.blob();
		} else if (this.resource instanceof Blob) {
			this.blob = this.resource;
		} else if (this.resource instanceof FileSystemFileHandle) {
			this.blob = await this.resource.getFile();
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

	async readAsResourceUrl() {
		if (this.cachedResourceUrl !== undefined) return this.cachedResourceUrl;

		await this.load();
		return this.cachedResourceUrl = URL.createObjectURL(this.blob);
	}
	
	async getBlob() {
		await this.load();
		return this.blob;
	}

	getUrl() {
		if (typeof this.resource === "string") return this.resource;
		return URL.createObjectURL(this.resource);
	}

	getSize() {
		if (this.blob) return this.blob.size;
		else if (this.resource instanceof File) return this.resource.size;
		return null;
	}

	getLastModifiedDate() {
		if (this.resource instanceof File) return new Date(this.resource.lastModified);
		return null;
	}

	getNameWithoutExtension() {
		return getFilenameWithoutExtension(this.name);
	}

	revokeResourceUrl() {
		if (this.cachedResourceUrl === undefined) return;
		URL.revokeObjectURL(this.cachedResourceUrl);
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

	static fromFileHandle(handle: FileSystemFileHandle) {
		let newFile = new VirtualFile();

		newFile.resource = handle;
		newFile.name = handle.name;

		return newFile;
	}
}