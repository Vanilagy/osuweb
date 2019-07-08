(function () {
    'use strict';

    class HitObject {
        constructor(data) {
            let comboSkip = HitObject.getComboSkipsFromType(data[3]);
            let hitObjectType = parseInt(data[3]) % 16;
            this.newCombo = hitObjectType === 5 || hitObjectType === 6 || hitObjectType === 12 ? (comboSkip > 0 ? comboSkip : -1) : false;
            this.x = parseInt(data[0]);
            this.y = parseInt(data[1]);
            this.time = parseInt(data[2]);
            this.hitSound = parseInt(data[4]);
            let samplingValues = ["0", "0"];
            if (data[5] !== undefined) {
                samplingValues = data[5].split(':');
            }
            this.samplings = {
                sampleSet: parseInt(samplingValues[0], 10),
                sampleSetAddition: parseInt(samplingValues[1], 10)
            };
        }
        static getComboSkipsFromType(hitObjectType) {
            let comboSkip = 0;
            while (hitObjectType > 12) {
                hitObjectType -= 16;
                comboSkip++;
            }
            return comboSkip;
        }
    }
    //# sourceMappingURL=hit_object.js.map

    class Slider extends HitObject {
        constructor(data) {
            super(data);
            this.additions = [];
            this.edgeSamplings = [];
            this.bodySamplings = {};
            this.sections = this.parseSections(data);
            this.repeat = parseInt(data[6]);
            this.length = parseFloat(data[7]);
            //region edgeAdditions
            if (data[8] !== null && data[8] !== undefined) {
                let additionsValuesRaw = data[8].split('|');
                let additions = [];
                for (let j = 0; j < additionsValuesRaw.length; j++) {
                    additions.push(parseInt(additionsValuesRaw[j], 10));
                }
                this.additions = additions;
            }
            else {
                let additions = [];
                for (let j = 0; j < this.repeat + 1; j++) {
                    additions.push(0);
                }
                this.additions = additions;
            }
            //endregion
            //region edgeSamplings
            if (data[9] !== null && data[9] !== undefined) {
                let edgeSamplings = [];
                let splitEdgeSampleSetsRaw = data[9].split('|');
                for (let j = 0; j < splitEdgeSampleSetsRaw.length; j++) {
                    let val = splitEdgeSampleSetsRaw[j].split(':');
                    edgeSamplings.push({
                        sampleSet: parseInt(val[0], 10),
                        sampleSetAddition: parseInt(val[1], 10)
                    });
                }
                this.edgeSamplings = edgeSamplings;
            }
            else {
                let edgeSamplings = [];
                let splitEdgeSampleSetsRaw = [];
                for (let j = 0; j < this.repeat + 1; j++)
                    splitEdgeSampleSetsRaw.push("0:0");
                for (let j = 0; j < splitEdgeSampleSetsRaw.length; j++) {
                    let val = splitEdgeSampleSetsRaw[j].split(':');
                    edgeSamplings.push({
                        sampleSet: parseInt(val[0], 10),
                        sampleSetAddition: parseInt(val[1], 10)
                    });
                }
                this.edgeSamplings = edgeSamplings;
            }
            //endregion
            //region bodySamplings
            if (data[10] !== null && data[10] !== undefined) {
                let sliderBodySamplingValues = ["0", "0"];
                if (data[10] !== undefined) {
                    sliderBodySamplingValues = data[10].split(':');
                }
                this.bodySamplings = {
                    sampleSet: parseInt(sliderBodySamplingValues[0], 10),
                    sampleSetAddition: parseInt(sliderBodySamplingValues[1], 10)
                };
            }
            else {
                this.bodySamplings = { sampleSet: 0, sampleSetAddition: 0 };
            }
            //endregion
        }
        parseSections(data) {
            let sliderPoints = data[5].split("|");
            let sliderType = sliderPoints[0];
            let sliderSections = [];
            let sliderSectionPoints = [{ x: parseInt(data[0], 10), y: parseInt(data[1], 10) }];
            let lastPoint = null;
            for (let j = 1; j < sliderPoints.length; j++) {
                let coords = sliderPoints[j].split(':');
                let nextPoint = { x: parseInt(coords[0], 10), y: parseInt(coords[1], 10) };
                // end section if same point appears twice and start a new one if end is not reached
                if (JSON.stringify(lastPoint) === JSON.stringify(nextPoint)) {
                    this.finishSection(sliderSectionPoints, sliderType, sliderSections);
                    // Don't make a new section in case this is the last point
                    if (j + 1 !== sliderPoints.length)
                        sliderSectionPoints = [];
                }
                sliderSectionPoints.push(nextPoint);
                if (j + 1 === sliderPoints.length)
                    this.finishSection(sliderSectionPoints, sliderType, sliderSections);
                lastPoint = nextPoint;
            }
            return sliderSections;
        }
        finishSection(sliderSectionPoints, sliderType, sliderSections) {
            let sectionType = "unknown";
            if (sliderSectionPoints.length === 3 && sliderType === "P") {
                sectionType = "passthrough";
            }
            else if (sliderSectionPoints.length === 2) {
                sectionType = "linear";
            }
            else {
                sectionType = "bezier";
            }
            if (sliderSectionPoints.length > 1)
                sliderSections.push({
                    type: sectionType,
                    values: sliderSectionPoints
                });
        }
    }
    //# sourceMappingURL=slider.js.map

    class Circle extends HitObject {
        constructor(data) {
            super(data);
            this.hittable = true;
        }
    }
    //# sourceMappingURL=circle.js.map

    class BeatmapDifficulty {
        constructor() {
            // Stack leniency
            this.SL = 0.5;
            // Slider velocity
            this.SV = 1.4;
            // Slider tick rate
            this.TR = 1;
            // Approach rate
            this.AR = 5;
            // Hit Points
            this.HP = 5;
            // Overall difficulty
            this.OD = 5;
            // Circle size
            this.CS = 5;
        }
        // AR
        static getApproachTime(AR) {
            if (AR <= 5) {
                return 1800 - 120 * AR;
            }
            else {
                return 1950 - 150 * AR;
            }
        }
        getApproachTime() {
            if (this.AR <= 5) {
                return 1800 - 120 * this.AR;
            }
            else {
                return 1950 - 150 * this.AR;
            }
        }
        // OD
        static getHitDeltaForRating(OD, rating) {
            switch (rating) {
                case 300:
                    return Math.ceil(79.5 - 6 * OD);
                case 100:
                    return Math.ceil(139.5 - 8 * OD);
                case 50:
                    return Math.ceil(199.5 - 10 * OD);
                default:
                    return -1;
            }
        }
        getHitDeltaForRating(rating) {
            switch (rating) {
                case 300:
                    return Math.ceil(79.5 - 6 * this.OD);
                case 100:
                    return Math.ceil(139.5 - 8 * this.OD);
                case 50:
                    return Math.ceil(199.5 - 10 * this.OD);
                default:
                    return -1;
            }
        }
        static getRatingForHitDelta(OD, hitDelta) {
            if (BeatmapDifficulty.getHitDeltaForRating(OD, 300) >= hitDelta)
                return 300;
            if (BeatmapDifficulty.getHitDeltaForRating(OD, 100) >= hitDelta)
                return 100;
            if (BeatmapDifficulty.getHitDeltaForRating(OD, 50) >= hitDelta)
                return 50;
            return 0;
        }
        getRatingForHitDelta(hitDelta) {
            if (this.getHitDeltaForRating(300) >= hitDelta)
                return 300;
            if (this.getHitDeltaForRating(100) >= hitDelta)
                return 100;
            if (this.getHitDeltaForRating(50) >= hitDelta)
                return 50;
            return 0;
        }
        // CS
        static getCirclePixelSize(CS) {
            return 64 * (1.0 - 0.7 * (CS - 5) / 5);
        }
        getCirclePixelSize() {
            return 64 * (1.0 - 0.7 * (this.CS - 5) / 5);
        }
    }
    //# sourceMappingURL=beatmap_difficulty.js.map

    class Beatmap {
        constructor(file, callback, loadFlat = false) {
            this.version = '';
            this.audioFilename = null;
            this.audioLeadIn = null;
            this.previewTime = null;
            this.countdown = null;
            this.sampleSet = null;
            this.mode = null;
            this.letterBoxInBreaks = null;
            this.widescreenStoryboard = null;
            this.title = null;
            this.titleUnicode = null;
            this.artist = null;
            this.artistUnicode = null;
            this.creator = null;
            this.source = null;
            this.tags = null;
            this.beatmapID = null;
            this._beatmapSetID = null;
            //Console.verbose("--- START BEATMAP LOADING ---");
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
            else if (file instanceof File) {
                //Console.verbose("Load Beatmap from file: "+file.name);
                let reader = new FileReader();
                reader.onload = (e) => {
                    this.parseBeatmap(reader.result);
                };
                reader.readAsText(file);
            }
            // Read text from a zip entry
            else if (typeof file === "string") {
                //Console.verbose("Load Beatmap from zip entry: "+file);
                ZIP.file(file).async("string").then(this.parseBeatmap.bind(this), (fuckme) => {
                    //Console.error("Fatal error while reading zip entry: "+fuckme);
                });
            }
        }
        parseBeatmap(text) {
            //Console.debug("Start beatmap parsing...");
            let lines = text.split('\n');
            let section = "header";
            for (let i = 0; i < lines.length; i++) {
                let line = lines[i].trim();
                if (line === "")
                    continue;
                if (line.startsWith("osu file format v")) {
                    this.version = line.substr(line.length - 2, 2);
                    //Console.verbose("Beatmap version: "+this.version);
                    //if(!line.endsWith("14")) Console.warn("The beatmap version seems to be older than supported. We could run into issue here!");
                }
                else if (line.startsWith("[") && line.endsWith("]")) {
                    section = line.substr(1, line.length - 2).toLowerCase();
                    //Console.verbose("Reading new section: "+line);
                }
                else if (section === "colours") {
                    this.parseComboColour(line);
                }
                else if (section === "timingpoints") {
                    this.parseTimingPoint(line);
                }
                else if (section === "events") {
                    if (line.startsWith("//"))
                        continue;
                    this.parseEvent(line);
                }
                else if (section === "hitobjects") {
                    this.parseHitObject(line);
                }
                else {
                    if (line.startsWith("AudioFilename"))
                        this.audioFilename = line.split(':')[1].trim();
                    if (line.startsWith("AudioLeadIn"))
                        this.audioLeadIn = parseInt(line.split(':')[1].trim(), 10);
                    if (line.startsWith("PreviewTime"))
                        this.previewTime = parseInt(line.split(':')[1].trim(), 10);
                    if (line.startsWith("Countdown"))
                        this.countdown = parseInt(line.split(':')[1].trim(), 10);
                    if (line.startsWith("SampleSet"))
                        this.sampleSet = parseInt(line.split(':')[1].trim(), 10);
                    if (line.startsWith("StackLeniency"))
                        this.difficulty.SL = parseFloat(line.split(':')[1].trim());
                    if (line.startsWith("Mode"))
                        this.mode = parseInt(line.split(':')[1].trim(), 10);
                    if (line.startsWith("LetterboxInBreaks"))
                        this.letterBoxInBreaks = parseInt(line.split(':')[1].trim(), 10);
                    if (line.startsWith("WidescreenStoryboard"))
                        this.widescreenStoryboard = parseInt(line.split(':')[1].trim(), 10);
                    if (line.startsWith("Title:"))
                        this.title = line.split(':')[1].trim();
                    if (line.startsWith("TitleUnicode"))
                        this.titleUnicode = line.split(':')[1].trim();
                    if (line.startsWith("Artist:"))
                        this.artist = line.split(':')[1].trim();
                    if (line.startsWith("ArtistUnicode"))
                        this.artistUnicode = line.split(':')[1].trim();
                    if (line.startsWith("Creator"))
                        this.creator = line.split(':')[1].trim();
                    if (line.startsWith("Version"))
                        this.version = line.split(':')[1].trim();
                    if (line.startsWith("Source"))
                        this.source = line.split(':')[1].trim();
                    if (line.startsWith("Tags"))
                        this.tags = line.split(':')[1].trim();
                    if (line.startsWith("BeatmapID"))
                        this.beatmapID = parseInt(line.split(':')[1].trim(), 10);
                    if (line.startsWith("BeatmapSetID"))
                        this._beatmapSetID = parseInt(line.split(':')[1].trim(), 10);
                    if (line.startsWith("HPDrainRate"))
                        this.difficulty.HP = parseFloat(line.split(':')[1].trim());
                    if (line.startsWith("CircleSize"))
                        this.difficulty.CS = parseFloat(line.split(':')[1].trim());
                    if (line.startsWith("OverallDifficulty"))
                        this.difficulty.OD = parseFloat(line.split(':')[1].trim());
                    if (line.startsWith("ApproachRate")) {
                        this.difficulty.AR = parseFloat(line.split(':')[1].trim());
                        this._ARFound = true;
                    }
                    if (line.startsWith("SliderMultiplier"))
                        this.difficulty.SV = parseFloat(line.split(':')[1].trim());
                    if (line.startsWith("SliderTickRate"))
                        this.difficulty.TR = parseFloat(line.split(':')[1].trim());
                    //Console.verbose("Read header property: "+line);
                }
            }
            if (this.colours.length === 0) {
                this.colours = [{ r: 255, g: 192, b: 0 }, { r: 0, g: 202, b: 0 }, { r: 18, g: 124, b: 255 }, { r: 242, g: 24, b: 57 }];
                //Console.info("No combo colours in Beatmap found. Using default ones!");
            }
            if (!this._ARFound)
                this.difficulty.AR = this.difficulty.OD;
            //Console.debug("Finished Beatmap parsing! (Circles: "+this.circles+", Sliders: "+this.sliders+", Spinners: "+this.spinners+" ("+(this.circles+this.sliders+this.spinners)+" Total) - TimingPoints: "+this.timingPoints.length+")");
            //Console.verbose("--- BEATMAP LOADING FINISHED ---");
            //this._stars = new DifficultyCalculator(this).calculate(null);
            if (this.callback)
                this.callback(this);
        }
        parseComboColour(line) {
            let col = line.split(':')[1].trim().split(',');
            this.colours.push({
                r: parseInt(col[0], 10),
                g: parseInt(col[1], 10),
                b: parseInt(col[2], 10),
            });
            //Console.verbose("Added color #" + this.colours.length + ": " + col);
            //return col; Why this return?
        }
        parseTimingPoint(line) {
            let values = line.split(',');
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
                kiai: parseInt(values[7], 10),
            });
            //Console.verbose("Added timing point #" + this.timingPoints.length + ": " + JSON.stringify(this.timingPoints[this.timingPoints.length - 1]));
        }
        parseHitObject(line) {
            let values = line.split(',');
            let hitObjectData = parseInt(values[3], 10) % 16;
            if (hitObjectData === 1 || hitObjectData === 5) {
                if (!this.loadFlat) {
                    this.hitObjects.push(new Circle(values));
                    //Console.verbose("Circle added: " + JSON.stringify(this.hitObjects[this.hitObjects.length - 1]));
                }
                this.circles++;
            }
            else if (hitObjectData === 2 || hitObjectData === 6) {
                if (!this.loadFlat) {
                    this.hitObjects.push(new Slider(values));
                    //Console.verbose("Slider added: " + JSON.stringify(this.hitObjects[this.hitObjects.length - 1]));
                }
                this.sliders++;
            }
            else if (hitObjectData === 8 || hitObjectData === 12) {
                return;
                if (!this.loadFlat) ;
                this.spinners++;
            }
        }
        parseEvent(line) {
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
            //{let evt = this.events[this.events.length - 1]; if(evt !== null && evt !== undefined) Console.verbose("Added \""+evt.type+"\" event (#"+this.events.length+"): "+evt); }
        }
        getBackgroundImageName() {
            for (let key in this.events) {
                let evt = this.events[key];
                if (evt.type === "image") {
                    return evt.file;
                }
            }
            return "";
        }
        getNextNonInheritedTimingPoint(num) {
            for (let i = num + 1; i < this.timingPoints.length; i++) {
                if (!this.timingPoints[i].inherited)
                    return this.timingPoints[i];
            }
            return null;
        }
        get stars() {
            return this._stars;
        }
    }
    //# sourceMappingURL=beatmap.js.map

    class SliderCurve {
        constructor(drawableSlider) {
            this.equalDistancePoints = [];
            this.slider = drawableSlider;
            this.sections = drawableSlider.hitObject.sections;
            this.curveLength = 0;
        }
        calculateEqualDistancePoints() {
        }
        render(completion) {
        }
        draw() {
            this.slider.baseCtx.clearRect(0, 0, Math.ceil(this.slider.sliderWidth + gameState.currentPlay.circleDiameter), Math.ceil(this.slider.sliderHeight + gameState.currentPlay.circleDiameter));
            //this.slider.baseCtx.fillStyle = 'red';
            //this.slider.baseCtx.fillRect(0, 0, this.slider.sliderWidth + gameState.currentPlay.circleDiameter, this.slider.sliderHeight + gameState.currentPlay.circleDiameter);
            // "Border"
            this.slider.baseCtx.lineWidth = gameState.currentPlay.circleDiameter * this.slider.reductionFactor;
            this.slider.baseCtx.strokeStyle = "white";
            this.slider.baseCtx.lineCap = "round";
            this.slider.baseCtx.lineJoin = "round";
            this.slider.baseCtx.globalCompositeOperation = "source-over";
            this.slider.baseCtx.stroke();
            let colourArray = gameState.currentPlay.processedBeatmap.beatmap.colours;
            let colour = colourArray[this.slider.comboInfo.comboNum % colourArray.length];
            colour = {
                r: 3,
                g: 3,
                b: 12
            };
            // Gradient
            for (let i = this.slider.sliderBodyRadius; i > 1; i -= 2) {
                this.slider.baseCtx.lineWidth = i * 2;
                let brightnessCompletion = 1 - (i / this.slider.sliderBodyRadius); // 0 -> Border, 1 -> Center
                let red = Math.floor(colour.r + (255 - colour.r) / 2 * brightnessCompletion), green = Math.floor(colour.g + (255 - colour.g) / 2 * brightnessCompletion), blue = Math.floor(colour.b + (255 - colour.b) / 2 * brightnessCompletion);
                this.slider.baseCtx.strokeStyle = "rgb(" + red + ", " + green + ", " + blue + ")";
                this.slider.baseCtx.stroke();
            }
            this.slider.baseCtx.lineWidth = this.slider.sliderBodyRadius * 2;
            this.slider.baseCtx.strokeStyle = "rgba(255, 255, 255, 0.5)";
            this.slider.baseCtx.globalCompositeOperation = "destination-out"; // Transparency
            this.slider.baseCtx.stroke();
        }
        pushEqualDistancePoint(pos) {
            this.equalDistancePoints.push(pos);
            let pixelRatio = gameState.currentPlay.pixelRatio;
            this.slider.minX = Math.min(this.slider.minX, pos.x * pixelRatio);
            this.slider.minY = Math.min(this.slider.minY, pos.y * pixelRatio);
            this.slider.maxX = Math.max(this.slider.maxX, pos.x * pixelRatio);
            this.slider.maxY = Math.max(this.slider.maxY, pos.y * pixelRatio);
        }
    }
    //# sourceMappingURL=slider_curve.js.map

    class SliderCurveEmpty extends SliderCurve {
        constructor(drawableSlider) {
            super(drawableSlider);
            //this.equalDistancePoints.push(drawableSlider.startPoint); // TODO
        }
    }
    //# sourceMappingURL=slider_curve_empty.js.map

    class MathUtil {
        static coordsOnBezier(pointArray, t) {
            let bx = 0, by = 0, n = pointArray.length - 1; // degree
            if (n === 1) { // if linear
                bx = (1 - t) * pointArray[0].x + t * pointArray[1].x;
                by = (1 - t) * pointArray[0].y + t * pointArray[1].y;
            }
            else if (n === 2) { // if quadratic
                bx = (1 - t) * (1 - t) * pointArray[0].x + 2 * (1 - t) * t * pointArray[1].x + t * t * pointArray[2].x;
                by = (1 - t) * (1 - t) * pointArray[0].y + 2 * (1 - t) * t * pointArray[1].y + t * t * pointArray[2].y;
            }
            else if (n === 3) { // if cubic
                bx = (1 - t) * (1 - t) * (1 - t) * pointArray[0].x + 3 * (1 - t) * (1 - t) * t * pointArray[1].x + 3 * (1 - t) * t * t * pointArray[2].x + t * t * t * pointArray[3].x;
                by = (1 - t) * (1 - t) * (1 - t) * pointArray[0].y + 3 * (1 - t) * (1 - t) * t * pointArray[1].y + 3 * (1 - t) * t * t * pointArray[2].y + t * t * t * pointArray[3].y;
            }
            else { // generalized equation
                for (let i = 0; i <= n; i++) {
                    bx += this.binomialCoef(n, i) * Math.pow(1 - t, n - i) * Math.pow(t, i) * pointArray[i].x;
                    by += this.binomialCoef(n, i) * Math.pow(1 - t, n - i) * Math.pow(t, i) * pointArray[i].y;
                }
            }
            return { x: bx, y: by };
        }
        static binomialCoef(n, k) {
            let r = 1;
            if (k > n)
                return 0;
            for (let d = 1; d <= k; d++) {
                r *= n--;
                r /= d;
            }
            return r;
        }
        static circleCenterPos(p1, p2, p3) {
            let yDelta_a = p2.y - p1.y;
            let xDelta_a = p2.x - p1.x;
            let yDelta_b = p3.y - p2.y;
            let xDelta_b = p3.x - p2.x;
            let center = { x: 0, y: 0 };
            let aSlope = yDelta_a / xDelta_a;
            let bSlope = yDelta_b / xDelta_b;
            let AB_Mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
            let BC_Mid = { x: (p2.x + p3.x) / 2, y: (p2.y + p3.y) / 2 };
            if (yDelta_a === 0) //aSlope == 0
             {
                center.x = AB_Mid.x;
                if (xDelta_b === 0) //bSlope == INFINITY
                 {
                    center.y = BC_Mid.y;
                }
                else {
                    center.y = BC_Mid.y + (BC_Mid.x - center.x) / bSlope;
                }
            }
            else if (yDelta_b === 0) //bSlope == 0
             {
                center.x = BC_Mid.x;
                if (xDelta_a === 0) //aSlope == INFINITY
                 {
                    center.y = AB_Mid.y;
                }
                else {
                    center.y = AB_Mid.y + (AB_Mid.x - center.x) / aSlope;
                }
            }
            else if (xDelta_a === 0) //aSlope == INFINITY
             {
                center.y = AB_Mid.y;
                center.x = bSlope * (BC_Mid.y - center.y) + BC_Mid.x;
            }
            else if (xDelta_b === 0) //bSlope == INFINITY
             {
                center.y = BC_Mid.y;
                center.x = aSlope * (AB_Mid.y - center.y) + AB_Mid.x;
            }
            else {
                center.x = (aSlope * bSlope * (AB_Mid.y - BC_Mid.y) - aSlope * BC_Mid.x + bSlope * AB_Mid.x) / (bSlope - aSlope);
                center.y = AB_Mid.y - (center.x - AB_Mid.x) / aSlope;
            }
            return center;
        }
        static reflect(val) {
            if (Math.floor(val) % 2 === 0) {
                return val - Math.floor(val);
            }
            else {
                return 1 - (val - Math.floor(val));
            }
        }
        static distance(p1, p2) {
            return Math.hypot(p1.x - p2.x, p1.y - p2.y);
        }
        static getRandomInt(min, max) {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }
        static getNormalizedAngleDelta(alpha, beta) {
            let difference = alpha - beta;
            if (beta - alpha < -Math.PI) {
                difference -= Math.PI * 2;
            }
            else if (difference < -Math.PI) {
                difference += Math.PI * 2;
            }
            return difference;
        }
        static getAvg(array) {
            let total = 0, len = array.length;
            for (let i = 0; i < len; i++) {
                total += array[i];
            }
            return total / len;
        }
        static clamp(val, min, max) {
            if (val < min) {
                return min;
            }
            else if (val > max) {
                return max;
            }
            return val;
        }
        static ease(type, val) {
            let p = 0.3; // Some shit used for elastic bounce
            switch (type) {
                /**
                    Only considering the value for the range [0, 1] => [0, 1].
                    The higher the power used (Quad, Cubic, Quart), the more sudden the animation will be.
                 */
                case "linear": // no easing, no acceleration
                    return val;
                    break;
                case "easeInQuad": // accelerating from zero velocity
                    return val * val;
                    break;
                case "easeOutQuad": // decelerating to zero velocity
                    return val * (2 - val);
                    break;
                case "easeInOutQuad": // acceleration until halfway, then deceleration
                    return val < 0.5 ? 2 * val * val : -1 + (4 - 2 * val) * val;
                    break;
                case "easeInCubic": // accelerating from zero velocity
                    return val * val * val;
                    break;
                case "easeOutCubic": // decelerating to zero velocity
                    return (--val) * val * val + 1;
                    break;
                case "easeInOutCubic": // acceleration until halfway, then deceleration
                    return val < 0.5 ? 4 * val * val * val : (val - 1) * (2 * val - 2) * (2 * val - 2) + 1;
                    break;
                case "easeInQuart": // accelerating from zero velocity
                    return val * val * val * val;
                    break;
                case "easeOutQuart": // decelerating to zero velocity
                    return 1 - (--val) * val * val * val;
                    break;
                case "easeInOutQuart": // acceleration until halfway, then deceleration
                    return val < 0.5 ? 8 * val * val * val * val : 1 - 8 * (--val) * val * val * val;
                    break;
                case "easeInQuint": // accelerating from zero velocity
                    return val * val * val * val * val;
                    break;
                case "easeOutQuint": // decelerating to zero velocity
                    return 1 + (--val) * val * val * val * val;
                    break;
                case "easeInOutQuint": // acceleration until halfway, then deceleration
                    return val < 0.5 ? 16 * val * val * val * val * val : 1 + 16 * (--val) * val * val * val * val;
                    break;
                case "easeOutElastic": // Cartoon-like elastic effect
                    return Math.pow(2, -10 * val) * Math.sin((val - p / 4) * (2 * Math.PI) / p) + 1;
                    break;
                case "easeInSine": // accelerating from zero velocity, using trig.
                    return -1 * Math.cos(val * (Math.PI / 2)) + 1;
                    break;
                case "easeOutSine": // decelerating to zero velocity, using trig.
                    return Math.sin(val * (Math.PI / 2));
                    break;
                case "easeInOutSine": // acceleration until halfway, then deceleration, using trig.
                    return Math.cos(Math.PI * val) * -0.5 + 0.5;
                    break;
                case "easeInExpo": // Accelerate exponentially until finish
                    return val === 0 ? 0 : Math.pow(2, 10 * (val - 1));
                    break;
                case "easeOutExpo": // Initial exponential acceleration slowing to stop
                    return val === 1 ? 1 : (-Math.pow(2, -10 * val) + 1);
                case "easeInOutExpo": // Exponential acceleration and deceleration
                    if (val === 0 || val === 1)
                        return val;
                    const scaledTime = val * 2;
                    const scaledTime1 = scaledTime - 1;
                    if (scaledTime < 1) {
                        return 0.5 * Math.pow(2, 10 * (scaledTime1));
                    }
                    return 0.5 * (-Math.pow(2, -10 * scaledTime1) + 2);
                default:
                    return val;
            }
        }
    }
    //# sourceMappingURL=math_util.js.map

    const MAXIMUM_TRACE_POINT_DISTANCE = 3;
    const TOLERANCE = 0.25;
    class SliderCurveBezier extends SliderCurve {
        constructor(drawableSlider, speedCalc) {
            super(drawableSlider);
            this.equalDistancePoints = [];
            this.tracePoints = [];
            if (!speedCalc) {
                this.slider.minX = this.slider.maxX = this.sections[0].values[0].x * gameState.currentPlay.pixelRatio;
                this.slider.minY = this.slider.maxY = this.sections[0].values[0].y * gameState.currentPlay.pixelRatio;
                if (this.sections.length === 1 && this.sections[0].values.length === 2) { // If it's only one linear section
                    let points = this.sections[0].values;
                    let angle = Math.atan2(points[1].y - points[0].y, points[1].x - points[0].x);
                    let distance = Math.min(this.slider.hitObject.length, Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y));
                    let pointTwo = {
                        x: points[0].x + Math.cos(angle) * distance,
                        y: points[0].y + Math.sin(angle) * distance
                    };
                    this.pushEqualDistancePoint(points[0]);
                    this.pushEqualDistancePoint(pointTwo);
                    return;
                }
            }
            this.calculateTracePoints(speedCalc);
            if (!speedCalc)
                this.calculateEqualDistancePoints();
        }
        applyStackPosition() {
            for (let i = 0; i < this.equalDistancePoints.length; i++) {
                this.equalDistancePoints[i].x -= this.slider.stackHeight * 4;
                this.equalDistancePoints[i].y -= this.slider.stackHeight * 4;
            }
        }
        render(completion) {
            let pixelRatio = gameState.currentPlay.pixelRatio;
            let actualIndex = completion * (this.equalDistancePoints.length - 1);
            let targetIndex = Math.floor(actualIndex);
            // Path generation
            this.slider.baseCtx.beginPath();
            let startPoint = this.slider.toCtxCoord(this.equalDistancePoints[0]);
            this.slider.baseCtx.moveTo(startPoint.x, startPoint.y);
            for (let i = 1; i < targetIndex + 1; i++) {
                let point = this.equalDistancePoints[i];
                // The fuck is this pointless shit that V8 can't even optimize for? @David in 2017
                // This part skips points that belong to the same linear segment, in order to draw them in one stroke
                //if (point.linearSegmentId !== undefined) {
                //    if (this.equalDistancePoints[i + 1] && this.equalDistancePoints[i + 1].linearSegmentId === point.linearSegmentId) {
                //        continue;
                //    }
                //}
                point = this.slider.toCtxCoord(point);
                this.slider.baseCtx.lineTo(point.x, point.y);
            }
            if (completion !== 1) {
                let snakingEndPoint = this.slider.toCtxCoord(this.slider.getPosFromPercentage(completion));
                this.slider.baseCtx.lineTo(snakingEndPoint.x, snakingEndPoint.y);
            }
            this.draw();
        }
        getEndPoint() {
            if (this.curveLength <= this.slider.hitObject.length) {
                return this.tracePoints[this.tracePoints.length - 1]; // Just get the last point
            }
            else { // If it's longer, backtrack from ze end
                let lengthDifference = this.curveLength - this.slider.hitObject.length;
                let distanceTraveled = 0;
                let lastPoint = this.tracePoints[this.tracePoints.length - 1];
                for (let i = this.tracePoints.length - 2; i >= 0; i--) {
                    let currentPoint = this.tracePoints[i];
                    let dist = Math.hypot(currentPoint.x - lastPoint.x, currentPoint.y - lastPoint.y);
                    if (lengthDifference - distanceTraveled <= dist) {
                        let percentReached = (lengthDifference - distanceTraveled) / dist;
                        return {
                            x: lastPoint.x * (1 - percentReached) + currentPoint.x * percentReached,
                            y: lastPoint.y * (1 - percentReached) + currentPoint.y * percentReached
                        };
                    }
                    else {
                        distanceTraveled += dist;
                        lastPoint = currentPoint;
                    }
                }
            }
        }
        calculateTracePoints(speedCalc) {
            let traceDistance = (speedCalc) ? 8 : MAXIMUM_TRACE_POINT_DISTANCE;
            let tolerance = (speedCalc) ? 1 : TOLERANCE;
            for (let i = 0; i < this.sections.length; i++) {
                let points = this.sections[i].values;
                if (points.length === 2) { // if segment is linear
                    this.pushTracePoint(points[0]);
                    this.pushTracePoint(points[1]);
                }
                else {
                    let leftT = 0, rightT = 0.01;
                    let p1 = MathUtil.coordsOnBezier(points, leftT);
                    let p2 = MathUtil.coordsOnBezier(points, rightT);
                    this.pushTracePoint(p1);
                    while (leftT < 1) { // Binary segment approximation method
                        while (true) {
                            let dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
                            if (dist < traceDistance) {
                                leftT += 0.01;
                                rightT += 0.01;
                                if (leftT >= 1) {
                                    break;
                                }
                                p2 = MathUtil.coordsOnBezier(points, rightT);
                            }
                            else {
                                let p3, midT;
                                while (true) {
                                    midT = (leftT + rightT) / 2;
                                    p3 = MathUtil.coordsOnBezier(points, midT);
                                    dist = Math.hypot(p3.x - p1.x, p3.y - p1.y);
                                    if (Math.abs(traceDistance - dist) <= tolerance) {
                                        break;
                                    }
                                    if (dist < traceDistance) {
                                        leftT = midT;
                                    }
                                    else {
                                        rightT = midT;
                                    }
                                }
                                if (midT < 1) {
                                    this.pushTracePoint(p3);
                                    p1 = p3;
                                }
                                leftT = midT;
                                rightT = leftT + 0.01;
                                p2 = MathUtil.coordsOnBezier(points, rightT);
                                break;
                            }
                        }
                    }
                }
                this.pushTracePoint(points[points.length - 1]);
            }
            if (!speedCalc) {
                if (this.curveLength > this.slider.hitObject.length) { // If traced length bigger than pixelLength
                    this.curveLength = this.slider.hitObject.length;
                }
                // Extra point is added because floats
                let lastPoint = this.tracePoints[this.tracePoints.length - 1];
                let secondLastPoint = this.tracePoints[this.tracePoints.length - 2];
                if (lastPoint && secondLastPoint) {
                    let angle = Math.atan2(lastPoint.y - secondLastPoint.y, lastPoint.x - secondLastPoint.x);
                    this.tracePoints.push({
                        x: lastPoint.x + 500 * Math.cos(angle),
                        y: lastPoint.y + 500 * Math.sin(angle)
                    });
                }
            }
        }
        calculateEqualDistancePoints() {
            let segmentCount = Math.floor(this.curveLength / MAXIMUM_TRACE_POINT_DISTANCE + 1); // Math.floor + 1 is basically like .ceil, but we can't get 0 here
            let segmentLength = this.curveLength / segmentCount;
            /* Using the initially traced points, generate a slider path point array in which
             all points are equally distant from one another. This is done to guarantee constant
             slider velocity. */
            let lastPoint = this.tracePoints[0];
            this.pushEqualDistancePoint(lastPoint);
            let currentIndex = 1;
            for (let c = 0; c < segmentCount; c++) {
                let remainingLength = segmentLength;
                while (true) {
                    let dist = Math.hypot(lastPoint.x - this.tracePoints[currentIndex].x, lastPoint.y - this.tracePoints[currentIndex].y);
                    if (dist < remainingLength) {
                        lastPoint = this.tracePoints[currentIndex];
                        remainingLength -= dist;
                        currentIndex++;
                        //if (this.tracePoints[currentIndex].isLinearEndPoint) {
                        //    linearSegmentId++;
                        //}
                    }
                    else {
                        let percentReached = remainingLength / dist;
                        let newPoint = {
                            x: lastPoint.x * (1 - percentReached) + this.tracePoints[currentIndex].x * percentReached,
                            y: lastPoint.y * (1 - percentReached) + this.tracePoints[currentIndex].y * percentReached,
                        };
                        this.pushEqualDistancePoint(newPoint);
                        lastPoint = newPoint;
                        break;
                    }
                }
            }
        }
        pushTracePoint(pos) {
            if (this.tracePoints[this.tracePoints.length - 1]) {
                let thatPoint = this.tracePoints[this.tracePoints.length - 1];
                this.curveLength += Math.hypot(thatPoint.x - pos.x, thatPoint.y - pos.y);
            }
            //if (isLinearEndPoint) {
            //    pos.isLinearEndPoint = true;
            //}
            this.tracePoints.push(pos);
        }
    }
    //# sourceMappingURL=slider_curve_bezier.js.map

    class SliderCurvePassthrough extends SliderCurve {
        constructor(drawableSlider) {
            super(drawableSlider);
            this.centerPos = { x: 0, y: 0 };
            this.angleDifference = 0;
            this.radius = 0;
            this.startingAngle = 0;
        }
        applyStackPosition() {
            this.centerPos.x -= this.slider.stackHeight * 4;
            this.centerPos.y -= this.slider.stackHeight * 4;
        }
        render(completion) {
            let pixelRatio = gameState.currentPlay.pixelRatio;
            let centerPos = this.slider.toCtxCoord(this.centerPos);
            let angleDifference = this.angleDifference * completion;
            this.slider.baseCtx.beginPath();
            this.slider.baseCtx.arc(centerPos.x, centerPos.y, this.radius * pixelRatio, this.startingAngle, this.startingAngle + angleDifference, angleDifference < 0);
            this.draw();
        }
        getEndPoint() {
            let angle = this.startingAngle + this.angleDifference;
            return {
                x: this.centerPos.x + this.radius * Math.cos(angle),
                y: this.centerPos.y + this.radius * Math.sin(angle)
            };
        }
        calculateValues(speedCalc) {
            let points = this.sections[0].values;
            // Monstrata plz
            if (JSON.stringify(points[0]) === JSON.stringify(points[2])) { // case one
                //Console.warn("Converted P to L-slider due to case one.");
                this.sections[0] = { type: "linear", values: [points[0], points[1]] };
                this.sections[1] = { type: "linear", values: [points[1], points[2]] };
                this.slider.curve = new SliderCurveBezier(this.slider, speedCalc);
                return;
            }
            this.centerPos = MathUtil.circleCenterPos(points[0], points[1], points[2]);
            // Slider seems to have all points on one line. Parsing it as linear slider instead
            if (!isFinite(this.centerPos.x) || !isFinite(this.centerPos.y)) { // case two
                //Console.warn("Converted P to L-slider due to case two.");
                // Remove middle point
                this.sections[0].values.splice(1, 1);
                this.sections[0].type = "linear";
                this.slider.curve = new SliderCurveBezier(this.slider, speedCalc);
                return;
            }
            this.radius = Math.hypot(this.centerPos.x - points[0].x, this.centerPos.y - points[0].y);
            let a1 = Math.atan2(points[0].y - this.centerPos.y, points[0].x - this.centerPos.x), // angle to start
            a2 = Math.atan2(points[1].y - this.centerPos.y, points[1].x - this.centerPos.x), // angle to control point
            a3 = Math.atan2(points[2].y - this.centerPos.y, points[2].x - this.centerPos.x); // angle to end
            this.startingAngle = a1;
            this.angleDifference = this.slider.hitObject.length / this.radius;
            if ((a3 < a2 && a2 < a1) || (a1 < a3 && a3 < a2) || (a2 < a1 && a1 < a3)) { // Point order
                this.angleDifference *= -1;
            }
            let endAngle = this.startingAngle + this.angleDifference;
            if (!speedCalc) { // Figures out boundaries of the slider
                var pixelRatio = gameState.currentPlay.pixelRatio;
                var updateBoundaries = (angle) => {
                    this.slider.minX = Math.min(this.slider.minX, (this.centerPos.x + this.radius * Math.cos(angle)) * pixelRatio);
                    this.slider.maxX = Math.max(this.slider.maxX, (this.centerPos.x + this.radius * Math.cos(angle)) * pixelRatio);
                    this.slider.minY = Math.min(this.slider.minY, (this.centerPos.y + this.radius * Math.sin(angle)) * pixelRatio);
                    this.slider.maxY = Math.max(this.slider.maxY, (this.centerPos.y + this.radius * Math.sin(angle)) * pixelRatio);
                };
                this.slider.minX = this.slider.maxX = (this.centerPos.x + this.radius * Math.cos(a1)) * pixelRatio;
                this.slider.minY = this.slider.maxY = (this.centerPos.y + this.radius * Math.sin(a1)) * pixelRatio;
                updateBoundaries(endAngle);
                for (let revs = -1.5; revs <= 1.5; revs += 0.25) { // Rotates around in 90° segments
                    let angle = revs * Math.PI * 2;
                    if ((this.angleDifference > 0) ? (angle > this.startingAngle && angle < endAngle) : (angle > endAngle && angle < this.startingAngle)) {
                        updateBoundaries(angle);
                    }
                }
            }
        }
    }
    //# sourceMappingURL=slider_curve_passthrough.js.map

    class DrawableSlider {
        constructor(hitObject) {
            this.overlayCanvas = null;
            this.overlayCtx = null;
            this.baseCtx = null;
            this.sliderWidth = 0;
            this.sliderHeight = 0;
            this.minX = 0;
            this.maxX = 0;
            this.minY = 0;
            this.maxY = 0;
            this.sliderBodyRadius = 0;
            this.maxFollowCircleRadius = 0;
            this.endTime = 0;
            this.timingInfo = {};
            this.id = 0;
            this.stackHeight = 0;
            this.letGoTime = 0;
            this.hitObject = hitObject;
            this.reductionFactor = 0.92;
            this.curve = null;
            this.complete = true;
            this.container = new PIXI.Container();
            this.baseSprite = null;
            this.overlaySprite = null;
            this.headSprite = null;
            this.approachCircle = null;
            this.init();
        }
        init() {
            if (this.hitObject.sections.length === 0) {
                this.curve = new SliderCurveEmpty(this);
            }
            else if (this.hitObject.sections[0].type === "passthrough") {
                this.curve = new SliderCurvePassthrough(this);
                this.curve.calculateValues(false);
            }
            else {
                this.curve = new SliderCurveBezier(this, false);
            }
        }
        toCtxCoord(pos) {
            return {
                x: pos.x * gameState.currentPlay.pixelRatio - this.minX + gameState.currentPlay.circleDiameter / 2,
                y: pos.y * gameState.currentPlay.pixelRatio - this.minY + gameState.currentPlay.circleDiameter / 2
            };
        }
        draw() {
            if (!this.curve)
                return;
            this.sliderWidth = this.maxX - this.minX;
            this.sliderHeight = this.maxY - this.minY;
            this.sliderBodyRadius = gameState.currentPlay.circleDiameter / 2 * (this.reductionFactor - CIRCLE_BORDER_WIDTH);
            this.maxFollowCircleRadius = (gameState.currentPlay.circleDiameter / 2 * 2.20);
            let canvas = document.createElement('canvas');
            canvas.setAttribute('width', String(Math.ceil(this.sliderWidth + gameState.currentPlay.circleDiameter)));
            canvas.setAttribute('height', String(Math.ceil(this.sliderHeight + gameState.currentPlay.circleDiameter)));
            let ctx = canvas.getContext('2d');
            this.baseCtx = ctx;
            this.curve.render(1);
            this.baseSprite = new PIXI.Sprite(PIXI.Texture.fromCanvas(canvas));
            let headCanvas = document.createElement('canvas');
            headCanvas.setAttribute('width', String(gameState.currentPlay.circleDiameter));
            headCanvas.setAttribute('height', String(gameState.currentPlay.circleDiameter));
            let headCtx = headCanvas.getContext('2d');
            drawCircle(headCtx, 0, 0, this.comboInfo);
            this.headSprite = new PIXI.Sprite(PIXI.Texture.fromCanvas(headCanvas));
            this.headSprite.width = gameState.currentPlay.circleDiameter;
            this.headSprite.height = gameState.currentPlay.circleDiameter;
            this.approachCircle = new PIXI.Sprite(approachCircleTexture);
            this.approachCircle.width = gameState.currentPlay.circleDiameter;
            this.approachCircle.height = gameState.currentPlay.circleDiameter;
            this.overlayCanvas = document.createElement('canvas');
            this.overlayCanvas.setAttribute('width', String(Math.ceil(this.sliderWidth + gameState.currentPlay.circleDiameter)));
            this.overlayCanvas.setAttribute('height', String(Math.ceil(this.sliderHeight + gameState.currentPlay.circleDiameter)));
            let overlayCtx = this.overlayCanvas.getContext('2d');
            this.overlayCtx = overlayCtx;
            this.overlaySprite = new PIXI.Sprite();
            this.overlaySprite.texture = PIXI.Texture.fromCanvas(this.overlayCanvas);
        }
        show(currentTime) {
            if (!this.curve)
                return;
            this.container.addChild(this.baseSprite);
            this.container.addChild(this.overlaySprite);
            this.container.addChild(this.headSprite);
            mainHitObjectContainer.addChildAt(this.container, 0);
            approachCircleContainer.addChild(this.approachCircle);
            this.update(currentTime);
        }
        update(currentTime) {
            if (!this.curve)
                return;
            let yes = (currentTime - (this.hitObject.time - gameState.currentPlay.ARMs)) / gameState.currentPlay.ARMs;
            yes = MathUtil.clamp(yes, 0, 1);
            yes = MathUtil.ease('easeOutQuad', yes);
            //let fadeInCompletion = MathUtil.clamp(1 - ((this.hitObject.time - gameState.currentPlay!.ARMs/2) - currentTime) / 300, 0, 1);
            let fadeInCompletion = yes;
            this.container.alpha = fadeInCompletion;
            this.approachCircle.alpha = fadeInCompletion;
            this.container.x = window.innerWidth / 2 + (this.minX - gameState.currentPlay.circleDiameter / 2 - playfieldDimensions.width / 2 * gameState.currentPlay.pixelRatio);
            this.container.y = window.innerHeight / 2 + (this.minY - gameState.currentPlay.circleDiameter / 2 - playfieldDimensions.height / 2 * gameState.currentPlay.pixelRatio);
            this.headSprite.x = this.hitObject.x * gameState.currentPlay.pixelRatio - this.minX;
            this.headSprite.y = this.hitObject.y * gameState.currentPlay.pixelRatio - this.minY;
            let approachCircleCompletion = MathUtil.clamp((this.hitObject.time - currentTime) / gameState.currentPlay.ARMs, 0, 1);
            let approachCircleFactor = 3 * (approachCircleCompletion) + 1;
            let approachCircleDiameter = gameState.currentPlay.circleDiameter * approachCircleFactor;
            this.approachCircle.width = this.approachCircle.height = approachCircleDiameter;
            this.approachCircle.x = window.innerWidth / 2 + (this.hitObject.x - playfieldDimensions.width / 2) * gameState.currentPlay.pixelRatio - approachCircleDiameter / 2;
            this.approachCircle.y = window.innerHeight / 2 + (this.hitObject.y - playfieldDimensions.height / 2) * gameState.currentPlay.pixelRatio - approachCircleDiameter / 2;
            this.renderOverlay(currentTime);
            this.overlaySprite.texture.update();
            if (currentTime >= this.hitObject.time) {
                this.container.removeChild(this.headSprite);
                approachCircleContainer.removeChild(this.approachCircle);
            }
        }
        remove() {
            mainHitObjectContainer.removeChild(this.container);
            approachCircleContainer.removeChild(this.approachCircle);
        }
        getPosFromPercentage(percent) {
            if (this.curve instanceof SliderCurveBezier) {
                return getCoordFromCoordArray(this.curve.equalDistancePoints, percent);
            }
            else if (this.curve instanceof SliderCurvePassthrough) {
                let angle = this.curve.startingAngle + this.curve.angleDifference * percent;
                return {
                    x: this.curve.centerPos.x + this.curve.radius * Math.cos(angle),
                    y: this.curve.centerPos.y + this.curve.radius * Math.sin(angle)
                };
            }
            else {
                console.warn("Tried to access position from empty slider. Empty. Slider. What's that?");
            }
        }
        renderOverlay(currentTime) {
            let pixelRatio = gameState.currentPlay.pixelRatio;
            let completion = 0;
            let currentSliderTime = currentTime - this.hitObject.time;
            let isMoving = currentSliderTime >= 0;
            /*
            if (GAME_STATE.gameState.currentPlay.mods.HD) { // Slowly fade out slider body
                this.baseCanvas.style.opacity = MathUtil.clamp(1 - ((currentSliderTime + GAME_STATE.gameState.currentPlay.ARMs / 2) / (this.endTime - this.startTime + GAME_STATE.gameState.currentPlay.ARMs / 2)), 0, 1);

                if (currentSliderTime >= -GAME_STATE.gameState.currentPlay.ARMs / 2 && !isMoving) {
                    this.baseCanvas.style.webkitMask = "radial-gradient(" + (GAME_STATE.gameState.currentPlay.halfCsPixel * (this.reductionFactor - CIRCLE_BORDER_WIDTH / 2)) + "px at " + (this.startPoint.x * pixelRatio - this.minX + GAME_STATE.gameState.currentPlay.halfCsPixel) + "px " + (this.startPoint.y * pixelRatio - this.minY + GAME_STATE.gameState.currentPlay.halfCsPixel) + "px, rgba(0, 0, 0, " + MathUtil.clamp((currentSliderTime + GAME_STATE.gameState.currentPlay.ARMs / 2) / (GAME_STATE.gameState.currentPlay.ARMs / 4), 0, 1) + ") 99%, rgba(0, 0, 0, 1) 100%)";
                }
            }*/
            if (currentSliderTime >= this.endTime - this.hitObject.time + 175)
                return;
            this.overlayCtx.clearRect(0, 0, Math.ceil(this.sliderWidth + gameState.currentPlay.circleDiameter), Math.ceil(this.sliderHeight + gameState.currentPlay.circleDiameter));
            if (isMoving) {
                completion = Math.min(this.hitObject.repeat, (this.timingInfo.sliderVelocity * currentSliderTime) / this.hitObject.length);
            }
            // Draws reverse arrow
            if (this.hitObject.repeat - completion > 1 && this.complete) {
                let reverseArrowPos = null;
                let p2 = null;
                const INFINITESIMAL = 0.00001; // Okay, not really infinitely small. But you get the point.
                if (Math.floor(completion) % 2 === 0) {
                    reverseArrowPos = this.getPosFromPercentage(1);
                    p2 = this.getPosFromPercentage(1 - INFINITESIMAL);
                }
                else {
                    reverseArrowPos = this.getPosFromPercentage(0);
                    p2 = this.getPosFromPercentage(0 + INFINITESIMAL);
                }
                let angle = Math.atan2(p2.y - reverseArrowPos.y, p2.x - reverseArrowPos.x);
                let x = reverseArrowPos.x * gameState.currentPlay.pixelRatio - this.minX;
                let y = reverseArrowPos.y * gameState.currentPlay.pixelRatio - this.minY;
                // Create second off-screen canvas used for rotating the text
                let reverseArrowCanvas = document.createElement("canvas");
                reverseArrowCanvas.setAttribute("width", String(gameState.currentPlay.circleDiameter));
                reverseArrowCanvas.setAttribute("height", String(gameState.currentPlay.circleDiameter));
                let reverseArrowCtx = reverseArrowCanvas.getContext("2d");
                reverseArrowCtx.translate(gameState.currentPlay.circleDiameter / 2, gameState.currentPlay.circleDiameter / 2);
                reverseArrowCtx.rotate(angle);
                reverseArrowCtx.translate(-gameState.currentPlay.circleDiameter / 2, -gameState.currentPlay.circleDiameter / 2);
                reverseArrowCtx.font = "lighter " + (gameState.currentPlay.circleDiameter * 0.6) + "px Arial";
                reverseArrowCtx.textAlign = "center";
                reverseArrowCtx.textBaseline = "middle";
                reverseArrowCtx.fillStyle = "white";
                reverseArrowCtx.fillText("➔", gameState.currentPlay.circleDiameter / 2, gameState.currentPlay.circleDiameter / 2);
                this.overlayCtx.drawImage(reverseArrowCanvas, x, y);
            }
            // Draws slider ball and follow circle to additional canvas
            let sliderBallPos;
            if (isMoving) {
                sliderBallPos = this.toCtxCoord(this.getPosFromPercentage(MathUtil.reflect(completion)));
                let fadeOutCompletion = Math.min(1, Math.max(0, (currentTime - this.letGoTime) / 120));
                let colourArray = gameState.currentPlay.processedBeatmap.beatmap.colours;
                let colour = colourArray[this.comboInfo.comboNum % colourArray.length];
                // Draw slider ball
                if (completion < this.hitObject.repeat) {
                    {
                        let colourString = "rgb(" + colour.r + "," + colour.g + "," + colour.b + ")";
                        this.overlayCtx.beginPath();
                        this.overlayCtx.arc(sliderBallPos.x, sliderBallPos.y, this.sliderBodyRadius, 0, Math.PI * 2);
                        this.overlayCtx.fillStyle = colourString;
                        this.overlayCtx.fill();
                    }
                }
            }
        }
    }
    //# sourceMappingURL=drawable_slider.js.map

    console.log("ORERU!");
    const beatmapFileSelect = document.querySelector('#beatmapSelect');
    const playButton = document.querySelector('#playButton');
    const mainCanvas = document.querySelector('#mainCanvas');
    const cursorElement = document.querySelector('#cursor');
    let beatmap = null;
    let audioCtx = new AudioContext();
    let files = null;
    const playfieldDimensions = {
        width: 512,
        height: 384
    };
    // 'nonet - Now On Stage!! (Fycho) [Extra].osu'
    // 'xi - Akasha (Jemmmmy) [Extreme].osu'
    // "Knife Party - Centipede (Sugoi-_-Desu) [This isn't a map, just a simple visualisation].osu"
    // "Halozy - Kikoku Doukoku Jigokuraku (Hollow Wings) [Notch Hell].osu"
    // IAHN - Transform (Original Mix) (Monstrata) [Aspire].osu
    beatmapFileSelect.addEventListener('change', (e) => {
        let fileArr = [...beatmapFileSelect.files];
        files = fileArr;
        let beatmapNames = [];
        for (let file of fileArr) {
            if (file.name.endsWith('.osu')) {
                beatmapNames.push(file.name);
            }
            /*
            if (file.name === beatmapFileName) {
                new Beatmap(file, (map) => {
                    console.log("Beatmap parsed.", map);
                    beatmap = map;
                });
            }*/
        }
        let promptStr = 'Select a beatmap by entering the number:\n';
        beatmapNames.forEach((value, index) => {
            promptStr += index + ': ' + value + '\n';
        });
        let id = Number(prompt(promptStr));
        new Beatmap(fileArr.find((file) => file.name === beatmapNames[id]), (map) => {
            console.log("Beatmap parsed.", map);
            beatmap = map;
            startPlay();
        });
    });
    let gameState = {
        currentPlay: null
    };
    class Play {
        constructor(beatmap) {
            this.audioOffset = 0;
            this.processedBeatmap = new ProcessedBeatmap(beatmap);
            this.audioStartTime = null;
            this.currentHitObjectId = 0;
            this.onscreenObjects = {};
            this.pixelRatio = null;
            this.circleDiameter = null;
            this.ARMs = BeatmapDifficulty.getApproachTime(this.processedBeatmap.beatmap.difficulty.AR);
        }
        init() {
            let screenHeight = window.innerHeight * 0.95;
            this.pixelRatio = screenHeight / 480;
            let osuCircleDiameter = this.processedBeatmap.beatmap.difficulty.getCirclePixelSize();
            this.circleDiameter = Math.round(osuCircleDiameter * this.pixelRatio);
            console.time("Beatmap init");
            this.processedBeatmap.init();
            console.timeEnd("Beatmap init");
            console.time("Beatmap draw");
            this.processedBeatmap.draw();
            console.timeEnd("Beatmap draw");
        }
        async start() {
            let audioBuffer = await this.getSongAudioBuffer();
            let gainNode = audioCtx.createGain();
            gainNode.gain.setValueAtTime(0.05, 0);
            gainNode.connect(audioCtx.destination);
            let sourceNode = audioCtx.createBufferSource();
            sourceNode.buffer = audioBuffer;
            sourceNode.playbackRate.value = playbackRate;
            sourceNode.connect(gainNode);
            this.audioStartTime = audioCtx.currentTime;
            this.audioOffset = audioOffset;
            sourceNode.start(0, audioOffset / 1000);
            this.render();
        }
        getSongAudioBuffer() {
            let songFile = files.find((file) => file.name === this.processedBeatmap.beatmap.audioFilename);
            return new Promise((resolve) => {
                let reader = new FileReader();
                reader.onload = (result) => {
                    let arrayBuffer = reader.result;
                    audioCtx.decodeAudioData(arrayBuffer, (buffer) => {
                        resolve(buffer);
                    });
                };
                reader.readAsArrayBuffer(songFile);
            });
        }
        render() {
            //console.time("Render");
            let currentTime = this.getCurrentSongTime();
            for (let id in this.onscreenObjects) {
                let hitObject = this.onscreenObjects[id];
                hitObject.update(currentTime);
                if (hitObject.constructor === DrawableCircle) {
                    if (currentTime >= hitObject.hitObject.time) {
                        hitObject.remove();
                        delete this.onscreenObjects[id];
                    }
                }
                else if (hitObject.constructor === DrawableSlider) {
                    if (currentTime >= hitObject.endTime) {
                        hitObject.remove();
                        delete this.onscreenObjects[id];
                    }
                }
            }
            let hitObject = this.processedBeatmap.hitObjects[this.currentHitObjectId];
            while (hitObject && currentTime >= hitObject.hitObject.time - this.ARMs) {
                this.onscreenObjects[this.currentHitObjectId] = hitObject;
                hitObject.show(currentTime);
                hitObject = this.processedBeatmap.hitObjects[++this.currentHitObjectId];
            }
            renderer.render(stage);
            requestAnimationFrame(this.render.bind(this));
            // console.timeEnd("Render");
        }
        getCurrentSongTime() {
            return (audioCtx.currentTime - this.audioStartTime) * 1000 * playbackRate + this.audioOffset;
        }
    }
    let currentPlay = null;
    let playbackRate = 1;
    const audioOffset = 0;
    playButton.addEventListener('click', startPlay);
    function startPlay() {
        audioCtx.resume();
        beatmapFileSelect.style.display = playButton.style.display = 'none';
        gameState.currentPlay = currentPlay = new Play(beatmap);
        currentPlay.init();
        currentPlay.start();
    }
    class ProcessedBeatmap {
        constructor(beatmap) {
            this.beatmap = beatmap;
            this.hitObjects = [];
        }
        init() {
            this.generateHitObjects();
        }
        generateHitObjects() {
            let hitObjectId = 0;
            let comboCount = 1;
            let nextCombo = 0;
            let currentTimingPoint = 1;
            let currentMsPerBeat = this.beatmap.timingPoints[0].msPerBeat;
            let currentMsPerBeatMultiplier = 100;
            let currentSampleSet = this.beatmap.timingPoints[0].sampleSet;
            let currentVolume = this.beatmap.timingPoints[0].volume;
            for (let i = 0; i < this.beatmap.hitObjects.length; i++) {
                let rawHitObject = this.beatmap.hitObjects[i];
                let comboInfo = null;
                if (rawHitObject.newCombo !== null) {
                    if (rawHitObject.newCombo === -1) {
                        nextCombo++;
                    }
                    else {
                        nextCombo += rawHitObject.newCombo + 1;
                    }
                    comboCount = 1;
                }
                comboInfo = {
                    comboNum: nextCombo,
                    n: comboCount++,
                    isLast: (this.beatmap.hitObjects[i + 1]) ? this.beatmap.hitObjects[i + 1].newCombo !== null : true
                };
                if (currentTimingPoint < this.beatmap.timingPoints.length) {
                    while (this.beatmap.timingPoints[currentTimingPoint].offset <= rawHitObject.time) {
                        let timingPoint = this.beatmap.timingPoints[currentTimingPoint];
                        if (timingPoint.inherited) {
                            // TODO: is there a a lower limit?
                            currentMsPerBeatMultiplier = Math.min(1000, -timingPoint.msPerBeat);
                        }
                        else {
                            currentMsPerBeatMultiplier = 100;
                            currentMsPerBeat = timingPoint.msPerBeat;
                        }
                        currentSampleSet = timingPoint.sampleSet;
                        currentVolume = timingPoint.volume;
                        currentTimingPoint++;
                        if (currentTimingPoint === this.beatmap.timingPoints.length) {
                            break;
                        }
                    }
                }
                let newObject = null;
                if (rawHitObject.constructor === Circle) {
                    newObject = new DrawableCircle(rawHitObject);
                }
                else if (rawHitObject.constructor === Slider) {
                    newObject = new DrawableSlider(rawHitObject);
                    let timingInfo = {
                        msPerBeat: currentMsPerBeat,
                        msPerBeatMultiplier: currentMsPerBeatMultiplier,
                        sliderVelocity: 100 * this.beatmap.difficulty.SV * (100 / currentMsPerBeatMultiplier) / (currentMsPerBeat)
                    };
                    newObject.endTime = rawHitObject.time + rawHitObject.repeat * rawHitObject.length / timingInfo.sliderVelocity;
                    newObject.timingInfo = timingInfo;
                }
                if (newObject !== null) {
                    newObject.id = hitObjectId;
                    newObject.comboInfo = comboInfo;
                    //if (fullCalc) {
                    //    newObject.comboInfo = comboInfo;
                    //    newObject.hitSoundInfo = hitSoundInfo;
                    //}
                    this.hitObjects.push(newObject);
                }
                hitObjectId++;
            }
        }
        draw() {
            for (let i = 0; i < this.hitObjects.length; i++) {
                this.hitObjects[i].draw();
            }
        }
    }
    let renderer = new PIXI.WebGLRenderer({
        width: window.innerWidth,
        height: window.innerHeight,
        view: mainCanvas,
        transparent: true
    });
    let stage = new PIXI.Container();
    let mainHitObjectContainer = new PIXI.Container();
    let approachCircleContainer = new PIXI.Container();
    stage.addChild(mainHitObjectContainer);
    stage.addChild(approachCircleContainer);
    let texture = PIXI.Texture.fromImage("./assets/images/circle.png");
    let approachCircleTexture = PIXI.Texture.fromImage("./assets/images/approach_circle.png");
    function onResize() {
        let width = window.innerWidth, height = window.innerHeight;
        mainCanvas.setAttribute('width', String(width));
        mainCanvas.setAttribute('height', String(height));
        renderer.resize(width, height);
    }
    onResize();
    window.addEventListener('resize', onResize);
    class DrawableCircle {
        constructor(hitObject) {
            this.id = 0;
            this.comboInfo = {};
            this.hitObject = hitObject;
            this.container = new PIXI.Container();
            this.sprite = null;
            this.approachCircle = null;
        }
        draw() {
            let canvas = document.createElement('canvas');
            canvas.setAttribute('width', String(currentPlay.circleDiameter));
            canvas.setAttribute('height', String(currentPlay.circleDiameter));
            let ctx = canvas.getContext('2d');
            drawCircle(ctx, 0, 0, this.comboInfo);
            this.sprite = new PIXI.Sprite(PIXI.Texture.fromCanvas(canvas));
            this.sprite.width = currentPlay.circleDiameter;
            this.sprite.height = currentPlay.circleDiameter;
            this.approachCircle = new PIXI.Sprite(approachCircleTexture);
            this.approachCircle.width = currentPlay.circleDiameter;
            this.approachCircle.height = currentPlay.circleDiameter;
        }
        show(currentTime) {
            this.container.addChild(this.sprite);
            mainHitObjectContainer.addChildAt(this.container, 0);
            approachCircleContainer.addChild(this.approachCircle);
            this.update(currentTime);
        }
        update(currentTime) {
            let yes = (currentTime - (this.hitObject.time - gameState.currentPlay.ARMs)) / gameState.currentPlay.ARMs;
            yes = MathUtil.clamp(yes, 0, 1);
            yes = MathUtil.ease('easeOutQuad', yes);
            //let fadeInCompletion = MathUtil.clamp(1 - ((this.hitObject.time - currentPlay!.ARMs/2) - currentTime) / 300, 0, 1);
            let fadeInCompletion = yes;
            this.container.alpha = fadeInCompletion;
            this.approachCircle.alpha = fadeInCompletion;
            this.container.x = window.innerWidth / 2 + (this.hitObject.x - playfieldDimensions.width / 2) * currentPlay.pixelRatio - currentPlay.circleDiameter / 2;
            this.container.y = window.innerHeight / 2 + (this.hitObject.y - playfieldDimensions.height / 2) * currentPlay.pixelRatio - currentPlay.circleDiameter / 2;
            let approachCircleCompletion = MathUtil.clamp((this.hitObject.time - currentTime) / currentPlay.ARMs, 0, 1);
            let approachCircleFactor = 3 * (approachCircleCompletion) + 1;
            let approachCircleDiameter = currentPlay.circleDiameter * approachCircleFactor;
            this.approachCircle.width = this.approachCircle.height = approachCircleDiameter;
            this.approachCircle.x = window.innerWidth / 2 + (this.hitObject.x - playfieldDimensions.width / 2) * currentPlay.pixelRatio - approachCircleDiameter / 2;
            this.approachCircle.y = window.innerHeight / 2 + (this.hitObject.y - playfieldDimensions.height / 2) * currentPlay.pixelRatio - approachCircleDiameter / 2;
        }
        remove() {
            mainHitObjectContainer.removeChild(this.container);
            approachCircleContainer.removeChild(this.approachCircle);
        }
    }
    const CIRCLE_BORDER_WIDTH = 1.75 / 16;
    function drawCircle(context, x, y, comboInfo) {
        let colourArray = currentPlay.processedBeatmap.beatmap.colours;
        let colour = colourArray[comboInfo.comboNum % colourArray.length];
        //let colour = {r: 255, g: 20, b: 20};
        {
            context.beginPath(); // Draw circle base (will become border)
            context.arc(x + currentPlay.circleDiameter / 2, y + currentPlay.circleDiameter / 2, currentPlay.circleDiameter / 2, 0, Math.PI * 2);
            context.fillStyle = "white";
            context.fill();
            let colourString = "rgb(" + Math.round(colour.r * 0.68) + "," + Math.round(colour.g * 0.68) + "," + Math.round(colour.b * 0.68) + ")";
            let darkColourString = "rgb(" + Math.round(colour.r * 0.2) + "," + Math.round(colour.g * 0.2) + "," + Math.round(colour.b * 0.2) + ")";
            let radialGradient = context.createRadialGradient(x + currentPlay.circleDiameter / 2, y + currentPlay.circleDiameter / 2, 0, x + currentPlay.circleDiameter / 2, y + currentPlay.circleDiameter / 2, currentPlay.circleDiameter / 2);
            radialGradient.addColorStop(0, colourString);
            radialGradient.addColorStop(1, darkColourString);
            context.beginPath(); // Draw circle body with radial gradient
            context.arc(x + currentPlay.circleDiameter / 2, y + currentPlay.circleDiameter / 2, (currentPlay.circleDiameter / 2) * (1 - CIRCLE_BORDER_WIDTH), 0, Math.PI * 2);
            context.fillStyle = radialGradient;
            context.fill();
            context.fillStyle = "rgba(255, 255, 255, 0.5)";
            context.globalCompositeOperation = "destination-out"; // Transparency
            context.fill();
        }
        context.globalCompositeOperation = "source-over";
        {
            {
                context.beginPath();
                context.arc(x + currentPlay.circleDiameter / 2, y + currentPlay.circleDiameter / 2, currentPlay.circleDiameter / 2 * 0.25, 0, Math.PI * 2);
                context.fillStyle = "white";
                context.fill();
            }
        }
    }
    function getCoordFromCoordArray(arr, percent) {
        let actualIdx = percent * (arr.length - 1);
        let lowerIdx = Math.floor(actualIdx), upperIdx = Math.ceil(actualIdx);
        let lowerPos = arr[lowerIdx];
        let upperPos = arr[upperIdx];
        return {
            x: lowerPos.x * (1 - (actualIdx - lowerIdx)) + upperPos.x * (actualIdx - lowerIdx),
            y: lowerPos.y * (1 - (actualIdx - lowerIdx)) + upperPos.y * (actualIdx - lowerIdx)
        };
    }

}());
