function Database(directoryEntry) {
    this.directoryEntry = directoryEntry;
    this.beatmapSetEntrys = [];
    this.skinEntrys = [];

    this.isMap = function(fileEntrys) {
        let osuFileExists = false;
        let soundFileExists = false;

        for(var fileEntry in fileEntrys) {
            let entry = fileEntrys[fileEntry];

            if(entry.name.endsWith(".osu")) {
                osuFileExists = true;
            }
            else if(entry.name.endsWith(".mp3") || entry.name.endsWith(".wav") || entry.name.endsWith(".ogg")) {
                soundFileExists = true;
            }

            if(osuFileExists && soundFileExists) return true;
        }

        return false;
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
            this.beatmapSetEntrys.push(new BeatmapSetEntry(files));
        }
        else if(this.isSkin(files)) {
            this.skinEntrys.push(new SkinEntry(files));
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