"use strict";

import {Beatmap} from "./beatmap";
import {Circle} from "./circle";
import {Slider} from "./slider";
import {Spinner} from "./spinner";
import {hex_md5} from "../util/md5";
import {FileUtil} from "../util/fileutil";


export function processDirectory(directoryEntry) {
    if (directoryEntry !== undefined) {
        let promises = processDirectoryEntries([directoryEntry]);

        return Promise.all(promises);
    }
}

function isSkinDirectory(fileEntrys) {

}

function isMapDirectory(fileEntrys) {
    let osuFileExists = false;
    let soundFileExists = false;

    for (let fileEntry in fileEntrys) {
        let entry = fileEntrys[fileEntry];

        if (entry.name.endsWith(".osu")) {
            osuFileExists = true;
        }
        else if (entry.name.endsWith(".mp3") || entry.name.endsWith(".wav") || entry.name.endsWith(".ogg")) {
            soundFileExists = true;
        }

        if (osuFileExists && soundFileExists) return true;
    }

    return false;
}

function parseAudioFile(file) {
    return new Promise((resolve, reject) => {
        file.file((f) => {
            let r = new FileReader();

            r.onload = () => {
                resolve({"Name": f.name, "Audio": f, "Type": f.type, "Hash": hex_md5(r.result)});
            };

            r.onerror = reject;

            r.readAsText(f);
        });
    });
}

function parseImageFile(file) {
    return new Promise((resolve, reject) => {
        file.file((f) => {
            let r = new FileReader();

            r.onload = () => {
                resolve({"Name": f.name, "Image": f, "Type": f.type, "Hash": hex_md5(r.result)});
            };

            r.onerror = reject;

            r.readAsText(f);
        });
    });
}

function processBeatmapDirectory(entries) {
    return new Promise((resolve, reject) => {
        parseBeatmapSet(entries, (bs) => {
            // Process audio and images to get their hash value for identification
            var audioPromises = bs.AudioFiles.map(x => parseAudioFile(x));
            var imagePromises = bs.ImageFiles.map(x => parseImageFile(x));

            Promise.all(audioPromises.concat(imagePromises)).then(values => {
                let parsedBeatmapObject = {
                    "Audios": [],
                    "Images": [],
                    "Beatmaps": [],
                    "BeatmapSet": null
                };

                values.forEach(x => {
                    if ("Audio" in x) {
                        parsedBeatmapObject.Audios.push(x);
                    }
                    else if ("Image" in x) {
                        parsedBeatmapObject.Images.push(x);
                    }
                });

                let theCHOSENmap = bs.Beatmaps[0];

                let set = {
                    Id: theCHOSENmap.SetId,
                    Metadata: theCHOSENmap.Metadata,
                    Background: values.find(x => x.Name === theCHOSENmap.Events.find(y => y.File !== undefined && y.Type === "image").File && "Image" in x).Hash,
                    BeatmapIds: Object.values(bs.Beatmaps).map(x => x.Id)
                };

                delete set.Metadata.Version;

                parsedBeatmapObject.BeatmapSet = set;

                for (var key in bs.Beatmaps) {
                    let map = bs.Beatmaps[key];

                    // Reference resources by hash rather than filename
                    map.General.AudioFilename = values.find(x => x.Name === map.General.AudioFilename && "Audio" in x).Hash;
                    map.Events = map.Events.map(event => {
                        if (event.File === undefined || event.Type !== "image") return event;
                        
                        event.File = values.find(x => x.Name === event.File && "Image" in x).Hash;

                        return event;
                    });

                    parsedBeatmapObject.Beatmaps.push(map);
                }

                resolve(parsedBeatmapObject);
            }, () => {
                console.error("Error processing beatmap directory!");
                reject();
            });
        });
    });
}

function processDirectoryEntries(entries) {
    if (entries.length === 0) return;

    // Sort files and directories
    let files = [];
    let directories = [];

    for (let i = 0; i < entries.length; i++) {
        let entry = entries[i];
        if (entry.isDirectory) {
            directories.push(entry);
        }
        else if (entry.isFile) {
            files.push(entry);
        }
    }

    if (isMapDirectory(files)) {
        return [processBeatmapDirectory(entries)];
    }
    else if (isSkinDirectory(files)) {
        // TODO return [Promise<SkinObject>]
    }
    else { //Recurse deeper into hierarchy
        return directories.map(dir => {
            let dirReader = dir.createReader();

            return new Promise((resolve, reject) => {
                dirReader.readEntries(results => {
                    Promise.all(processDirectoryEntries(results)).then(x => resolve(x.flat()));
                }, () => {
                    reject();
                });
            });
        });
    }
}

export function parseBeatmapSet(fileEntrys, callback) {
    var beatmapSetObject = {
        "Id": -1,
        "AudioFiles": [],
        "ImageFiles": [],
        "Beatmaps": []
    };

    let loadingMaps = 0;

    let beatmapFiles = [];

    for (let key in fileEntrys) {
        let fileEntry = fileEntrys[key];

        let name = fileEntry.name.toLowerCase();

        if (name.endsWith(".osu")) {
            loadingMaps++;
            beatmapFiles.push(fileEntry);
        }
        else if(name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".gif") || name.endsWith(".png")) {
            beatmapSetObject.ImageFiles.push(fileEntry);
        }
        else if(name.endsWith(".mp3") || name.endsWith(".wav") || name.endsWith(".ogg")) {
            beatmapSetObject.AudioFiles.push(fileEntry);
        }
    }

    beatmapFiles.forEach(fileEntry => {
        fileEntry.file(file => {
            FileUtil.loadFileAsString(file, (content) => {
                let beatmap = new Beatmap(content.target.result);

                if (beatmapSetObject.Id === -1) {
                    beatmapSetObject.Id = beatmap._beatmapSetID;
                }

                beatmapSetObject.Beatmaps.push(beatmap.toObject());

                if (--loadingMaps === 0) callback(beatmapSetObject);
            });
        });
    });
}

export function parseBeatmap(text) {
    Console.verbose("--- START BEATMAP IMPORT ---");

    let beatmapObject = {
        Id: -1,
        SetId: -1,
        General: {
            AudioFilename: null,
            AudioLeadIn: 0,
            PreviewTime: 0,
            Countdown: false,
            SampleSet: 0,
            Mode: 0,
            LetterboxInBreaks: false,
            WidescreenStoryboard: false,
        },
        Metadata: {
            Title: null,
            TitleUnicode: null,
            Artist: null,
            ArtistUnicode: null,
            Creator: null,
            Version: null,
            Source: null,
            Tags: null
        },
        Difficulty: {
            HP: 0,
            CS: 0,
            OD: 0,
            AR: 0,
            SL: 0,
            SV: 0,
            TR: 0,
            SR: 0
        },
        Events: [],
        TimingPoints: [],
        Colours: [],
        HitObjects: []
    };

    let ARFound = false;

    let lines = text.split('\n');

    let section = "header";

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();

        if (line === "") continue;

        if (line.startsWith("osu file format v")) {
            beatmapObject.Metadata.Version = line.substr(line.length - 2, 2);

            Console.verbose("Beatmap version: "+ beatmapObject.Metadata.version);

            if(!line.endsWith("14")) Console.warn("The beatmap version seems to be older than supported. We could run into issue here!");
        }
        else if(line.startsWith("[") && line.endsWith("]")) {
            section = line.substr(1,line.length-2).toLowerCase();

            Console.verbose("Reading new section: "+ line);
        }
        else if (section === "colours") {
            beatmapObject.Colours.push(parseComboColour(line));
        }
        else if (section === "timingpoints") {
            beatmapObject.TimingPoints.push(parseTimingPoint(line));
        }
        else if (section === "events") {
            if (line.startsWith("//")) continue;

            beatmapObject.TimingPoints.push(parseEvent(line));
        }
        else if (section === "hitobjects") {
            beatmapObject.HitObjects.push(parseHitObject(line));
        }
        else {
            // General
            if (line.startsWith("AudioFilename")) beatmapObject.General.AudioFilename = line.split(':')[1].trim();
            if (line.startsWith("AudioLeadIn")) beatmapObject.General.AudioLeadIn = parseInt(line.split(':')[1].trim(), 10);
            if (line.startsWith("PreviewTime")) beatmapObject.General.PreviewTime = parseInt(line.split(':')[1].trim(), 10);
            if (line.startsWith("Countdown")) beatmapObject.General.Countdown = parseInt(line.split(':')[1].trim(), 10);
            if (line.startsWith("SampleSet")) beatmapObject.General.SampleSet = parseInt(line.split(':')[1].trim(), 10);
            if (line.startsWith("StackLeniency")) beatmapObject.General.Difficulty.SL = parseFloat(line.split(':')[1].trim());
            if (line.startsWith("Mode")) beatmapObject.General.Mode = parseInt(line.split(':')[1].trim(), 10);
            if (line.startsWith("LetterboxInBreaks")) beatmapObject.General.LetterBoxInBreaks = parseInt(line.split(':')[1].trim(), 10);
            if (line.startsWith("WidescreenStoryboard")) beatmapObject.General.WidescreenStoryboard = parseInt(line.split(':')[1].trim(), 10);

            // Metadata
            if (line.startsWith("Title:")) beatmapObject.Metadata.Title = line.split(':')[1].trim();
            if (line.startsWith("TitleUnicode")) beatmapObject.Metadata.TitleUnicode = line.split(':')[1].trim();
            if (line.startsWith("Artist:")) beatmapObject.Metadata.Artist = line.split(':')[1].trim();
            if (line.startsWith("ArtistUnicode")) beatmapObject.Metadata.ArtistUnicode = line.split(':')[1].trim();
            if (line.startsWith("Creator")) beatmapObject.Metadata.Creator = line.split(':')[1].trim();
            if (line.startsWith("Version")) beatmapObject.Metadata.Version = line.split(':')[1].trim();
            if (line.startsWith("Source")) beatmapObject.Metadata.Source = line.split(':')[1].trim();
            if (line.startsWith("Tags")) beatmapObject.Metadata.Tags = line.split(':')[1].trim();
            if (line.startsWith("BeatmapID")) beatmapObject.ID = parseInt(line.split(':')[1].trim(), 10);
            if (line.startsWith("BeatmapSetID")) beatmapObject.SetID = parseInt(line.split(':')[1].trim(), 10);

            // Difficulty
            if (line.startsWith("HPDrainRate")) beatmapObject.Difficulty.HP = parseFloat(line.split(':')[1].trim());
            if (line.startsWith("CircleSize")) beatmapObject.Difficulty.CS = parseFloat(line.split(':')[1].trim());
            if (line.startsWith("OverallDifficulty")) beatmapObject.Difficulty.OD = parseFloat(line.split(':')[1].trim());
            if (line.startsWith("ApproachRate")) {beatmapObject.Difficulty.AR = parseFloat(line.split(':')[1].trim()); ARFound = true;}
            if (line.startsWith("SliderMultiplier")) beatmapObject.Difficulty.SV = parseFloat(line.split(':')[1].trim());
            if (line.startsWith("SliderTickRate")) beatmapObject.Difficulty.TR = parseFloat(line.split(':')[1].trim());

            Console.verbose("Read header property: "+line);
        }
    }

    if (beatmapObject.Colours.length === 0) {
        beatmapObject.Colours = [{r: 255, g: 192, b: 0}, {r: 0, g: 202, b: 0}, {r: 18, g: 124, b: 255}, {r: 242, g: 24, b: 57}];
        Console.info("No combo colours in Beatmap found. Using default ones!");
    }

    if(!ARFound) beatmapObject.Difficulty.AR = beatmapObject.Difficulty.OD;

    return beatmapObject;
}

function parseComboColour(line) {
    let col = line.split(':')[1].trim().split(',');

    let colorObject = {
        r: parseInt(col[0], 10),
        g: parseInt(col[1], 10),
        b: parseInt(col[2], 10),
    };

    Console.verbose("Added color:" + colorObject);
    return colorObject;
}

function parseTimingPoint(line) {
    let values = line.split(',');

    let timingObject = {
        index: this.timingPoints.length,
        offset: parseInt(values[0], 10),
        msPerBeat: parseFloat(values[1]),
        BPM: parseFloat(values[1]) > 0 ? 60000 / values[1] : -1,
        meter: parseInt(values[2], 10),
        sampleType: parseInt(values[3], 10),
        sampleSet: parseInt(values[4], 10),
        volume: parseInt(values[5], 10),
        inherited: parseFloat(values[1]) < 0,
        kiai: parseInt(values[7], 10),
    };

    Console.verbose("Added timing point: " + JSON.stringify(timingObject));
    return timingObject;
}

function parseEvent(line) {
    let values = line.split(',');

    let eventObject = null;

    switch (values[0]) {
        case "0":
            eventObject = {
                type: "image",
                time: parseInt(values[1], 10),
                file: values[2].substring(1, values[2].length - 1),
                x: parseInt(values[3], 10),
                y: parseInt(values[4], 10)
            };
            break;
        case "2":
            eventObject = {
                type: "break",
                start: parseInt(values[1], 10),
                end: parseInt(values[2], 10)
            };
            break;
    }

    return eventObject;
}

function parseHitObject(line) {
    let values = line.split(',');

    let hitObjectData = parseInt(values[3], 10) % 16;

    // Nice name I know
    let hitObjectObject = null;

    if (hitObjectData === 1 || hitObjectData === 5) {
        hitObjectObject = new Circle(values);
        Console.verbose("Circle added: " + JSON.stringify(hitObjectObject));
    }
    else if (hitObjectData === 2 || hitObjectData === 6) {
        hitObjectObject = new Slider(values);
        Console.verbose("Slider added: " + JSON.stringify(hitObjectObject));
    }
    else if (hitObjectData === 8 || hitObjectData === 12) {
        hitObjectObject = new Spinner(values);
        Console.verbose("Spinner added: " + JSON.stringify(hitObjectObject));
    }
    else {
        Console.verbose("Unrecognized HitObject-type! (peppy plz)");
    }

    return hitObjectObject;
}