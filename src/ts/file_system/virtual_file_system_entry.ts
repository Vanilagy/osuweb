import { VirtualDirectory } from "./virtual_directory";

export abstract class VirtualFileSystemEntry {
	public parent: VirtualDirectory = null;
	public name: string;
	public id: string = (typeof ULID !== "undefined")? ULID.ulid() : null; // ULID is not defined in Worker contexts
	/** Whether or not this file system entry is based on a file system handle from the Native File System API. */
	public isNativeFileSystem: boolean = false;

	setParent(newParent: VirtualDirectory) {
		if (this.parent) {
			throw new Error("Changing parents is not yet supported.");
		} else {
			this.parent = newParent;
		}
	}

	/** Returns a database-friendly description of this file system entry.
	 *  @param storeData Whether to store all data in addition to the metadata. */
	abstract async toDescription(storeData: boolean): Promise<VirtualFileSystemEntryDescription>;
}

export interface VirtualFileSystemEntryDescription {
	type: 'directory' | 'file',
	name: string,
	id: string,
	isNativeFileSystem: boolean
}