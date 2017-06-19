function Database(directoryEntry) {
    this.directoryEntry = directoryEntry;
    this.beatmapSetEntrys = {};
    this.finishedBeatmapSetEntrys = 0;
    this.processesRunning = 0;
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

    this.directoryCallback = function(reader, entries, dirName, results) {
        if(!results.length) {
            this.processDirectoryEntries(entries, dirName);
        }
        else {
            entries = entries.concat(results);
            reader.readEntries(this.directoryCallback.bind(this, reader, entries, dirName));
        }
    };

    this.processDirectoryEntries = function(entries, dirName) {
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
            var beatmapSetEntry = new BeatmapSetEntry(files, (function() {
                this.finishedBeatmapSetEntrys++;
                console.log(this.finishedBeatmapSetEntrys + " (time passed: "+(window.performance.now()-this.startTime)+")");
                this.processesRunning--;
            }).bind(this))

            if(beatmapSetEntry[dirName] == undefined) this.beatmapSetEntrys[dirName] = beatmapSetEntry;
        }
        else if(this.isSkin(files)) {
            this.skinEntrys.push(new SkinEntry(files));
            this.processesRunning--;
        }
        else {
            for(var i = 0; i < directories.length; i++) {
                var dirReader = directories[i].createReader();
                dirReader.readEntries(this.directoryCallback.bind(this, dirReader, [], directories[i].name));
            }
            this.processesRunning--;
        }
    };

    if(this.directoryEntry != undefined) {
        this.startTime = window.performance.now();

        var reader = directoryEntry.createReader();
        reader.readEntries(this.directoryCallback.bind(this, reader, [], directoryEntry.name));

        console.log(this.beatmapSetEntrys);
    }
}