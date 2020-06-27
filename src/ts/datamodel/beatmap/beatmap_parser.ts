import { BeatmapSet } from "./beatmap_set";
import { Beatmap, TimingPoint, BeatmapEventBackground, BeatmapEventType, BeatmapEventVideo, BeatmapEventBreak } from "./beatmap";
import { BeatmapDifficulty } from "./beatmap_difficulty";
import { unholeArray, removeSurroundingDoubleQuotes } from "../../util/misc_util";
import { parseColor, colorToHexNumber } from "../../util/graphics_util";
import { Slider, Sampling, SliderType, SliderCurveSection } from "../hit_objects/slider";
import { Spinner } from "../hit_objects/spinner";
import { PLAYFIELD_DIMENSIONS } from "../../util/constants";
import { HitObject } from "../hit_objects/hit_object";
import { pointsAreEqual, Point } from "../../util/point";
import { Circle } from "../hit_objects/circle";

const DEFAULT_TIMING_POINT_METER = 4;
const DEFAULT_TIMING_POINT_SAMPLE_SET = 1;
const DEFAULT_TIMING_POINT_SAMPLE_INDEX = 1;
const DEFAULT_TIMING_POINT_VOLUME = 100;
const DEFAULT_TIMING_POINT_INHERITABLE = true;
const DEFAULT_TIMING_POINT_EFFECTS = 0;

export namespace BeatmapParser {
	/** Parses a .osu text file and creates a Beatmap instance.
	 * @param metadataOnly If this is set to true, non-metadata stuff (like timing points, hit objects, etc.) won't be parsed. */
	export function parse(text: string, beatmapSet: BeatmapSet, metadataOnly: boolean) {
		let beatmap = new Beatmap(beatmapSet);
		beatmap.difficulty = new BeatmapDifficulty();
		beatmap.metadataOnly = metadataOnly;

		// Since we won't parse hit objects anyway, and they're usually at the end of the file, we can shorten the string so that we have less lines to iterate over.
		if (metadataOnly) text = text.slice(0, text.indexOf("[HitObjects]"));

		let lines = text.split('\n');

		/** The current section we're in */
		let section = "header";
		/** If there is no approach rate in the file, use the OD value. */
		let approachRateFound = false;

		for (let i = 0; i < lines.length; i++) {
			let untrimmedLine = lines[i];
			let line = untrimmedLine.trim();

			if (line === "" || line.startsWith("//")) continue;
			if (line.startsWith("osu file format v")) {
				//
			} else if (line.startsWith("[") && line.endsWith("]")) {
				// New section!
				section = line.substr(1, line.length-2).toLowerCase();
			} else if (section === "colours") {
				// I find the British (Australian) to American English conversion that happens here kinda funny, haha
				if (!metadataOnly) parseColorLine(beatmap, line);
			} else if (section === "timingpoints") {
				if (!metadataOnly) parseTimingPoint(beatmap, line);
			} else if (section === "events") {
				parseEvent(beatmap, line);
				if (!metadataOnly) beatmap.eventsString += untrimmedLine + '\n';
			} else if (section === "hitobjects") {
				if (metadataOnly) break; // We can safely assume that by the time we've hit the [HitPoints] portion, we can safely stop parsing the rest of the file (if we're only looking for metadata)
				if (!metadataOnly) parseHitObject(beatmap, line);
			} else {
				let colonIndex = line.indexOf(':');
				if (colonIndex === -1) return;
				let value = line.slice(colonIndex + 1).trim();

				// General
				     if (line.startsWith("AudioFilename")) beatmap.audioFilename = value;
				else if (line.startsWith("AudioLeadIn")) beatmap.audioLeadIn = parseFloat(value);
				else if (line.startsWith("PreviewTime")) beatmap.previewTime = parseFloat(value);
				else if (line.startsWith("Countdown")) beatmap.countdown = parseInt(value);
				else if (line.startsWith("SampleSet")) beatmap.sampleSet = ['Normal', 'Soft', 'Drum'].indexOf(value) + 1; // hacky ;)
				else if (line.startsWith("StackLeniency")) beatmap.difficulty.SL = parseFloat(value);
				else if (line.startsWith("Mode")) beatmap.mode = parseInt(value);
				else if (line.startsWith("LetterboxInBreaks")) beatmap.letterBoxInBreaks = value === "1";
				else if (line.startsWith("UseSkinSprites")) beatmap.useSkinSprites = value === "1";
				else if (line.startsWith("OverlayPosition")) beatmap.overlayPosition = value as any;
				else if (line.startsWith("SkinPreference")) beatmap.skinPreference = value;
				else if (line.startsWith("EpilepsyWarning")) beatmap.epilepsyWarning = value === "1";
				else if (line.startsWith("CountdownOffset")) beatmap.countdownOffset = parseInt(value);
				else if (line.startsWith("SpecialStyle")) beatmap.specialStyle = value === "1";
				else if (line.startsWith("WidescreenStoryboard")) beatmap.widescreenStoryboard = value === "1";
				else if (line.startsWith("SamplesMatchPlaybackRate")) beatmap.samplesMatchPlaybackRate = value === "1";

				// Metadata
				else if (line.startsWith("Title:")) beatmap.title = value;
				else if (line.startsWith("TitleUnicode")) beatmap.titleUnicode = value;
				else if (line.startsWith("Artist:")) beatmap.artist = value;
				else if (line.startsWith("ArtistUnicode")) beatmap.artistUnicode = value;
				else if (line.startsWith("Creator")) beatmap.creator = value;
				else if (line.startsWith("Version")) beatmap.version = value;
				else if (line.startsWith("Source")) beatmap.source = value;
				else if (line.startsWith("Tags")) beatmap.tags = value;
				else if (line.startsWith("BeatmapID")) beatmap.beatmapID = parseInt(value);
				else if (line.startsWith("BeatmapSetID")) beatmap.beatmapSetID = parseInt(value);

				// Difficulty
				else if (line.startsWith("HPDrainRate")) beatmap.difficulty.HP = parseFloat(value);
				else if (line.startsWith("CircleSize")) beatmap.difficulty.CS = parseFloat(value);
				else if (line.startsWith("OverallDifficulty")) beatmap.difficulty.OD = parseFloat(value);
				else if (line.startsWith("ApproachRate")) {beatmap.difficulty.AR = parseFloat(value); approachRateFound = true;}
				else if (line.startsWith("SliderMultiplier")) beatmap.difficulty.SV = parseFloat(value);
				else if (line.startsWith("SliderTickRate")) beatmap.difficulty.TR = parseInt(value); // TR is always an integer value
			}
		}

		if (!approachRateFound) beatmap.difficulty.AR = beatmap.difficulty.OD;

		// Since the beatmap colors could be given in arbitrary order, including skipping over a color, like Combo1 -> Combo3, we have to remove all holes in the array
		unholeArray(beatmap.colors.comboColors);

		// These arrays are not guaranteed to be in-order in the file, so we sort 'em:
		beatmap.events.sort((a, b) => a.time - b.time);
		beatmap.hitObjects.sort((a, b) => a.time - b.time);
		beatmap.timingPoints.sort((a, b) => a.offset - b.offset);
		
		// Calculate BPM
		if (beatmap.timingPoints.length > 0) {
			let min = Infinity;
			let max = -Infinity;

			for (let i = 0; i < beatmap.timingPoints.length; i++) {
				let timingPoint = beatmap.timingPoints[i];
				if (!timingPoint.inheritable) continue;

				min = Math.min(min, timingPoint.bpm);
				max = Math.max(max, timingPoint.bpm);
			}

			beatmap.bpmMin = min;
			beatmap.bpmMax = max;
		}

		// Make sure crucial metadata exists
		if (beatmap.title == null) throw new Error("No beatmap title found.");
		if (beatmap.artist == null) throw new Error("No beatmap artist found.");
		if (beatmap.creator == null) throw new Error("No beatmap creator found.");
		if (beatmap.version == null) throw new Error("No beatmap version string found.");

		return beatmap;
	}

	function parseColorLine(beatmap: Beatmap, line: string) {
		let colonIndex = line.indexOf(':');
		let property = line.slice(0, colonIndex);
		let colStrings = line.slice(colonIndex + 1).trim().split(',');
		let color = parseColor(colStrings, 0);
		
		if (property.startsWith("Combo")) {
			let n = parseInt(property.slice(5));
			beatmap.colors.comboColors[n-1] = color; // n-1 because the first one is 'Combo1'
		} else if (property.startsWith("SliderBody")) {
			beatmap.colors.sliderBody = color;
		} else if (property.startsWith("SliderTrackOverride")) {
			beatmap.colors.sliderTrackOverride = color;
		} else if (property.startsWith("SliderBorder")) {
			beatmap.colors.sliderBorder = color;
		}
	}

	function parseTimingPoint(beatmap: Beatmap, line: string) {
		let values = line.split(',');

		let offset = parseFloat(values[0]);

		// From the osu! website:
		// 
		// The offset is an integral number of milliseconds, from the start
		// of the song. It defines when the timing point starts. A timing point
		// ends when the next one starts. The first timing point starts at 0,
		// disregarding its offset.
		// if (this.timingPoints.length === 0) offset = 0; // Disabled for now. Wasn't needed and messed with some BPM stuff.

		let msPerBeat = parseFloat(values[1]);

		let timingPoint: TimingPoint = {
			index: beatmap.timingPoints.length,
			offset: offset,
			msPerBeat: msPerBeat,
			bpm: msPerBeat > 0 ? 60000 / msPerBeat : -1,
			meter: values[2]? parseInt(values[2]) : DEFAULT_TIMING_POINT_METER,
			sampleSet: values[3]? parseInt(values[3]) : DEFAULT_TIMING_POINT_SAMPLE_SET,
			sampleIndex: values[4]? parseInt(values[4]) : DEFAULT_TIMING_POINT_SAMPLE_INDEX,
			volume: values[5]? parseFloat(values[5]) : DEFAULT_TIMING_POINT_VOLUME,
			inheritable: values[6]? values[6] === "1" : DEFAULT_TIMING_POINT_INHERITABLE, // "Inherited (Boolean: 0 or 1) tells if the timing point can be inherited from.". Kind of a misleading name, right, ppy?
			effects: values[7]? parseInt(values[7]) : DEFAULT_TIMING_POINT_EFFECTS,
			beatmap: beatmap
		};
		beatmap.timingPoints.push(timingPoint);
	}

	function parseHitObject(beatmap: Beatmap, line: string) {
		let values = line.split(',');

		let hitObjectData = parseInt(values[3]);

		if ((hitObjectData & 1) !== 0) { // It's a circle if the 1 bit is set
			let circle = new Circle();
			parseCircle(circle, values);

			beatmap.hitObjects.push(circle);
			beatmap.circleCount++;
		} else if ((hitObjectData & 2) !== 0) { // It's a slider if the 2 bit is set
			let slider = new Slider();
			parseSlider(slider, values);

			beatmap.hitObjects.push(slider);
			beatmap.sliderCount++;
		} else if ((hitObjectData & 8) !== 0) { // It's a spinner if the 8 bit is set (not 4)
			let spinner = new Spinner();
			parseSpinner(spinner, values);

			beatmap.hitObjects.push(spinner);
			beatmap.spinnerCount++;
		}
	}

	function parseEvent(beatmap: Beatmap, line: string) {
		let values = line.split(',');

		switch (values[0]) {
			case "0": { // Background event
				let offsetX = parseFloat(values[3]),
					offsetY = parseFloat(values[4]);

				let event: BeatmapEventBackground = {
					type: BeatmapEventType.Background,
					time: parseFloat(values[1]),
					file: removeSurroundingDoubleQuotes(values[2]),
					offset: {x: offsetX, y: offsetY}
				};

				beatmap.events.push(event);
			}; break;
			case "1": case "Video": { // "Video may be replaced by 1." https://osu.ppy.sh/help/wiki/osu!_File_Formats/Osu_(file_format)
				let offsetX = parseFloat(values[3]),
				offsetY = parseFloat(values[4]);

				let event: BeatmapEventVideo = {
					type: BeatmapEventType.Video,
					time: parseFloat(values[1]),
					file: removeSurroundingDoubleQuotes(values[2]),
					offset: {x: offsetX, y: offsetY}
				};

				beatmap.events.push(event);
			}; break;
			case "2": case "Break": { // "The 2 lets osu! know that this is a break event. It may be replaced by Break." https://osu.ppy.sh/help/wiki/osu!_File_Formats/Osu_(file_format)
				let event: BeatmapEventBreak = {
					type: BeatmapEventType.Break,
					time: parseFloat(values[1]),
					endTime: parseFloat(values[2])
				};

				beatmap.events.push(event);
			}; break;
		}
	}

	function parseCircle(circle: Circle, data: string[]) {
		parseHitObjectBasics(circle, data);
		parseExtras(circle, data[5]);
	}

	function parseSlider(slider: Slider, data: string[]) {
		parseHitObjectBasics(slider, data);

		slider.sections = parseSections(slider, data);
		slider.repeat = parseInt(data[6]);
		slider.length = parseFloat(data[7]);

		if (data[8]) { // Parse edge hit sounds
			let values = data[8].split('|');

			for (let i = 0; i < values.length; i++) {
				slider.edgeHitSounds.push(parseInt(values[i]));
			}
		} else {
			slider.edgeHitSounds.length = slider.repeat + 1;
			slider.edgeHitSounds.fill(0); // TODO. Does this default to 0?
		}

		if (data[9]) { // Parse edge sampling sets
			let values = data[9].split('|');

			for (let i = 0; i < values.length; i++) {
				let val = values[i].split(':');

				slider.edgeSamplings.push({
					sampleSet: parseInt(val[0]),
					additionSet: parseInt(val[1])
				});
			}
		} else {
			let defaultSampling: Sampling = {
				sampleSet: 0,
				additionSet: 0
			};

			slider.edgeSamplings.length = slider.repeat + 1;
			slider.edgeSamplings.fill(defaultSampling);
		}

		parseExtras(slider, data[10]);
	}

	function parseSpinner(spinner: Spinner, data: string[]) {
		parseHitObjectBasics(spinner, data);

		spinner.x = PLAYFIELD_DIMENSIONS.width/2;
		spinner.y = PLAYFIELD_DIMENSIONS.height/2;
		spinner.endTime = parseFloat(data[5]);

		parseExtras(spinner, data[6]);
	}

	function parseHitObjectBasics(hitObject: HitObject, data: string[]) {
		hitObject.x = parseFloat(data[0]);
		hitObject.y = parseFloat(data[1]);
		hitObject.time = parseFloat(data[2]);
		hitObject.comboSkips = getComboSkipsFromHitObjectType(parseInt(data[3]));
		hitObject.hitSound = parseInt(data[4]);
	}

	function getComboSkipsFromHitObjectType(hitObjectType: number) {
		// The combo skips are encoded as a bitfield in the hit object type number.

		if ((hitObjectType & 4) === 0) {
			return 0;
		} else {
			let skips = 1;
			skips += (hitObjectType & 0b01110000) >> 4;

			return skips;
		}
	}

	function parseExtras(hitObject: HitObject, data: string) {
		if (!data) return;
	
		let values = data.split(":");

		hitObject.extras = {
			sampleSet: parseInt(values[0]),
			additionSet: parseInt(values[1]),
			customIndex: parseInt(values[2]),
			sampleVolume: parseFloat(values[3]),
			filename: values[4]
		};
	}

	function parseSections(slider: Slider, data: string[]) {
		let sliderPoints = data[5].split("|");

		let sliderType = sliderPoints[0];
		switch (sliderType) {
			case "P": slider.type = SliderType.Perfect; break;
			case "L": slider.type = SliderType.Linear; break;
			case "B": slider.type = SliderType.Bézier; break;
			case "C": slider.type = SliderType.Catmull; break;
			default:  slider.type = SliderType.Bézier; // Default to Bézier.
		}

		let sliderSections: SliderCurveSection[] = [];

		let sliderSectionPoints: Point[] = [{
			x: slider.x,
			y: slider.y
		}];

		let lastPoint = null;

		const finishSection = () => {
			if (sliderSectionPoints.length > 1) sliderSections.push({
				values: sliderSectionPoints
			});
		};

		for (let j = 1; j < sliderPoints.length; j++) {
			let coords = sliderPoints[j].split(':');

			let nextPoint: Point = {
				x: parseFloat(coords[0]),
				y: parseFloat(coords[1])
			};

			// End section if same point appears twice and start a new one if end is not reached
			if (lastPoint && pointsAreEqual(lastPoint, nextPoint)) {
				finishSection();

				// Don't make a new section in case this is the last point
				if (j + 1 !== sliderPoints.length) sliderSectionPoints = [];
			}

			sliderSectionPoints.push(nextPoint);

			if (j === sliderPoints.length-1) finishSection();

			lastPoint = nextPoint;
		}

		return sliderSections;
	}
}