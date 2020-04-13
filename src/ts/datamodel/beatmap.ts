import { Slider } from "./slider";
import { Circle } from "./circle";
import { BeatmapDifficulty } from "./beatmap_difficulty";
import { BeatmapSet } from "./beatmap_set";
import { Color, parseColor } from "../util/graphics_util";
import { HitObject } from "./hit_object";
import { Point } from "../util/point";
import { Spinner } from "./spinner";
import { last, unholeArray, createSearchableString, removeSurroundingDoubleQuotes } from "../util/misc_util";

const DEFAULT_TIMING_POINT_METER = 4;
const DEFAULT_TIMING_POINT_SAMPLE_SET = 1;
const DEFAULT_TIMING_POINT_SAMPLE_INDEX = 1;
const DEFAULT_TIMING_POINT_VOLUME = 100;
const DEFAULT_TIMING_POINT_INHERITABLE = true;
const DEFAULT_TIMING_POINT_EFFECTS = 0;

interface BeatmapCreationOptions {
	text: string;
	beatmapSet: BeatmapSet;
	metadataOnly: boolean;
}

export interface TimingPoint {
	index: number,
	offset: number,
	msPerBeat: number,
	bpm: number,
	meter: number,
	sampleSet: number,
	sampleIndex: number,
	volume: number,
	inheritable: boolean,
	effects: number,
	beatmap: Beatmap
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

enum BeatmapCountdown {
	None,
	Normal,
	Half,
	Double
}

function sampleSetStringToNumber(str: 'Normal' | 'Soft' | 'Drum') {
	if (str === 'Normal') return 1;
	if (str === 'Soft') return 2;
	return 3;
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
	public approachRateFound: boolean = false;
	public eventsString: string = "[Events]\n";
	
	// General // 

	/** Location of the audio file relative to the current folder */
	public audioFilename: string = null;
	/** Milliseconds of silence before the audio starts playing */
	public audioLeadIn: number = 0;
	/** Time in milliseconds when the audio preview should start */
	public previewTime: number = -1;
	/** Speed of the countdown before the first hit object */
	public countdown: BeatmapCountdown = BeatmapCountdown.Normal;
	/** Sample set that will be used if timing points do not override it (1 = Normal, 2 = Soft, 3 = Drum) */
	public sampleSet: number = 1;
	/** Game mode (0 = osu!, 1 = osu!taiko, 2 = osu!catch, 3 = osu!mania) */
	public mode: number = 0;
	/** Whether or not breaks have a letterboxing effect */
	public letterBoxInBreaks: boolean = false;
	/** Whether or not the storyboard can use the user's skin images */
	public useSkinSprites: boolean = false;
	/** Draw order of hit circle overlays compared to hit numbers (NoChange = use skin setting, Below = draw overlays under numbers, Above = draw overlays on top of numbers) */
	public overlayPosition: 'NoChange' | 'Below' | 'Above' = 'NoChange';
	/** Preferred skin to use during gameplay */
	public skinPreference: String = null;
	/** Whether or not a warning about flashing colours should be shown at the beginning of the map */
	public epilepsyWarning: boolean = false;
	/** Time in beats that the countdown starts before the first hit object */
	public countdownOffset: number = 0;
	/** Whether or not the "N+1" style key layout is used for osu!mania */
	public specialStyle: boolean = false;
	/** Whether or not the storyboard allows widescreen viewing */
	public widescreenStoryboard: boolean = false;
	/** Whether or not sound samples will change rate when playing with speed-changing mods */
	public samplesMatchPlaybackRate: boolean = false;

	// Metadata //

	/** Romanised song title */
	public title: string = null;
	/** Song title */
	public titleUnicode: string = null;
	/** Romanised song artist */
	public artist: string = null;
	/** Song artist */
	public artistUnicode: string = null;
	/** Beatmap creator */
	public creator: string = null;
	/** Difficulty name */
	public version: string = '';
	/** Original media the song was produced for */
	public source: string = null;
	/** Search terms */
	public tags: string = null;
	/** Beatmap ID */
	public beatmapID: number = null;
	/** Beatmapset ID */
	public beatmapSetID: number = null;

	constructor(options: BeatmapCreationOptions) {
		this.beatmapSet = options.beatmapSet;
		this.difficulty = new BeatmapDifficulty();
		this.metadataOnly = options.metadataOnly;

		this.parseBeatmap(options.text);
	}

	getAudioFile() {
		return this.beatmapSet.directory.getFileByPath(this.audioFilename);
	}

	getBackgroundImageName() {
		for (let evt of this.events) {
			if (evt.type === BeatmapEventType.Background) {
				return (evt as BeatmapEventBackground).file;
			}
		}

		return null;
	}

	getBackgroundVideoName() {
		for (let evt of this.events) {
			if (evt.type === BeatmapEventType.Video) {
				return (evt as BeatmapEventVideo).file;
			}
		}

		return null;
	}

	getBackgroundImageFile() {
		let filename = this.getBackgroundImageName();
		return this.beatmapSet.directory.getFileByPath(filename);
	}

	getBackgroundVideoFile() {
		let filename = this.getBackgroundVideoName();
		return this.beatmapSet.directory.getFileByPath(filename);
	}

	getAudioPreviewTimeInSeconds() {
		if (this.previewTime === -1) return 0;
		return this.previewTime / 1000;
	}

	private parseBeatmap(text: string) {
		let lines = text.split('\n');
		let section = "header";

		for (let i = 0; i < lines.length; i++) {
			let untrimmedLine = lines[i];
			let line = untrimmedLine.trim();

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
				this.parseEvent(line);
				if (!this.metadataOnly) this.eventsString += untrimmedLine + '\n';
			} else if (section === "hitobjects") {
				if (!this.metadataOnly) this.parseHitObject(line);
			} else {
				let split = line.split(':');
				if (split[1] === undefined) continue;
				let value = split[1].trim();

				// General
				     if (line.startsWith("AudioFilename")) this.audioFilename = value;
				else if (line.startsWith("AudioLeadIn")) this.audioLeadIn = parseInt(value);
				else if (line.startsWith("PreviewTime")) this.previewTime = parseInt(value);
				else if (line.startsWith("Countdown")) this.countdown = parseInt(value);
				else if (line.startsWith("SampleSet")) this.sampleSet = ['Normal', 'Soft', 'Drum'].indexOf(value) + 1; // hacky ;)
				else if (line.startsWith("StackLeniency")) this.difficulty.SL = parseFloat(value);
				else if (line.startsWith("Mode")) this.mode = parseInt(value);
				else if (line.startsWith("LetterboxInBreaks")) this.letterBoxInBreaks = value === "1";
				else if (line.startsWith("UseSkinSprites")) this.useSkinSprites = value === "1";
				else if (line.startsWith("OverlayPosition")) this.overlayPosition = value as any;
				else if (line.startsWith("SkinPreference")) this.skinPreference = value;
				else if (line.startsWith("EpilepsyWarning")) this.epilepsyWarning = value === "1";
				else if (line.startsWith("CountdownOffset")) this.countdownOffset = parseInt(value);
				else if (line.startsWith("SpecialStyle")) this.specialStyle = value === "1";
				else if (line.startsWith("WidescreenStoryboard")) this.widescreenStoryboard = value === "1";
				else if (line.startsWith("SamplesMatchPlaybackRate")) this.samplesMatchPlaybackRate = value === "1";

				// Metadata
				else if (line.startsWith("Title:")) this.title = value;
				else if (line.startsWith("TitleUnicode")) this.titleUnicode = value;
				else if (line.startsWith("Artist:")) this.artist = value;
				else if (line.startsWith("ArtistUnicode")) this.artistUnicode = value;
				else if (line.startsWith("Creator")) this.creator = value;
				else if (line.startsWith("Version")) this.version = value;
				else if (line.startsWith("Source")) this.source = value;
				else if (line.startsWith("Tags")) this.tags = value;
				else if (line.startsWith("BeatmapID")) this.beatmapID = parseInt(value);
				else if (line.startsWith("BeatmapSetID")) this.beatmapSetID = parseInt(value);

				// Difficulty
				else if (line.startsWith("HPDrainRate")) this.difficulty.HP = parseFloat(value);
				else if (line.startsWith("CircleSize")) this.difficulty.CS = parseFloat(value);
				else if (line.startsWith("OverallDifficulty")) this.difficulty.OD = parseFloat(value);
				else if (line.startsWith("ApproachRate")) {this.difficulty.AR = parseFloat(value); this.approachRateFound = true;}
				else if (line.startsWith("SliderMultiplier")) this.difficulty.SV = parseFloat(value);
				else if (line.startsWith("SliderTickRate")) this.difficulty.TR = parseInt(value); // TR is always an integer value
			}
		}

		if (!this.approachRateFound) this.difficulty.AR = this.difficulty.OD;

		// Sicne the beatmap colors could be given in arbitrary order, including skipping over a color, like Combo1 -> Combo3, we have to remove all holes in the array
		unholeArray(this.colors.comboColors);

		// These arrays are not guaranteed to be in-order in the file, so we sort 'em:
		this.events.sort((a, b) => a.time - b.time);
		this.hitObjects.sort((a, b) => a.time - b.time);
		this.timingPoints.sort((a, b) => a.offset - b.offset);
		
		// Calculate BPM
		if (this.timingPoints.length > 0) {
			let min = Infinity;
			let max = -Infinity;

			for (let i = 0; i < this.timingPoints.length; i++) {
				let timingPoint = this.timingPoints[i];
				if (!timingPoint.inheritable) continue;

				min = Math.min(min, timingPoint.bpm);
				max = Math.max(max, timingPoint.bpm);
			}

			this.bpmMin = min;
			this.bpmMax = max;
		}
	}

	private parseColor(line: string) {
		let parts = line.split(':');
		let property = parts[0];
		let colStrings = parts[1].trim().split(',');
		let color = parseColor(colStrings, 0);
		
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
		// if (this.timingPoints.length === 0) offset = 0; // Disabled for now. Wasn't needed and messed with some BPM stuff.

		let msPerBeat = parseFloat(values[1]);

		let timingPoint: TimingPoint = {
			index: this.timingPoints.length,
			offset: offset,
			msPerBeat: msPerBeat,
			bpm: msPerBeat > 0 ? 60000 / msPerBeat : -1,
			meter: values[2]? parseInt(values[2]) : DEFAULT_TIMING_POINT_METER,
			sampleSet: values[3]? parseInt(values[3]) : DEFAULT_TIMING_POINT_SAMPLE_SET,
			sampleIndex: values[4]? parseInt(values[4]) : DEFAULT_TIMING_POINT_SAMPLE_INDEX,
			volume: values[5]? parseInt(values[5]) : DEFAULT_TIMING_POINT_VOLUME,
			inheritable: values[6]? values[6] === "1" : DEFAULT_TIMING_POINT_INHERITABLE, // "Inherited (Boolean: 0 or 1) tells if the timing point can be inherited from.". Kind of a misleading name, right, ppy?
			effects: values[7]? parseInt(values[7]) : DEFAULT_TIMING_POINT_EFFECTS,
			beatmap: this
		};
		this.timingPoints.push(timingPoint);
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
					file: removeSurroundingDoubleQuotes(values[2]),
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
					file: removeSurroundingDoubleQuotes(values[2]),
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

	getSearchableString() {
		return createSearchableString([this.title, this.titleUnicode, this.artist, this.artistUnicode, this.creator, this.version, this.tags]);
	}
}