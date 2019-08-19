import { Slider } from "./slider";
import { Circle } from "./circle";
import { BeatmapDifficulty } from "./beatmap_difficulty";
import { BeatmapSet } from "./beatmap_set";
import { Color } from "../util/graphics_util";
import { HitObject } from "./hit_object";
import { Point } from "../util/point";
import { Spinner } from "./spinner";
import { VirtualFile } from "../file_system/virtual_file";

class BeatmapCreationOptions {
    text: string;
    beatmapSet: BeatmapSet;
    loadFlat?: boolean = false
}

interface TimingPoint {
    index: number,
    offset: number,
    msPerBeat: number,
    BPM: number,
    meter: number,
    sampleSet: number,
    sampleIndex: number,
    volume: number,
    inherited: boolean,
    kiai: boolean
}

interface BeatmapEvent {
    type: string
}

interface BeatmapEventImage extends BeatmapEvent {
    time: number,
    file: string,
    position: Point
}

export interface BeatmapEventBreak extends BeatmapEvent {
    start: number,
    end: number
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
    public sampleSet: number = null;
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
        //Console.verbose("--- START BEATMAP LOADING ---");
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

            if (evt.type === "image") {
                return (evt as BeatmapEventImage).file;
            }
        }

        return null;
    }

    getBackgroundImageFile() {
        let fileName = this.getBackgroundImageName();
        return this.beatmapSet.directory.getFileByName(fileName);
    }

    parseBeatmap(text: string) {
        //Console.debug("Start beatmap parsing...");

        let lines = text.split('\n');

        let section = "header";

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();

            if (line === "") continue;

            if (line.startsWith("osu file format v")) {
                this.version = line.substr(line.length - 2, 2);

                //Console.verbose("Beatmap version: "+this.version);

                //if(!line.endsWith("14")) Console.warn("The beatmap version seems to be older than supported. We could run into issue here!");
            } else if(line.startsWith("[") && line.endsWith("]")) {
                section = line.substr(1,line.length-2).toLowerCase();

                //Console.verbose("Reading new section: "+line);
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
                else if (line.startsWith("SampleSet")) this.sampleSet = parseInt(line.split(':')[1].trim());
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

                //Console.verbose("Read header property: "+line);
            }
        }

        if (!this.ARFound) this.difficulty.AR = this.difficulty.OD;

        //Console.debug("Finished Beatmap parsing! (Circles: "+this.circles+", Sliders: "+this.sliders+", Spinners: "+this.spinners+" ("+(this.circles+this.sliders+this.spinners)+" Total) - TimingPoints: "+this.timingPoints.length+")");
        //Console.verbose("--- BEATMAP LOADING FINISHED ---");

        //this._stars = new DifficultyCalculator(this).calculate(null);
    }

    parseComboColor(line: string) {
        let col = line.split(':')[1].trim().split(',');

        this.colors.push({
            r: parseInt(col[0]),
            g: parseInt(col[1]),
            b: parseInt(col[2]),
        });

        //Console.verbose("Added color #" + this.colors.length + ": " + col);
        //return col; Why this return?
    }

    parseTimingPoint(line: string) {
        let values = line.split(',');

        let offset = parseInt(values[0]);
        if (this.timingPoints.length === 0) offset = 0;
        // From the osu! website: The offset is an integral number of milliseconds, from the start of the song. It defines when the timing point starts. A timing point ends when the next one starts. The first timing point starts at 0, disregarding its offset.

        let msPerBeat = parseFloat(values[1]);

        this.timingPoints.push({
            index: this.timingPoints.length,
            offset: offset,
            msPerBeat: msPerBeat,
            BPM: msPerBeat > 0 ? 60000 / Number(values[1]) : -1,
            meter: parseInt(values[2]),
            sampleSet: parseInt(values[3]),
            sampleIndex: parseInt(values[4]),
            volume: parseInt(values[5]),
            inherited: msPerBeat < 0,
            kiai: Boolean(parseInt(values[7])),
        });

        //Console.verbose("Added timing point #" + this.timingPoints.length + ": " + JSON.stringify(this.timingPoints[this.timingPoints.length - 1]));
    }

    parseHitObject(line: string) {
        let values = line.split(',');

        let hitObjectData = parseInt(values[3]) % 16;

        if (hitObjectData === 1 || hitObjectData === 5) {
            if (!this.loadFlat) {
                this.hitObjects.push(new Circle(values));
                //Console.verbose("Circle added: " + JSON.stringify(this.hitObjects[this.hitObjects.length - 1]));
            }
            this.circleCount++;
        } else if (hitObjectData === 2 || hitObjectData === 6) {
            if (!this.loadFlat) {
                this.hitObjects.push(new Slider(values));
                //Console.verbose("Slider added: " + JSON.stringify(this.hitObjects[this.hitObjects.length - 1]));
            }
            this.sliderCount++;
        } else if (hitObjectData === 8 || hitObjectData === 12) {
            if (!this.loadFlat) {
                this.hitObjects.push(new Spinner(values));
                //Console.verbose("Spinner added: " + JSON.stringify(this.hitObjects[this.hitObjects.length - 1]));
            }
            this.spinnerCount++;
        } else {
            //Console.verbose("Unrecognized HitObject-type! (peppy plz)");
        }
    }

    parseEvent(line: string) {
        let values = line.split(',');

        switch (values[0]) {
            case "0": {
                let x = parseInt(values[3]),
                    y = parseInt(values[4]);

                let event: BeatmapEventImage = {
                    type: "image",
                    time: parseInt(values[1]),
                    file: values[2].substring(1, values[2].length - 1),
                    position: {x, y}
                };

                this.events.push(event);
            }; break;
            case "2": {
                let event: BeatmapEventBreak = {
                    type: "break",
                    start: parseInt(values[1]),
                    end: parseInt(values[2])
                };

                this.events.push(event);
            }; break;
        }

        //{let evt = this.events[this.events.length - 1]; if(evt !== null && evt !== undefined) Console.verbose("Added \""+evt.type+"\" event (#"+this.events.length+"): "+evt); }
    }

    getNextNonInheritedTimingPoint(num: number) {
        for(let i = num + 1; i < this.timingPoints.length; i++) {
            if(!this.timingPoints[i].inherited) return this.timingPoints[i];
        }

        return null;
    }
}