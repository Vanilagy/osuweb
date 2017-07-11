"use strict";

import {ZIP} from "../main";
import {Spinner} from "./spinner";
import {Slider} from "./slider";
import {Circle} from "./circle";
import {Console} from "../console";
import {BeatmapDifficulty} from "./beatmapdifficulty";
import {DifficultyCalculator} from "../game/difficulty/difficultycalculator";

export class Beatmap {
    constructor(file, callback, loadFlat = false) {
        Console.verbose("--- START BEATMAP LOADING ---");
        this.callback = callback;

        this.difficulty = new BeatmapDifficulty();

        this.audioKey = null;

        this.loadFlat = loadFlat;
        this.events = [];
        this.timingPoints = [];
        this.hitObjects = [];
        this.colours = [];

        this.circles = 0;
        this.sliders = 0;
        this.spinners = 0;

        this.bpmMin = 120;
        this.bpmMax = 120;

        /**
         * @type {number}
         * @private
         */
        this._stars = 0;

        this._ARFound = false;

        if (typeof file === "string" && file.startsWith("osu file format v")) {
            this.parseBeatmap(file);
        }
        // Load text from file
        else if (Object.prototype.toString.call(file) === "[object File]") {
            Console.verbose("Load Beatmap from file: "+file.name);
            let reader = new FileReader();
            reader.onload = (result) => this.parseBeatmap(result.currentTarget.result);
            reader.readAsText(file);
        }
        // Read text from a zip entry
        else if (typeof file === "string") {
            Console.verbose("Load Beatmap from zip entry: "+file);
            ZIP.file(file).async("string").then(this.parseBeatmap.bind(this), (fuckme) => {
                Console.error("Fatal error while reading zip entry: "+fuckme);
            });
        }
    }

    parseBeatmap(text) {
        Console.debug("Start beatmap parsing...");
        let timingPointIndex = 0;

        let lines = text.split('\n');

        let section = "header";

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();

            if (line === "") continue;

            if (line.startsWith("osu file format v")) {
                this.version = line.substr(line.length - 2, 2);

                Console.verbose("Beatmap version: "+this.version);

                if(!line.endsWith("14")) Console.warn("The beatmap version seems to be older than supported. We could run into issue here!");
            }
            else if(line.startsWith("[") && line.endsWith("]")) {
                section = line.substr(1,line.length-2).toLowerCase();

                Console.verbose("Reading new section: "+line);
            }
            else if (section === "colours") {
                let col = line.split(':')[1].trim().split(',');

                this.colours.push({
                    r: parseInt(col[0], 10),
                    g: parseInt(col[1], 10),
                    b: parseInt(col[2], 10),
                });

                Console.verbose("Added color #"+this.colours.length+": "+col);
            }
            else if (section === "timingpoints") {
                let values = line.split(',');

                this.timingPoints.push({
                    index: timingPointIndex++,
                    offset: parseInt(values[0], 10),
                    msPerBeat: parseFloat(values[1]),
                    BPM: parseFloat(values[1]) > 0 ? 60000 / values[1] : -1,
                    meter: parseInt(values[2], 10),
                    sampleType: parseInt(values[3], 10),
                    sampleSet: parseInt(values[4], 10),
                    volume: parseInt(values[5], 10),
                    inherited: parseFloat(values[1]) < 0,
                    kiai: parseInt(values[7], 10),
                });

                Console.verbose("Added timing point #"+this.timingPoints.length+": "+JSON.stringify(this.timingPoints[this.timingPoints.length - 1]));
            }
            else if (section === "events") {
                if (line.startsWith("//")) continue;

                let values = line.split(',');

                switch (values[0]) {
                    case "0":
                        this.events.push({
                            type: "image",
                            time: parseInt(values[1], 10),
                            file: values[2].substring(1, values[2].length - 1),
                            x: parseInt(values[3], 10),
                            y: parseInt(values[4], 10)
                        });
                        break;
                    case "2":
                        this.events.push({
                            type: "break",
                            start: parseInt(values[1], 10),
                            end: parseInt(values[2], 10)
                        });
                        break;
                }

                {let evt = this.events[this.events.length - 1]; if(evt !== null && evt !== undefined) Console.verbose("Added \""+evt.type+"\" event (#"+this.events.length+"): "+evt); }
            }
            else if (section === "hitobjects") {
                let values = line.split(',');

                let hitObjectData = parseInt(values[3], 10) % 16;

                if (hitObjectData === 1 || hitObjectData === 5) {
                    if(!this.loadFlat) {
                        this.hitObjects.push(new Circle(values));
                        Console.verbose("Circle added: "+JSON.stringify(this.hitObjects[this.hitObjects.length - 1]));
                    }
                    this.circles++;
                }
                else if (hitObjectData === 2 || hitObjectData === 6) {
                    if(!this.loadFlat) {
                        this.hitObjects.push(new Slider(values));
                        Console.verbose("Slider added: "+JSON.stringify(this.hitObjects[this.hitObjects.length - 1]));
                    }
                    this.sliders++;
                }
                else if (hitObjectData === 8 || hitObjectData === 12) {
                    if(!this.loadFlat) {
                        this.hitObjects.push(new Spinner(values));
                        Console.verbose("Spinner added: "+JSON.stringify(this.hitObjects[this.hitObjects.length - 1]));
                    }
                    this.spinners++;
                }
                else {
                    Console.verbose("Unrecognized HitObject-type! (peppy plz)");
                }
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
                if (line.startsWith("BeatmapSetID")) this._beatmapSetID = parseInt(line.split(':')[1].trim(), 10);

                if (line.startsWith("HPDrainRate")) this.difficulty.HP = parseFloat(line.split(':')[1].trim());
                if (line.startsWith("CircleSize")) this.difficulty.CS = parseFloat(line.split(':')[1].trim());
                if (line.startsWith("OverallDifficulty")) this.difficulty.OD = parseFloat(line.split(':')[1].trim());
                if (line.startsWith("ApproachRate")) {this.difficulty.AR = parseFloat(line.split(':')[1].trim()); this._ARFound = true;}
                if (line.startsWith("SliderMultiplier")) this.difficulty.SV = parseFloat(line.split(':')[1].trim());
                if (line.startsWith("SliderTickRate")) this.difficulty.TR = parseFloat(line.split(':')[1].trim());

                Console.verbose("Read header property: "+line);
            }
        }

        if (this.colours.length === 0) {
            this.colours = [{r: 255, g: 192, b: 0}, {r: 0, g: 202, b: 0}, {r: 18, g: 124, b: 255}, {r: 242, g: 24, b: 57}];
            Console.info("No combo colours in Beatmap found. Using default ones!");
        }

        if(!this._ARFound) this.difficulty.AR = this.difficulty.OD;

        Console.debug("Finished Beatmap parsing! (Circles: "+this.circles+", Sliders: "+this.sliders+", Spinners: "+this.spinners+" ("+(this.circles+this.sliders+this.spinners)+" Total) - TimingPoints: "+this.timingPoints.length+")");
        Console.verbose("--- BEATMAP LOADING FINISHED ---");

        this._stars = new DifficultyCalculator(this).calculate(null);

        if(this.callback) this.callback(this);
    }

    getBackgroundImageName() {
        for(let key in this.events) {
            let evt = this.events[key];

            if(evt.type === "image") {
                return evt.file;
            }
        }

        return "";
    }

    getNextNonInheritedTimingPoint(num) {
        for(let i = num + 1; i < this.timingPoints.length; i++) {
            if(!this.timingPoints[i].inherited) return this.timingPoints[i];
        }

        return null;
    }

    get stars() {
        return this._stars;
    }
}