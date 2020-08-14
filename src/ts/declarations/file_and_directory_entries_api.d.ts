declare abstract class FileSystemEntry {
	name: string;
	isFile: boolean;
	isDirectory: boolean;
}

declare class FileSystemDirectoryEntry extends FileSystemEntry {
	createReader(): FileSystemDirectoryReader;
}

declare class FileSystemDirectoryReader {
	readEntries(callback: (entries: FileSystemEntry[]) => any): void;
}

declare class FileSystemFileEntry extends FileSystemEntry {
	file(callback: (file: File) => any): void;
}