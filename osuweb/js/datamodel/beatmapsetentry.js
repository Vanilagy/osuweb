function BeatmapSetEntry(fileEntrys) {
    this.beatmapEntrys = [];
    this.loadingMaps = 0;

    for(var fileEntry in fileEntrys) {
        if(fileEntrys[fileEntry].name.endsWith(".osu")) {
            this.loadingMaps++;
            FileUtil.loadFileAsString(fileEntrys[fileEntry].file(), function(content) {
                this.beatmapEntrys.push(new BeatmapEntry(content));
                this.loadingMaps--;
            });
        }
    }
}