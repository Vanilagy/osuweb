import { Slider } from "./slider";
import { Circle } from "./circle";
import { BeatmapDifficulty } from "./beatmap_difficulty";
import { BeatmapSet } from "./beatmap_set";
import { Color } from "../util/graphics_util";
import { HitObject } from "./hit_object";
import { Point } from "../util/point";
import { Spinner } from "./spinner";
import { last } from "../util/misc_util";

class BeatmapCreationOptions {
    text: string;
    beatmapSet: BeatmapSet;
    loadFlat?: boolean = false
}

export interface TimingPoint {
    index: number,
    offset: number,
    msPerBeat: number,
    BPM: number,
    meter: number,
    sampleSet: number,
    sampleIndex: number,
    volume: number,
    inheritable: boolean,
    kiai: boolean
}

export enum BeatmapEventType {
    Background,
    Video,
    Break
}

export interface BeatmapEvent {
    type: BeatmapEventType,
    time: number
}

export interface BeatmapEventBackground extends BeatmapEvent {
    type: BeatmapEventType.Background
    file: string,
    offset: Point
}

export interface BeatmapEventVideo extends BeatmapEvent {
    type: BeatmapEventType.Video
    file: string,
    offset: Point
}

export interface BeatmapEventBreak extends BeatmapEvent {
    type: BeatmapEventType.Break,
    endTime: number
}

export class Beatmap {
    public loadFlat: boolean;

    public events: BeatmapEvent[] = [];
    public timingPoints: TimingPoint[] = [];
    public hitObjects: HitObject[] = [];
    public colors: Color[] = [];

    public beatmapSet: BeatmapSet;
    public difficulty: BeatmapDifficulty;
    public circleCount: number = 0;
    public sliderCount: number = 0;
    public spinnerCount: number = 0;
    public bpmMin: number = 120;
    public bpmMax: number = 120; 
    public stars: number = 0;
    public ARFound: boolean = false;
    public version: string = '';
    public audioFilename: string = null;
    public audioLeadIn: number = null;
    public previewTime: number = null;
    public countdown: number = null;
    public sampleSet: string = null; // Some... weird legacy thing, I think. Not used anywhere :thinking:
    public mode: number = null;
    public letterBoxInBreaks: number = null;
    public widescreenStoryboard: number = null;
    public title: string = null;
    public titleUnicode: string = null;
    public artist: string = null;
    public artistUnicode: string = null;
    public creator: string = null;
    public source: string = null;
    public tags: string = null;
    public beatmapID: number = null;
    public beatmapSetID: number = null;

    constructor(options: BeatmapCreationOptions) {
        this.beatmapSet = options.beatmapSet;
        this.difficulty = new BeatmapDifficulty();
        this.loadFlat = options.loadFlat;

        console.time("Beatmap parse");
        this.parseBeatmap(options.text);
        console.timeEnd("Beatmap parse");

        console.log(this);
    }

    getAudioFile() {
        return this.beatmapSet.directory.getFileByName(this.audioFilename);
    }

    getBackgroundImageName() {
        for (let key in this.events) {
            let evt = this.events[key];

            if (evt.type === BeatmapEventType.Background) {
                return (evt as BeatmapEventBackground).file;
            }
        }

        return null;
    }

    getBackgroundImageFile() {
        let fileName = this.getBackgroundImageName();
        return this.beatmapSet.directory.getFileByName(fileName);
    }

    parseBeatmap(text: string) {
        let lines = text.split('\n');

        let section = "header";

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();

            if (line === "" || line.startsWith("//")) continue;

            if (line.startsWith("osu file format v")) {
                this.version = line.substr(line.length - 2, 2);
            } else if(line.startsWith("[") && line.endsWith("]")) {
                section = line.substr(1, line.length-2).toLowerCase();
            } else if (section === "colours") {
                this.parseComboColor(line);
            } else if (section === "timingpoints") {
                this.parseTimingPoint(line);
            } else if (section === "events") {
                if (line.startsWith("//")) continue;

                this.parseEvent(line);
            } else if (section === "hitobjects") {
                this.parseHitObject(line);
            } else {
                if (line.startsWith("AudioFilename")) this.audioFilename = line.split(':')[1].trim();
                else if (line.startsWith("AudioLeadIn")) this.audioLeadIn = parseInt(line.split(':')[1].trim());
                else if (line.startsWith("PreviewTime")) this.previewTime = parseInt(line.split(':')[1].trim());
                else if (line.startsWith("Countdown")) this.countdown = parseInt(line.split(':')[1].trim());
                else if (line.startsWith("SampleSet")) this.sampleSet = line.split(':')[1].trim();
                else if (line.startsWith("StackLeniency")) this.difficulty.SL = parseFloat(line.split(':')[1].trim());
                else if (line.startsWith("Mode")) this.mode = parseInt(line.split(':')[1].trim());
                else if (line.startsWith("LetterboxInBreaks")) this.letterBoxInBreaks = parseInt(line.split(':')[1].trim());
                else if (line.startsWith("WidescreenStoryboard")) this.widescreenStoryboard = parseInt(line.split(':')[1].trim());

                else if (line.startsWith("Title:")) this.title = line.split(':')[1].trim();
                else if (line.startsWith("TitleUnicode")) this.titleUnicode = line.split(':')[1].trim();
                else if (line.startsWith("Artist:")) this.artist = line.split(':')[1].trim();
                else if (line.startsWith("ArtistUnicode")) this.artistUnicode = line.split(':')[1].trim();
                else if (line.startsWith("Creator")) this.creator = line.split(':')[1].trim();
                else if (line.startsWith("Version")) this.version = line.split(':')[1].trim();
                else if (line.startsWith("Source")) this.source = line.split(':')[1].trim();
                else if (line.startsWith("Tags")) this.tags = line.split(':')[1].trim();
                else if (line.startsWith("BeatmapID")) this.beatmapID = parseInt(line.split(':')[1].trim());
                else if (line.startsWith("BeatmapSetID")) this.beatmapSetID = parseInt(line.split(':')[1].trim());

                else if (line.startsWith("HPDrainRate")) this.difficulty.HP = parseFloat(line.split(':')[1].trim());
                else if (line.startsWith("CircleSize")) this.difficulty.CS = parseFloat(line.split(':')[1].trim());
                else if (line.startsWith("OverallDifficulty")) this.difficulty.OD = parseFloat(line.split(':')[1].trim());
                else if (line.startsWith("ApproachRate")) {this.difficulty.AR = parseFloat(line.split(':')[1].trim()); this.ARFound = true;}
                else if (line.startsWith("SliderMultiplier")) this.difficulty.SV = parseFloat(line.split(':')[1].trim());
                else if (line.startsWith("SliderTickRate")) this.difficulty.TR = parseFloat(line.split(':')[1].trim());
            }
        }

        if (!this.ARFound) this.difficulty.AR = this.difficulty.OD;

        // These arrays are not guaranteed to be in-order in the file, so we sort 'em:
        this.events.sort((a, b) => a.time - b.time);
        this.hitObjects.sort((a, b) => a.time - b.time);
        this.timingPoints.sort((a, b) => a.offset - b.offset);
    }

    parseComboColor(line: string) {
        let col = line.split(':')[1].trim().split(',');

        this.colors.push({
            r: parseInt(col[0]),
            g: parseInt(col[1]),
            b: parseInt(col[2]),
        });
    }

    parseTimingPoint(line: string) {
        let values = line.split(',');

        let offset = parseInt(values[0]);

        // From the osu! website:
        // 
        // The offset is an integral number of milliseconds, from the start
        // of the song. It defines when the timing point starts. A timing point
        // ends when the next one starts. The first timing point starts at 0,
        // disregarding its offset.
        if (this.timingPoints.length === 0) offset = 0;

        let msPerBeat = parseFloat(values[1]);

        this.timingPoints.push({
            index: this.timingPoints.length,
            offset: offset,
            msPerBeat: msPerBeat,
            BPM: msPerBeat > 0 ? 60000 / msPerBeat : -1,
            meter: parseInt(values[2]),
            sampleSet: parseInt(values[3]),
            sampleIndex: parseInt(values[4]),
            volume: parseInt(values[5]),
            inheritable: values[6] === "1", // "Inherited (Boolean: 0 or 1) tells if the timing point can be inherited from.". Kind of a misleading name, right, ppy?
            kiai: Boolean(parseInt(values[7])),
        });
    }

    parseHitObject(line: string) {
        let values = line.split(',');

        let hitObjectData = parseInt(values[3]);

        if ((hitObjectData & 1) !== 0) { // It's a circle if the 1 bit is set
            if (!this.loadFlat) {
                this.hitObjects.push(new Circle(values));
            }
            this.circleCount++;
        } else if ((hitObjectData & 2) !== 0) { // It's a slider if the 2 bit is set
            if (!this.loadFlat) {
                this.hitObjects.push(new Slider(values));
            }
            this.sliderCount++;
        } else if ((hitObjectData & 8) !== 0) { // It's a spinner if the 8 bit is set (not 4)
            if (!this.loadFlat) {
                this.hitObjects.push(new Spinner(values));
            }
            this.spinnerCount++;
        }
    }

    parseEvent(line: string) {
        let values = line.split(',');

        switch (values[0]) {
            case "0": {
                let offsetX = parseInt(values[3]),
                    offsetY = parseInt(values[4]);

                let event: BeatmapEventBackground = {
                    type: BeatmapEventType.Background,
                    time: parseInt(values[1]),
                    file: values[2].substring(1, values[2].length - 1),
                    offset: {x: offsetX, y: offsetY}
                };

                this.events.push(event);
            }; break;
            case "1": case "Video": { // "Video may be replaced by 1." https://osu.ppy.sh/help/wiki/osu!_File_Formats/Osu_(file_format)
                let offsetX = parseInt(values[3]),
                offsetY = parseInt(values[4]);

                let event: BeatmapEventVideo = {
                    type: BeatmapEventType.Video,
                    time: parseInt(values[1]),
                    file: values[2].substring(1, values[2].length - 1),
                    offset: {x: offsetX, y: offsetY}
                };

                this.events.push(event);
            }; break;
            case "2": case "Break": { // "The 2 lets osu! know that this is a break event. It may be replaced by Break." https://osu.ppy.sh/help/wiki/osu!_File_Formats/Osu_(file_format)
                let event: BeatmapEventBreak = {
                    type: BeatmapEventType.Break,
                    time: parseInt(values[1]),
                    endTime: parseInt(values[2])
                };

                this.events.push(event);
            }; break;
        }
    }

    getNextNonInheritedTimingPoint(num: number) {
        for(let i = num + 1; i < this.timingPoints.length; i++) {
            if(!this.timingPoints[i].inheritable) return this.timingPoints[i];
        }

        return null;
    }

    getClosestTimingPointTo(time: number, fromIndex = 0) {
        time = Math.round(time);

        for (let i = fromIndex; i < this.timingPoints.length-1; i++) {
            if (this.timingPoints[i+1].offset > time) return this.timingPoints[i];
        }

        return last(this.timingPoints);
    }
}