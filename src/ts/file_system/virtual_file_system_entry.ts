import { VirtualDirectory } from "./virtual_directory";

export abstract class VirtualFileSystemEntry {
	public parent: VirtualDirectory = null;
	public name: string;
	/** Whether or not this file system entry is based on a file system handle from the Native File System API. */
	protected isNativeFileSystem: boolean = false;

	setParent(newParent: VirtualDirectory) {
		if (this.parent) {
			throw new Error("Changing parents is not yet supported.");
		} else {
			this.parent = newParent;
		}
	}
}