import { BeatmapDifficulty } from "./beatmap_difficulty";
import { BeatmapSet } from "./beatmap_set";
import { Color } from "../util/graphics_util";
import { HitObject } from "./hit_object";
import { Point } from "../util/point";
import { last, createSearchableString } from "../util/misc_util";

export interface TimingPoint {
	/** The how-manyth timing point this is. */
	index: number,
	/** When the timing point begins, in milliseconds. */
	offset: number,
	/** The milliseconds per beat. On more detail about what different values mean, check the parser. */
	msPerBeat: number,
	/** The BPM of this timing points (concluded from milliseconds per beat) */
	bpm: number,
	/** The number of beats in one musical bar. */
	meter: number,
	/** The sample set to use. */
	sampleSet: number,
	/** The sample index to use. */
	sampleIndex: number,
	/** The volume to play hit sounds at. */
	volume: number,
	/** Whether or not this is an inheritable timing point. */
	inheritable: boolean,
	/** This is a bitfield containing certain flags. Bit 0 is kiai! */
	effects: number,
	/** The beatmap this timing point belongs to. */
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

	constructor(beatmapSet: BeatmapSet) {
		this.beatmapSet = beatmapSet;
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