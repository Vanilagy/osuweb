import { VirtualFileSystemEntry } from "./virtual_file_system_entry";
import { VirtualFile } from "./virtual_file";

export class VirtualDirectory extends VirtualFileSystemEntry {
    public readonly entries: { [name: string]: VirtualFileSystemEntry };

    constructor(name: string) {
        super();

        this.name = name;
        this.entries = {};
    }

    addEntry(entry: VirtualFileSystemEntry) {
        this.entries[entry.name] = entry;
        entry.setParent(this);
    }

    getEntryByName(name: string) {
        return this.entries[name] || null;
    }

    forEach(func: (entry: VirtualFileSystemEntry) => any) {
        for (let key in this.entries) {
            func(this.entries[key]);
        }
    }

    static fromFileList(list: FileList) {
        let root = new VirtualDirectory("");

        function createIteratively(dir: VirtualDirectory, pathSegments: string[], index: number): VirtualDirectory {
            let currentDir = dir;

            while (true) {
                if (index >= pathSegments.length - 1) return currentDir;

                let entry = currentDir.getEntryByName(pathSegments[index]) as VirtualDirectory;
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