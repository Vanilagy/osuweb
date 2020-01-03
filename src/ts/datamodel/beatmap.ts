import { Slider } from "./slider";
import { Circle } from "./circle";
import { BeatmapDifficulty } from "./beatmap_difficulty";
import { BeatmapSet } from "./beatmap_set";
import { Color } from "../util/graphics_util";
import { HitObject } from "./hit_object";
import { Point } from "../util/point";
import { Spinner } from "./spinner";
import { last, unholeArray } from "../util/misc_util";

const DEFAULT_TIMING_POINT_METER = 4;
const DEFAULT_TIMING_POINT_SAMPLE_SET = 1;
const DEFAULT_TIMING_POINT_SAMPLE_INDEX = 1;
const DEFAULT_TIMING_POINT_VOLUME = 100;

interface BeatmapCreationOptions {
    text: string;
    beatmapSet: BeatmapSet;
    metadataOnly: boolean;
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

interface BeatmapColorInfo {
    comboColors: Color[],
    sliderBody?: Color, // Listed in the .osu file docs, but no clue what it does / what it's used for.
    sliderTrackOverride?: Color,
    sliderBorder?: Color
}

/** The metadata that can only be obtained by reading the entire beatmap. */
export interface NonTrivialBeatmapMetadata {
	hitObjectCount: number,
	circleCount: number,
	sliderCount: number,
	spinnerCount: number,
	bpmMin: number,
	bpmMax: number,
	version: string // This one's trivial, but handy to send anyway
}

export class Beatmap {
	public metadataOnly: boolean;
    public events: BeatmapEvent[] = [];
    public timingPoints: TimingPoint[] = [];
    public hitObjects: HitObject[] = [];
    public colors: BeatmapColorInfo = {comboColors: [], sliderBody: null, sliderTrackOverride: null, sliderBorder: null};

    public beatmapSet: BeatmapSet;
    public difficulty: BeatmapDifficulty;
    public circleCount: number = 0;
    public sliderCount: number = 0;
    public spinnerCount: number = 0;
    public bpmMin: number = 120;
    public bpmMax: number = 120; 
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
        this.metadataOnly = options.metadataOnly;

        //console.time("Beatmap parse");
        this.parseBeatmap(options.text);
        //console.timeEnd("Beatmap parse");

        //console.log(this);
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

    getBackgroundVideoName() {
        for (let key in this.events) {
            let evt = this.events[key];

            if (evt.type === BeatmapEventType.Video) {
                return (evt as BeatmapEventVideo).file;
            }
        }

        return null;
    }

    getBackgroundImageFile() {
        let fileName = this.getBackgroundImageName();
        return this.beatmapSet.directory.getFileByName(fileName);
    }

    getBackgroundVideoFile() {
        let fileName = this.getBackgroundVideoName();
        return this.beatmapSet.directory.getFileByName(fileName);
	}
	
	getNonTrivialMetadata(): NonTrivialBeatmapMetadata {
		return {
			version: this.version,
			hitObjectCount: this.hitObjects.length,
			circleCount: this.circleCount,
			sliderCount: this.sliderCount,
			spinnerCount: this.spinnerCount,
			bpmMin: this.bpmMin,
			bpmMax: this.bpmMax
		};
	}

    private parseBeatmap(text: string) {
        let lines = text.split('\n');
        let section = "header";

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();

            if (line === "" || line.startsWith("//")) continue;

            if (line.startsWith("osu file format v")) {
                this.version = line.substr(line.length - 2, 2);
            } else if (line.startsWith("[") && line.endsWith("]")) {
                section = line.substr(1, line.length-2).toLowerCase();
            } else if (section === "colours") {
                // I find the British (Australian) to American English conversion that happens here kinda funny, haha
                if (!this.metadataOnly) this.parseColor(line);
            } else if (section === "timingpoints") {
                if (!this.metadataOnly) this.parseTimingPoint(line);
            } else if (section === "events") {
                if (line.startsWith("//")) continue;

                this.parseEvent(line);
            } else if (section === "hitobjects") {
                if (!this.metadataOnly) this.parseHitObject(line);
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

        // Sicne the beatmap colors could be given in arbitrary order, including skipping over a color, like Combo1 -> Combo3, we have to remove all holes in the array
        unholeArray(this.colors.comboColors);

        // These arrays are not guaranteed to be in-order in the file, so we sort 'em:
        this.events.sort((a, b) => a.time - b.time);
        this.hitObjects.sort((a, b) => a.time - b.time);
        this.timingPoints.sort((a, b) => a.offset - b.offset);
    }

    private parseColor(line: string) {
        let parts = line.split(':');
        let property = parts[0];
        let colStrings = parts[1].trim().split(',');
        let color: Color = {
            r: parseInt(colStrings[0]),
            g: parseInt(colStrings[1]),
            b: parseInt(colStrings[2])
        }
        
        if (property.startsWith("Combo")) {
            let n = parseInt(property.slice(5));
            this.colors.comboColors[n-1] = color; // n-1 because the first one is 'Combo1'
        } else if (property.startsWith("SliderBody")) {
            this.colors.sliderBody = color;
        } else if (property.startsWith("SliderTrackOverride")) {
            this.colors.sliderTrackOverride = color;
        } else if (property.startsWith("SliderBorder")) {
            this.colors.sliderBorder = color;
        }
	}

    private parseTimingPoint(line: string) {
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
            meter: values[2]? parseInt(values[2]) : DEFAULT_TIMING_POINT_METER,
            sampleSet: values[3]? parseInt(values[3]) : DEFAULT_TIMING_POINT_SAMPLE_SET,
            sampleIndex: values[4]? parseInt(values[4]) : DEFAULT_TIMING_POINT_SAMPLE_INDEX,
            volume: values[5]? parseInt(values[5]) : DEFAULT_TIMING_POINT_VOLUME,
            inheritable: values[6]? values[6] === "1" : true, // "Inherited (Boolean: 0 or 1) tells if the timing point can be inherited from.". Kind of a misleading name, right, ppy?
            kiai: values[7]? Boolean(parseInt(values[7])) : false,
        });
    }

    private parseHitObject(line: string) {
        let values = line.split(',');

        let hitObjectData = parseInt(values[3]);

		if ((hitObjectData & 1) !== 0) { // It's a circle if the 1 bit is set
			this.hitObjects.push(new Circle(values));
            this.circleCount++;
		} else if ((hitObjectData & 2) !== 0) { // It's a slider if the 2 bit is set
			this.hitObjects.push(new Slider(values));
            this.sliderCount++;
		} else if ((hitObjectData & 8) !== 0) { // It's a spinner if the 8 bit is set (not 4)
			this.hitObjects.push(new Spinner(values));
            this.spinnerCount++;
        }
    }

    private parseEvent(line: string) {
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

    getClosestTimingPointTo(time: number, fromIndex = 0) {
        time = Math.round(time);

        for (let i = fromIndex; i < this.timingPoints.length-1; i++) {
            if (this.timingPoints[i+1].offset > time) return this.timingPoints[i];
        }

        return last(this.timingPoints);
    }
}