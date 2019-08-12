export class VirtualFileSystemEntry {
    public parent: VirtualFileSystemEntry = null;
    public name: string;

    constructor() {

    }

    setParent(newParent: VirtualFileSystemEntry) {
        if (this.parent) {
            throw new Error("Changing parents is not yet supported.");
        } else {
            this.parent = newParent;
        }
    }
}

export class VirtualFile extends VirtualFileSystemEntry {
    private resource: File | string;
    private blob: Blob = null;
    private cachedResourceUrl: string;

    private constructor() {
        super();
    }

    async load() {
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
}

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