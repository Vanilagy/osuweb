import { StoryboardEntitySprite, StoryboardEntity, StoryboardLayer, StoryboardOrigin, StoryboardEventType, StoryboardEvent, StoryboardEventParameter, StoryboardEventParameterValue, StoryboardEventLoop, StoryboardEventTrigger, StoryboardEntityType, StoryboardEntityAnimation, StoryboardLoopType, StoryboardEntitySample } from "./storyboard_types";
import { stringContainsOnly, shallowObjectClone, removeSurroundingDoubleQuotes, replaceAll, charIsDigit } from "../../util/misc_util";
import { EaseType } from "../../util/math_util";
import { parseColor, Color } from "../../util/graphics_util";
import { Storyboard } from "./storyboard";
import { Point, Vector2 } from "../../util/point";

export namespace StoryboardParser {
	const layerToEnum: {[name: string]: StoryboardLayer} = {
		"Background": StoryboardLayer.Background,
		"0": StoryboardLayer.Background,
		"Fail": StoryboardLayer.Fail,
		"1": StoryboardLayer.Fail,
		"Pass": StoryboardLayer.Pass,
		"2": StoryboardLayer.Pass,
		"Foreground": StoryboardLayer.Foreground,
		"3": StoryboardLayer.Foreground
	};
	const originToEnum: {[name: string]: StoryboardOrigin} = {
		"TopLeft": StoryboardOrigin.TopLeft,
		"TopCentre": StoryboardOrigin.TopCenter,
		"TopRight": StoryboardOrigin.TopRight,
		"CentreLeft": StoryboardOrigin.CenterLeft,
		"Centre": StoryboardOrigin.Center,
		"CentreRight": StoryboardOrigin.CenterRight,
		"BottomLeft": StoryboardOrigin.BottomLeft,
		"BottomCentre": StoryboardOrigin.BottomCenter,
		"BottomRight": StoryboardOrigin.BottomRight,
		// Origins also have number aliases, although their order is weird:
		"0": StoryboardOrigin.TopLeft,
		"1": StoryboardOrigin.Center,
		"2": StoryboardOrigin.CenterLeft,
		"3": StoryboardOrigin.TopRight,
		"4": StoryboardOrigin.BottomCenter,
		"5": StoryboardOrigin.TopCenter,
		"6": StoryboardOrigin.TopLeft, // again... sign
		"7": StoryboardOrigin.CenterRight,
		"8": StoryboardOrigin.BottomLeft,
		"9": StoryboardOrigin.BottomRight
	};
	const eventTypeToEnum: {[name: string]: StoryboardEventType} = {
		"F": StoryboardEventType.Fade,
		"M": StoryboardEventType.Move,
		"MX": StoryboardEventType.MoveX,
		"MY": StoryboardEventType.MoveY,
		"S": StoryboardEventType.Scale,
		"V": StoryboardEventType.VectorScale,
		"R": StoryboardEventType.Rotate,
		"C": StoryboardEventType.Color,
		"L": StoryboardEventType.Loop,
		"T": StoryboardEventType.Trigger,
		"P": StoryboardEventType.Parameter
	};
	const eventEasingToEnum: {[number: string]: EaseType} = {
		"0": EaseType.Linear,
		"1": EaseType.EaseOutQuad,
		"2": EaseType.EaseInQuad,
		"3": EaseType.EaseInQuad,
		"4": EaseType.EaseOutQuad,
		"5": EaseType.EaseInOutQuad,
		"6": EaseType.EaseInCubic,
		"7": EaseType.EaseOutCubic,
		"8": EaseType.EaseInOutCubic,
		"9": EaseType.EaseInQuart,
		"10": EaseType.EaseOutQuart,
		"11": EaseType.EaseInOutQuart,
		"12": EaseType.EaseInQuint,
		"13": EaseType.EaseOutQuint,
		"14": EaseType.EaseInOutQuint,
		"15": EaseType.EaseInSine,
		"16": EaseType.EaseOutSine,
		"17": EaseType.EaseInOutSine,
		"18": EaseType.EaseInExpo,
		"19": EaseType.EaseOutExpo,
		"20": EaseType.EaseInOutExpo,
		"21": EaseType.EaseInCirc,
		"22": EaseType.EaseOutCirc,
		"23": EaseType.EaseInOutCirc,
		"24": EaseType.EaseInElasticAlternative,
		"25": EaseType.EaseOutElasticAlternative,
		"26": EaseType.EaseOutElasticHalf,
		"27": EaseType.EaseOutElasticQuarter,
		"28": EaseType.EaseInOutElasticAlternative,
		"29": EaseType.EaseInBack,
		"30": EaseType.EaseOutBack,
		"31": EaseType.EaseInOutBack,
		"32": EaseType.EaseInBounce,
		"33": EaseType.EaseOutBounce,
		"34": EaseType.EaseInOutBounce
	};

	/** Does a text preprocessing pass by replacing all occurrences of variables specified in [Variables] with the variable value. */
	export function preprocessText(text: string) {
		// First, we split the text into the part before "[Events]" and the part after, because there might be variable declarations that we need to handle before moving on.
		let eventsIndex = text.indexOf("[Events]");
		let preEventsString = text.slice(0, eventsIndex);
		let postEventsString = text.slice(eventsIndex);
		let currentSection: "variables" | "events";
		let variables: {[varName: string]: string} = {};
		let preEventsLines = preEventsString.split("\n");

		for (let i = 0; i < preEventsLines.length; i++) {
			let line = preEventsLines[i];
			let trimmed = line.trim();
			if (!trimmed || trimmed.startsWith("//")) preEventsLines.splice(i--, 1);

			if (trimmed.startsWith("[Variables]")) {
				currentSection = "variables";
				continue;
			}

			if (currentSection === "variables") {
				for (let varName in variables) {
					// Replace all the occurrences of currently found variables in this line
					trimmed = replaceAll(trimmed, varName, variables[varName]);
				}

				let parts = trimmed.split("=");
				if (parts.length !== 2) continue;

				let variableName = parts[0];
				let variableValue = parts[1];

				variables[variableName] = variableValue;

				// Do replacement
				postEventsString = replaceAll(postEventsString, variableName, variableValue);
			}
		}

		return postEventsString;
	}

	/** Parses an .osb file. Full specification for the file format can be found here: https://osu.ppy.sh/help/wiki/Storyboard_Scripting */
	/** @param includeSprites Whether or not to parse sprites. This is generally on, but can be turned off if one only wants the sound samples. */
	export function parse(text: string, includeSprites = true) {
		let lines = text.split("\n");
		let currentSection: "variables" | "events";

		// Remove comments and empty lines
		for (let i = 0; i < lines.length; i++) {
			let line = lines[i];
			let trimmed = line.trim();
			if (!trimmed || trimmed.startsWith("//")) lines.splice(i--, 1);
		}

		let storyboard = new Storyboard();
		let entities: StoryboardEntity[] = [];

		for (let i = 0; i < lines.length; i++) {
			let line = lines[i];

			if (currentSection !== "events" && line.startsWith("[Events]")) {
				currentSection = "events";
				continue;
			}
			if (currentSection !== "events") continue;
			if (line[0] === ' ' || line[0] === '_') continue; // We're still indented, meaning that there is no new entity to process

			let parts = line.split(",");
			let entityType = parts[0];
			let entity: StoryboardEntity;

			// Create a new entity based on the type
			if (entityType === "Sprite" || entityType === "4") {
				if (includeSprites) entity = parseSprite(parts, lines, i);
			} else if (entityType === "Animation" || entityType === "6") {
				if (includeSprites) entity = parseAnimation(parts, lines, i);
			} else if (entityType === "Sample" || entityType === "5") {
				entity = parseSample(parts);
			}

			if (entity) entities.push(entity);
		}

		storyboard.entities = entities;

		return storyboard;
	}

	function parseSprite(parts: string[], lines: string[], lineNumber: number) {
		let sprite = {} as StoryboardEntitySprite;

		sprite.type = StoryboardEntityType.Sprite;
		parseSpriteBasics(sprite, parts);
		sprite.events = parseEvents(lines, lineNumber + 1, 1);

		return sprite;
	}

	/** Just like parseSprite, but loads some extra stuff like frame count */
	function parseAnimation(parts: string[], lines: string[], lineNumber: number) {
		let animation = {} as StoryboardEntityAnimation;

		animation.type = StoryboardEntityType.Animation;
		parseSpriteBasics(animation, parts);
		animation.events = parseEvents(lines, lineNumber + 1, 1);

		animation.frameCount = parseInt(parts[6]);
		animation.frameDelay = parseFloat(parts[7]);
		animation.loopType = parts[8]? ((parts[8].startsWith("LoopOnce"))? StoryboardLoopType.LoopOnce : StoryboardLoopType.LoopForever) : StoryboardLoopType.LoopForever; // LoopForever by default

		return animation;
	}

	/** Sets data common to both regular and animated sprites. */
	function parseSpriteBasics(sprite: StoryboardEntitySprite | StoryboardEntityAnimation, parts: string[]) {
		sprite.layer = layerToEnum[parts[1]];
		sprite.origin = originToEnum[parts[2]] ?? StoryboardOrigin.TopLeft;
		sprite.filepath = removeSurroundingDoubleQuotes(parts[3].trim()); // Trim here, because we don't want filthy \r messing up the quote detection.
		sprite.position = {x: parseFloat(parts[4]), y: parseFloat(parts[5])};
	}

	function parseSample(parts: string[]) {
		let sample = {} as StoryboardEntitySample;

		sample.type = StoryboardEntityType.Sample;
		sample.time = parseFloat(parts[1]);
		sample.layer = layerToEnum[parts[2]];
		sample.filepath = removeSurroundingDoubleQuotes(parts[3].trim());
		sample.volume = parts[4]? parseFloat(parts[4]) : 100; // Volume defaults to 100

		return sample;
	}

	/** Parse all events starting in a specific line with a specific indentation. */
	function parseEvents(lines: string[], lineNumber: number, indentation: number) {
		let events: StoryboardEvent[] = [];

		for (let i = lineNumber; i < lines.length; i++) {
			let line = lines[i];
			if (!stringContainsOnly(line, [' ', '_'], 0, indentation)) break; // The indentation was broken, meaning we've completed parsing.

			let event = {} as StoryboardEvent;
			let parts = line.slice(indentation).split(",");

			event.type = eventTypeToEnum[parts[0]];

			if (event.type !== StoryboardEventType.Loop && event.type !== StoryboardEventType.Trigger) {
				// Loop and Trigger do these differently, that's why we don't run this code for them
				event.easing = eventEasingToEnum[parts[1]];
				event.startTime = parseFloat(parts[2]);
				event.endTime = parts[3]? parseFloat(parts[3]) : event.startTime;
			}

			let params = parseEventParams(event.type, parts, lines, i, indentation);
			if (params.length === 1) {
				// There was only one param found, meaning we don't need to duplicate the event
				events.push(Object.assign(event, params[0]));
			} else {
				// There were more than one parameters found, meaning the event is using the shorthand syntax for chained events. Therefore, we now need to create new events.

				let duration = event.endTime - event.startTime;

				for (let j = 0; j < params.length; j++) {
					let clone = shallowObjectClone(event);
					Object.assign(clone, params[i]);

					clone.startTime += duration * j;
					clone.endTime += duration * j;

					events.push(clone);
				}
			}
		}

		return events;
	}

	/** Parses the parameters for a specific event type. The code for most types is roughly identical, and they all handle a variable-length parameter list for support the shorthand syntax. */
	function parseEventParams(eventType: StoryboardEventType, parts: string[], lines: string[], lineNumber: number, indentation: number) {
		let params: Partial<StoryboardEvent>[] = [];

		if (eventType === StoryboardEventType.Fade) {
			let opacities: number[] = [];

			for (let i = 4; i < parts.length; i += 1) {
				opacities.push(parseFloat(parts[i]));
			}
			if (opacities.length === 1) opacities.push(opacities[0]);

			for (let i = 0; i < opacities.length-1; i++) {
				params.push({
					opacityStart: opacities[i],
					opacityEnd: opacities[i+1]
				});
			}
		} else if (eventType === StoryboardEventType.Move) {
			let points: Point[] = [];

			for (let i = 4; i < parts.length; i += 2) {
				points.push({x: parseFloat(parts[i + 0]), y: parseFloat(parts[i + 1])});
			}
			if (points.length === 1) points.push(points[0]);

			for (let i = 0; i < points.length-1; i++) {
				params.push({
					positionStart: points[i],
					positionEnd: points[i+1]
				});
			}
		} else if (eventType === StoryboardEventType.MoveX) {
			let values: number[] = [];

			for (let i = 4; i < parts.length; i += 1) {
				values.push(parseFloat(parts[i]));
			}
			if (values.length === 1) values.push(values[0]);

			for (let i = 0; i < values.length-1; i++) {
				params.push({
					xStart: values[i],
					xEnd: values[i+1]
				});
			}
		} else if (eventType === StoryboardEventType.MoveY) {
			let values: number[] = [];

			for (let i = 4; i < parts.length; i += 1) {
				values.push(parseFloat(parts[i]));
			}
			if (values.length === 1) values.push(values[0]);

			for (let i = 0; i < values.length-1; i++) {
				params.push({
					yStart: values[i],
					yEnd: values[i+1]
				});
			}
		} else if (eventType === StoryboardEventType.Scale) {
			let values: number[] = [];

			for (let i = 4; i < parts.length; i += 1) {
				values.push(parseFloat(parts[i]));
			}
			if (values.length === 1) values.push(values[0]);

			for (let i = 0; i < values.length-1; i++) {
				params.push({
					scaleStart: values[i],
					scaleEnd: values[i+1]
				});
			}
		} else if (eventType === StoryboardEventType.VectorScale) {
			let vectors: Vector2[] = [];

			for (let i = 4; i < parts.length; i += 2) {
				vectors.push({x: parseFloat(parts[i + 0]), y: parseFloat(parts[i + 1])});
			}
			if (vectors.length === 1) vectors.push(vectors[0]);

			for (let i = 0; i < vectors.length-1; i++) {
				params.push({
					scaleStart: vectors[i],
					scaleEnd: vectors[i+1]
				});
			}
		} else if (eventType === StoryboardEventType.Rotate) {
			let values: number[] = [];

			for (let i = 4; i < parts.length; i += 1) {
				values.push(parseFloat(parts[i]));
			}
			if (values.length === 1) values.push(values[0]);

			for (let i = 0; i < values.length-1; i++) {
				params.push({
					rotationStart: values[i],
					rotationEnd: values[i+1]
				});
			}
		} else if (eventType === StoryboardEventType.Color) {
			let colors: Color[] = [];

			for (let i = 4; i < parts.length; i += 3) {
				colors.push(parseColor(parts, i));
			}
			if (colors.length === 1) colors.push(colors[0]);

			for (let i = 0; i < colors.length-1; i++) {
				params.push({
					colorStart: colors[i],
					colorEnd: colors[i+1]
				});
			}
		} else if (eventType === StoryboardEventType.Parameter) {
			for (let i = 4; i < parts.length; i += 1) {
				let paramObj = {} as StoryboardEventParameter;

				paramObj.parameter = (parts[i] === "H")? StoryboardEventParameterValue.HorizontalFlip : (parts[i] === "V")? StoryboardEventParameterValue.VerticalFlip : StoryboardEventParameterValue.AdditiveColor;
	
				params.push(paramObj);
			}
		} else if (eventType === StoryboardEventType.Loop) {
			let paramObj = {} as StoryboardEventLoop;

			paramObj.startTime = parseFloat(parts[1]);
			paramObj.loopCount = parseInt(parts[2]);
			paramObj.events = parseEvents(lines, lineNumber + 1, indentation + 1); // Recursive call

			params.push(paramObj);
		} else if (eventType === StoryboardEventType.Trigger) {
			let paramObj = {} as StoryboardEventTrigger;

			paramObj.trigger = parts[1];
			paramObj.startTime = parseFloat(parts[2]);
			paramObj.endTime = parseFloat(parts[3]);
			paramObj.events = parseEvents(lines, lineNumber + 1, indentation + 1); // Recursive call
			paramObj.groupNumber = (parts[4])? parseInt(parts[4]) : 0; // Default case, meanning "no group".

			params.push(paramObj);
		}

		return params;
	}

	const possibleTokens = ["Any", "Normal", "Soft", "Drum", "Whistle", "Finish", "Clap"];
	const sampleSetTokens = ["Any", "Normal", "Soft", "Drum"];
	const additionTokens = [null, "Whistle", "Finish", "Clap"];

	/** Parses a hit sound trigger string into its components. The general format for such string is HitSound[SampleSet][AdditionsSampleSet][Addition][CustomSampleSet], and examples can be found here: https://osu.ppy.sh/help/wiki/Storyboard_Scripting/Compound_Commands */
	export function parseHitSoundTrigger(str: string) {
		let returnValue = {
			sampleSet: 0, // 0 here refers to "All", aka accepts all values
			additionSet: 0,
			addition: 0,
			sampleIndex: null as number // Here, null means "All"
		};

		let stage = 0;
		str = str.slice("HitSound".length);

		/** Gets the next token. Is either one from 'possibleTokens' or a number. */
		function getNextToken() {
			for (let i = 0; i < possibleTokens.length; i++) {
				if (str.startsWith(possibleTokens[i])) {
					str = str.slice(possibleTokens[i].length);
					return possibleTokens[i];
				}
			}

			if (charIsDigit(str[0])) {
				let int = parseInt(str);
				str = "";

				return int;
			}

			return null;
		}

		while (true) {
			let token = getNextToken();
			if (token === null) break; // We've reached the end of the string, or a token was invalid

			if (typeof token === "string") {
				if (sampleSetTokens.includes(token)) {
					let index = sampleSetTokens.indexOf(token);

					if (stage === 0) returnValue.sampleSet = index;
					else if (stage === 1) returnValue.additionSet = index;
					else console.error("Incorrect hit sound trigger string: ", str);

					stage++;
				} else {
					let index = additionTokens.indexOf(token);

					if (stage <= 2) returnValue.addition = index;
					else console.error("Incorrect hit sound trigger string: ", str);

					stage = 3;
				}
			} else {
				if (stage === 3) returnValue.sampleIndex = token;
				else console.error("Incorrect hit sound trigger string: ", str);

				stage++;
			}
		}

		return returnValue;
	}
}