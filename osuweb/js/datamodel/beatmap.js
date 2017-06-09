function Beatmap(file, callback) {
    var read = function(e){
        this.events = [];
        this.timingPoints = [];
        this.hitObjects = [];
        this.colours = [];

        var timingPointIndex = 0;

        var lines = (typeof e == "string" ? e : e.target.result).split('\n');

        var section = "header";
        var eventType = "";

        for(var i = 0; i < lines.length; i++){
            var line = lines[i].trim();

            if(line == "") continue;

            if(line.startsWith("osu file format v") && !line.endsWith("14")) console.log("The beatmap version seems to be older than supported. We could run into issue here!");

            if(line == "[General]") {
                section = "general";
                continue;
            }
            if(line == "[Metadata]") {
                section = "metadata";
                continue;
            }
            if(line == "[Difficulty]")  {
                section = "difficulty";
                continue;
            }
            if(line == "[Events]")  {
                section = "events";
                continue;
            }
            if(line == "[TimingPoints]")  {
                section = "timing";
                continue;
            }
            if(line == "[HitObjects]")  {
                section = "hitObjects";
                continue;
            }
            if(line == "[Colours]")  {
                section = "colours";
                continue;
            }

            if(section != "timing" && section != "hitObjects") {
                if(line.startsWith("AudioFilename")) this.audioFile=line.split(':')[1].trim();
                if(line.startsWith("AudioLeadIn")) this.audioLeadIn=parseInt(line.split(':')[1].trim(), 10);
                if(line.startsWith("PreviewTime")) this.previewTime=parseInt(line.split(':')[1].trim(), 10);
                if(line.startsWith("Countdown")) this.countdown=parseInt(line.split(':')[1].trim(), 10);
                if(line.startsWith("SampleSet")) this.sampleSet=parseInt(line.split(':')[1].trim(), 10);
                if(line.startsWith("StackLeniency")) this.stackLeniency=parseFloat(line.split(':')[1].trim());
                if(line.startsWith("Mode")) this.mode=parseInt(line.split(':')[1].trim(), 10);
                if(line.startsWith("LetterboxInBreaks")) this.letterBoxInBreaks=parseInt(line.split(':')[1].trim(), 10);
                if(line.startsWith("WidescreenStoryboard")) this.widescreenStoryboard=parseInt(line.split(':')[1].trim(), 10);

                if(line.startsWith("Title")) this.title=line.split(':')[1].trim();
                if(line.startsWith("TitleUnicode")) this.titleUnicode=line.split(':')[1].trim();
                if(line.startsWith("Artist")) this.artist=line.split(':')[1].trim();
                if(line.startsWith("ArtistUnicode")) this.artistUnicode=line.split(':')[1].trim();
                if(line.startsWith("Creator")) this.creator=line.split(':')[1].trim();
                if(line.startsWith("Version")) this.version=line.split(':')[1].trim();
                if(line.startsWith("Source")) this.source=line.split(':')[1].trim();
                if(line.startsWith("Tags")) this.tags=line.split(':')[1].trim();
                if(line.startsWith("BeatmapID")) this.beatmapID=parseInt(line.split(':')[1].trim(), 10);
                if(line.startsWith("BeatmapSetID")) this.beatmapSetID=parseInt(line.split(':')[1].trim(), 10);

                if(line.startsWith("HPDrainRate")) this.HP=line.split(':')[1].trim();
                if(line.startsWith("CircleSize")) this.CS=line.split(':')[1].trim();
                if(line.startsWith("OverallDifficulty")) this.OD=line.split(':')[1].trim();
                if(line.startsWith("ApproachRate")) this.AR=line.split(':')[1].trim();
                if(line.startsWith("SliderMultiplier")) this.SV=line.split(':')[1].trim();
                if(line.startsWith("SliderTickRate")) this.sliderTickRate=line.split(':')[1].trim();
            }
            if(section == "colours") {
                var col = line.split(':')[1].trim().split(',');

                this.colours.push({
                    r: parseInt(col[0], 10),
                    g: parseInt(col[1], 10),
                    b: parseInt(col[2], 10),
                });
            }
            if(section == "timing") {
                var values = line.split(',');

                this.timingPoints.push({
                    index: timingPointIndex++,
                    offset: parseInt(values[0], 10),
                    msPerBeat: parseFloat(values[1]),
                    BPM: parseFloat(values[1]) > 0 ? 60000/values[1] : -1,
                    meter: parseInt(values[2], 10),
                    sampleType: parseInt(values[3], 10),
                    sampleSet: parseInt(values[4], 10),
                    volume: parseInt(values[5], 10),
                    inherited: parseFloat(values[1]) < 0,
                    kiai: parseInt(values[7], 10),
                });
            }
            if(section == "events") {
                if(line.startsWith("//")) continue;

                var values = line.split(',');

                switch(values[0]) {
                    case "0":
                        this.events.push({
                            type: "image",
                            time: parseInt(values[1], 10),
                            file: values[2].substring(1,values[2].length - 1),
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
            }

            if(section == "hitObjects") {
                var values = line.split(',');

                var hitObjectData = parseInt(values[3], 10);

                var comboSkip = 0;

                while(hitObjectData > 12) {
                    hitObjectData -= 16;
                    comboSkip++;
                }

                // circle
                if(hitObjectData == 1 || hitObjectData == 5) {
                    var circle = {
                        type: "circle",
                        newCombo: hitObjectData == 5 ? (comboSkip > 0 ? comboSkip : -1) : null,
                        x: parseInt(values[0], 10),
                        y: parseInt(values[1], 10),
                        time: parseInt(values[2], 10),
                        hitSound: parseInt(values[4], 10),
                    };

                    // samplings
                    if(values[5] != undefined) {
                        var SamplingValues = values[5].split(':');
                    }
                    else {
                        var SamplingValues = [0, 0];
                    }

                    circle["samplings"] = {sampleSet: parseInt(SamplingValues[0], 10), sampleSetAddition: parseInt(SamplingValues[1], 10)};

                    this.hitObjects.push(circle);
                }
                // slider
                else if(hitObjectData == 2 || hitObjectData == 6) {
                    var sliderPoints = values[5].split("|");

                    var sliderType = sliderPoints[0];

                    var sliderSections = [];

                    var sliderSectionPoints = [{x: parseInt(values[0], 10), y: parseInt(values[1], 10)}];

                    var lastPoint = null;

                    for(var j = 1; j < sliderPoints.length; j++) {
                        var coords = sliderPoints[j].split(':');

                        var nextPoint = {x: parseInt(coords[0], 10), y: parseInt(coords[1], 10)};

                        // end section if same point appears twice and start a new one if end is not reached
                        if(JSON.stringify(lastPoint) === JSON.stringify(nextPoint)) {
                            if(sliderPoints.length == 3 && sliderSectionPoints.length == 3 && sliderType == "P") {
                                var sectionType = "circle";
                            }
                            else if(sliderSectionPoints.length == 2) {
                                var sectionType = "linear";
                            }
                            else {
                                var sectionType = "bezier";
                            }

                            if(sliderSectionPoints.length > 1) sliderSections.push({type: sectionType, values: sliderSectionPoints});

                            sliderSectionPoints = [];
                            sliderSectionPoints.push(nextPoint);
                        }
                        else {
                            sliderSectionPoints.push(nextPoint);
                        }

                        if(j + 1 == sliderPoints.length) {
                            if(sliderPoints.length == 3 && sliderSectionPoints.length == 3 && sliderType == "P") {
                                var sectionType = "circle";
                            }
                            else if(sliderSectionPoints.length == 2) {
                                var sectionType = "linear";
                            }
                            else {
                                var sectionType = "bezier";
                            }

                            if(sliderSectionPoints.length > 1) sliderSections.push({type: sectionType, values: sliderSectionPoints});
                        }

                        lastPoint = nextPoint;
                    }

                    var slider = {
                        type: "slider",
                        newCombo: hitObjectData == 6 ? (comboSkip > 0 ? comboSkip : -1) : null,
                        x: parseInt(values[0], 10),
                        y: parseInt(values[1], 10),
                        time: parseInt(values[2], 10),
                        hitSound: parseInt(values[4], 10),
                        sections: sliderSections,
                        repeat: parseInt(values[6], 10),
                        length: parseFloat(values[7])
                    };

                    slider.startPoint = [slider.x, slider.y];

                    if(values.length > 8) {
                        // edgeAdditions
                        var additionsValuesRaw = values[8].split('|');

                        var additions = [];

                        for(var j = 0; j < additionsValuesRaw; j++) {
                            additions.push(parseInt(additionsValuesRaw[j], 10));
                        }

                        slider["additions"] = additions;

                        // edge samplings
                        var edgeSamplings = [];

                        if(values[9] != undefined) {
                            var splitEdgeSampleSetsRaw = values[9].split('|');
                        }
                        else {
                            var splitEdgeSampleSetsRaw = [];

                            for(var j = 0; j < sliderSections.length; j++) splitEdgeSampleSetsRaw.push("0:0");
                        }

                        for(var j = 0; j < splitEdgeSampleSetsRaw.length; j++) {
                            var val = splitEdgeSampleSetsRaw[j].split(':');

                            edgeSamplings.push({sampleSet: parseInt(val[0], 10), sampleSetAddition: parseInt(val[1], 10)});
                        }

                        slider["edgeSamplings"] = edgeSamplings;

                        // body samplings
                        if(values[10] != undefined) {
                            var sliderBodySamplingValues = values[10].split(':');
                        }
                        else {
                            var sliderBodySamplingValues = [0, 0];
                        }

                        slider["bodySamplings"] = {sampleSet: parseInt(sliderBodySamplingValues[0], 10), sampleSetAddition: parseInt(sliderBodySamplingValues[1], 10)};
                    }

                    this.hitObjects.push(slider);
                }
                // spinner
                else if(hitObjectData == 8 || hitObjectData == 12) {
                    var spinner = {
                        type: "spinner",
                        newCombo: hitObjectData == 12 ? (comboSkip > 0 ? comboSkip : -1) : null,
                        x: parseInt(values[0], 10),
                        y: parseInt(values[1], 10),
                        time: parseInt(values[2], 10),
                        hitSound: parseInt(values[4], 10),
                        endTime: parseInt(values[5], 10),
                    };

                    // samplings
                    if(values[6] != undefined) {
                        var SamplingValues = values[6].split(':');
                    }
                    else {
                        var SamplingValues = [0, 0];
                    }

                    spinner["samplings"] = {sampleSet: parseInt(SamplingValues[0], 10), sampleSetAddition: parseInt(SamplingValues[1], 10)};

                    this.hitObjects.push(spinner);
                }
                else {
                    console.log("peppy plz: "+values[3]);
                }
            }
        }

        if(this.colours.length == 0) {
            this.colours = [{r:255,g:0,b:0},{r:0,g:255,b:0},{r:0,g:0,b:255},{r:0,g:255,b:255}];
        }

        callback();
    }

    if(Object.prototype.toString.call(file) == "[object File]") {
        var reader = new FileReader();
        reader.onload = (read).bind(this);
        reader.readAsText(file);
    }
    else if(typeof file == "string") {
        zip.file(file).async("string").then((read).bind(this), (function(fuckme) {
            console.log(fuckme);
        }).bind(this));
    }
}

Beatmap.prototype.getNextNonInheritedTimingPoint = function(num) {
    for(var i = num + 1; i < this.timingPoints.length; i++) {
        if(!this.timingPoints[i].inherited) return this.timingPoints[i];
    }

    return null;
}