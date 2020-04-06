import { VirtualFileSystemEntry } from "./virtual_file_system_entry";
import { getFilenameWithoutExtension } from "../util/file_util";

export class VirtualFile extends VirtualFileSystemEntry {
	private resource: Blob | File | string;
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
		} else {
			this.blob = this.resource;
		}
	}

	async readAsText() {
		await this.load();
		return await new Response(this.blob).text();
	}

	async readAsArrayBuffer() {
		await this.load();
		return await new Response(this.blob).arrayBuffer();
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
}