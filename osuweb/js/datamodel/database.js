function Database(directoryEntry) {
    this.directoryEntry = directoryEntry;
    this.beatmapSetEntrys = [];
    this.skinEntrys = [];

    this.isMap = function(fileEntrys) {
        for(var fileEntry in fileEntrys) {
            console.log(fileEntry);
        }
    };

    this.isSkin = function(fileEntrys) {

    };

    this.processDirectoryEntries = function(entries) {
        let files = [];
        let directories = [];

        for (var i = 0; i < entries.length; i++) {
            var entry = entries[i];
            if (entry.isDirectory) {
                directories.push(entry);
            }
            else if (entry.isFile) {
                files.push(entry);
            }
        }

        if(this.isMap(files)) {
            beatmapSetEntrys.push(new BeatmapSetEntry(files));
        }
        else if(this.isSkin(files)) {
            skinEntrys.push(new SkinEntry(files));
        }
        else if(entry.isDirectory) {
            var dirReader = entry.createReader();
            dirReader.readEntries(this.processDirectoryEntries.bind(this));
        }
    };

    if(this.directoryEntry != undefined) {
        var reader = directoryEntry.createReader();
        reader.readEntries(this.processDirectoryEntries.bind(this));
    }
}