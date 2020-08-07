// This is not the full API, but it suffices for now.

declare interface ChooseFileSystemEntiresParams {
	type?: 'open-directory' | 'save-file',
	accepts?: {
		description: string,
		extensions: string[],
		mimeTypes: string[]
	}[];
}

declare function chooseFileSystemEntries(options: {type: 'open-directory'}): Promise<FileSystemDirectoryHandle>;
declare function chooseFileSystemEntries(options?: ChooseFileSystemEntiresParams): Promise<FileSystemHandle>;

declare class FileSystemHandle {
	public isDirectory: boolean;
	public isFile: boolean;
	public name: string;
	public queryPermission(opts?: any): Promise<string>;
	public requestPermission(opts?: any): Promise<boolean>;
}

declare class FileSystemDirectoryHandle extends FileSystemHandle {
	public isDirectory: true;
	public isFile: false;
	public getEntries(): Promise<{[Symbol.asyncIterator](): AsyncIterator<FileSystemHandle>}>;
	public getFile(name: string, options?: {create: boolean}): Promise<FileSystemFileHandle>;
	public getDirectory(name: string, options?: {create: boolean}): Promise<FileSystemDirectoryHandle>;
}

declare class FileSystemFileHandle extends FileSystemHandle {
	public isDirectory: false;
	public isFile: true;
	public getFile(): Promise<File>;
}