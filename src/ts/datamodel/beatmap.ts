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
    sampleType: number,
    sampleSet: number,
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
    private callback: Function;
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

    constructor(options: BeatmapCreationOptions, callback: (beatmap: Beatmap) => void) {
        //Console.verbose("--- START BEATMAP LOADING ---");
        this.beatmapSet = options.beatmapSet;
        this.callback = callback;
        this.difficulty = new BeatmapDifficulty();
        this.loadFlat = options.loadFlat;

        this.parseBeatmap(options.text);
    }

    getAudioFile() {
        return this.beatmapSet.directory.getEntryByName(this.audioFilename) as VirtualFile;
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
        return this.beatmapSet.directory.getEntryByName(fileName) as VirtualFile;
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
            }
            else if(line.startsWith("[") && line.endsWith("]")) {
                section = line.substr(1,line.length-2).toLowerCase();

                //Console.verbose("Reading new section: "+line);
            }
            else if (section === "colours") {
                this.parseComboColor(line);
            }
            else if (section === "timingpoints") {
                this.parseTimingPoint(line);
            }
            else if (section === "events") {
                if (line.startsWith("//")) continue;

                this.parseEvent(line);
            }
            else if (section === "hitobjects") {
                this.parseHitObject(line);
            }
            else {
                if (line.startsWith("AudioFilename")) this.audioFilename = line.split(':')[1].trim();
                if (line.startsWith("AudioLeadIn")) this.audioLeadIn = parseInt(line.split(':')[1].trim(), 10);
                if (line.startsWith("PreviewTime")) this.previewTime = parseInt(line.split(':')[1].trim(), 10);
                if (line.startsWith("Countdown")) this.countdown = parseInt(line.split(':')[1].trim(), 10);
                if (line.startsWith("SampleSet")) this.sampleSet = parseInt(line.split(':')[1].trim(), 10);
                if (line.startsWith("StackLeniency")) this.difficulty.SL = parseFloat(line.split(':')[1].trim());
                if (line.startsWith("Mode")) this.mode = parseInt(line.split(':')[1].trim(), 10);
                if (line.startsWith("LetterboxInBreaks")) this.letterBoxInBreaks = parseInt(line.split(':')[1].trim(), 10);
                if (line.startsWith("WidescreenStoryboard")) this.widescreenStoryboard = parseInt(line.split(':')[1].trim(), 10);

                if (line.startsWith("Title:")) this.title = line.split(':')[1].trim();
                if (line.startsWith("TitleUnicode")) this.titleUnicode = line.split(':')[1].trim();
                if (line.startsWith("Artist:")) this.artist = line.split(':')[1].trim();
                if (line.startsWith("ArtistUnicode")) this.artistUnicode = line.split(':')[1].trim();
                if (line.startsWith("Creator")) this.creator = line.split(':')[1].trim();
                if (line.startsWith("Version")) this.version = line.split(':')[1].trim();
                if (line.startsWith("Source")) this.source = line.split(':')[1].trim();
                if (line.startsWith("Tags")) this.tags = line.split(':')[1].trim();
                if (line.startsWith("BeatmapID")) this.beatmapID = parseInt(line.split(':')[1].trim(), 10);
                if (line.startsWith("BeatmapSetID")) this.beatmapSetID = parseInt(line.split(':')[1].trim(), 10);

                if (line.startsWith("HPDrainRate")) this.difficulty.HP = parseFloat(line.split(':')[1].trim());
                if (line.startsWith("CircleSize")) this.difficulty.CS = parseFloat(line.split(':')[1].trim());
                if (line.startsWith("OverallDifficulty")) this.difficulty.OD = parseFloat(line.split(':')[1].trim());
                if (line.startsWith("ApproachRate")) {this.difficulty.AR = parseFloat(line.split(':')[1].trim()); this.ARFound = true;}
                if (line.startsWith("SliderMultiplier")) this.difficulty.SV = parseFloat(line.split(':')[1].trim());
                if (line.startsWith("SliderTickRate")) this.difficulty.TR = parseFloat(line.split(':')[1].trim());

                //Console.verbose("Read header property: "+line);
            }
        }

        if (this.colors.length === 0) {
            this.colors = [{r: 255, g: 192, b: 0}, {r: 0, g: 202, b: 0}, {r: 18, g: 124, b: 255}, {r: 242, g: 24, b: 57}];
            //Console.info("No combo colors in Beatmap found. Using default ones!");
        }

        if(!this.ARFound) this.difficulty.AR = this.difficulty.OD;

        //Console.debug("Finished Beatmap parsing! (Circles: "+this.circles+", Sliders: "+this.sliders+", Spinners: "+this.spinners+" ("+(this.circles+this.sliders+this.spinners)+" Total) - TimingPoints: "+this.timingPoints.length+")");
        //Console.verbose("--- BEATMAP LOADING FINISHED ---");

        //this._stars = new DifficultyCalculator(this).calculate(null);

        if(this.callback) this.callback(this);
    }

    parseComboColor(line: string) {
        let col = line.split(':')[1].trim().split(',');

        this.colors.push({
            r: parseInt(col[0], 10),
            g: parseInt(col[1], 10),
            b: parseInt(col[2], 10),
        });

        //Console.verbose("Added color #" + this.colors.length + ": " + col);
        //return col; Why this return?
    }

    parseTimingPoint(line: string) {
        let values = line.split(',');

        let offset = parseInt(values[0], 10);
        if (this.timingPoints.length === 0) offset = 0;
        // From the osu! website: The offset is an integral number of milliseconds, from the start of the song. It defines when the timing point starts. A timing point ends when the next one starts. The first timing point starts at 0, disregarding its offset.

        this.timingPoints.push({
            index: this.timingPoints.length,
            offset: parseInt(values[0], 10),
            msPerBeat: parseFloat(values[1]),
            BPM: parseFloat(values[1]) > 0 ? 60000 / Number(values[1]) : -1,
            meter: parseInt(values[2], 10),
            sampleType: parseInt(values[3], 10),
            sampleSet: parseInt(values[4], 10),
            volume: parseInt(values[5], 10),
            inherited: parseFloat(values[1]) < 0,
            kiai: Boolean(parseInt(values[7], 10)),
        });

        //Console.verbose("Added timing point #" + this.timingPoints.length + ": " + JSON.stringify(this.timingPoints[this.timingPoints.length - 1]));
    }

    parseHitObject(line: string) {
        let values = line.split(',');

        let hitObjectData = parseInt(values[3], 10) % 16;

        if (hitObjectData === 1 || hitObjectData === 5) {
            if (!this.loadFlat) {
                this.hitObjects.push(new Circle(values));
                //Console.verbose("Circle added: " + JSON.stringify(this.hitObjects[this.hitObjects.length - 1]));
            }
            this.circleCount++;
        }
        else if (hitObjectData === 2 || hitObjectData === 6) {
            if (!this.loadFlat) {
                this.hitObjects.push(new Slider(values));
                //Console.verbose("Slider added: " + JSON.stringify(this.hitObjects[this.hitObjects.length - 1]));
            }
            this.sliderCount++;
        }
        else if (hitObjectData === 8 || hitObjectData === 12) {
            if (!this.loadFlat) {
                this.hitObjects.push(new Spinner(values));
                //Console.verbose("Spinner added: " + JSON.stringify(this.hitObjects[this.hitObjects.length - 1]));
            }
            this.spinnerCount++;
        }
        else {
            //Console.verbose("Unrecognized HitObject-type! (peppy plz)");
        }
    }

    parseEvent(line: string) {
        let values = line.split(',');

        switch (values[0]) {
            case "0": {
                let x = parseInt(values[3], 10),
                    y = parseInt(values[4], 10);

                let event: BeatmapEventImage = {
                    type: "image",
                    time: parseInt(values[1], 10),
                    file: values[2].substring(1, values[2].length - 1),
                    position: {x, y}
                };

                this.events.push(event);
            }; break;
            case "2": {
                let event: BeatmapEventBreak = {
                    type: "break",
                    start: parseInt(values[1], 10),
                    end: parseInt(values[2], 10)
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

    calculateDifficultyMultiplier() {
        // Based on: https://osu.ppy.sh/help/wiki/Score/

        /*

        Note that game modifiers (like Hard Rock/Easy) will not change the Difficulty multiplier.
It will only account for original values only.
Note that game modifiers (like Hard Rock/Easy) will not change the Difficulty multiplier.
It will only account for original values only.
Note that game modifiers (like Hard Rock/Easy) will not change the Difficulty multiplier.
It will only account for original values only.
Note that game modifiers (like Hard Rock/Easy) will not change the Difficulty multiplier.
It will only account for original values only.
Note that game modifiers (like Hard Rock/Easy) will not change the Difficulty multiplier.
It will only account for original values only.
Note that game modifiers (like Hard Rock/Easy) will not change the Difficulty multiplier.
It will only account for original values only.

Note that game modifiers (like Hard Rock/Easy) will not change the Difficulty multiplier.
It will only account for original values only.
Note that game modifiers (like Hard Rock/Easy) will not change the Difficulty multiplier.
It will only account for original values only.
Note that game modifiers (like Hard Rock/Easy) will not change the Difficulty multiplier.
It will only account for original values only.

Note that game modifiers (like Hard Rock/Easy) will not change the Difficulty multiplier.
It will only account for original values only.
v
TODO
*/
        let difficultyPoints = this.difficulty.CS + this.difficulty.HP + this.difficulty.OD;

        if (difficultyPoints <= 5) {
            return 2;
        } else if (difficultyPoints <= 12) {
            return 3;
        } else if (difficultyPoints <= 17) {
            return 4;
        } else if (difficultyPoints <= 24) {
            return 5;
        } else {
            return 6;
        }
    }
}