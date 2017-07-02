"use strict";

export class BeatmapEntry {
    constructor(text) {
        let lines = text.split("\n");

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();

            if (line.startsWith("[HitObjects]")) break;

            if (line.startsWith("AudioFilename")) this.audioFile = line.split(':')[1].trim();
            if (line.startsWith("PreviewTime")) this.previewTime = parseInt(line.split(':')[1].trim(), 10);
            if (line.startsWith("Mode")) this.mode = parseInt(line.split(':')[1].trim(), 10);

            if (line.startsWith("Title")) this.title = line.split(':')[1].trim();
            if (line.startsWith("TitleUnicode")) this.titleUnicode = line.split(':')[1].trim();
            if (line.startsWith("Artist")) this.artist = line.split(':')[1].trim();
            if (line.startsWith("ArtistUnicode")) this.artistUnicode = line.split(':')[1].trim();
            if (line.startsWith("Creator")) this.creator = line.split(':')[1].trim();
            if (line.startsWith("Version")) this.version = line.split(':')[1].trim();
            if (line.startsWith("Source")) this.source = line.split(':')[1].trim();
            if (line.startsWith("Tags")) this.tags = line.split(':')[1].trim();
            if (line.startsWith("BeatmapID")) this.beatmapID = parseInt(line.split(':')[1].trim(), 10);
            if (line.startsWith("BeatmapSetID")) this.beatmapSetID = parseInt(line.split(':')[1].trim(), 10);
        }
    }
}