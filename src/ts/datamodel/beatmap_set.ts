export class BeatmapSet {
    public files: File[];
    public osuFiles: File[] = [];
    public audioFiles: File[] = [];
    public imgFiles: File[] = [];

    constructor(files: File[]) {
        this.files = files;

        for (let file of this.files) {
            if (file.name.endsWith('.osu')) {
                this.osuFiles.push(file);
            } else if (file.name.endsWith('.mp3') /* ADD MORE! */) {
                this.audioFiles.push(file);
            }
        }
    }
}