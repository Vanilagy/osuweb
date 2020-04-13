import { StoryboardEvent, StoryboardEventTrigger, StoryboardEventType, StoryboardEventFade } from "./storyboard_types";
import { shallowObjectClone } from "../../util/misc_util";

export namespace StoryboardUtil {
	/** Gets the event with the greatest endTime. */
	function getLastEvent(events: StoryboardEvent[]) {
		let last = -Infinity,
			lastEvent: StoryboardEvent = null;

		for (let i = 0; i < events.length; i++) {
			let event = events[i];
			if (event.endTime > last) {
				last = event.endTime;
				lastEvent = event;
			}
		}

		return lastEvent;
	}

	function getEventsEndTime(events: StoryboardEvent[]) {
		return getLastEvent(events)?.endTime ?? -Infinity;
	}

	/** Prepares a list of entity events so that they can be played back more optimally. */
	export function prepareEvents(events: StoryboardEvent[]) {
		events = events.slice(0);
		let triggers: StoryboardEventTrigger[] = []; // A list of all the triggers
		let startTime = Infinity;

		for (let i = 0; i < events.length; i++) {
			let event = events[i];
			startTime = Math.min(startTime, event.startTime);

			if (event.type === StoryboardEventType.Loop) {
				let loopDuration = getEventsEndTime(event.events) - event.events[0].startTime;

				// Extract all subevents of the loop back out into the main event array, while adjusting their timing.
				for (let j = 0; j < event.events.length; j++) {
					let subEvent = event.events[j];

					if (subEvent.type === StoryboardEventType.Loop) {
						// If there's a loop inside a loop, just extract it out without changing its timing.
						events.push(subEvent);
					} else {
						// Add one event per loop iteration
						for (let k = 0; k < event.loopCount; k++) {
							let clone = shallowObjectClone(subEvent);

							let increase = event.startTime + loopDuration * k;
							clone.startTime += increase;
							clone.endTime += increase;
	
							events.push(clone);
						}
					}
				}

				// Remove the loop event
				events.splice(i--, 1);
			} else if (event.type === StoryboardEventType.Trigger) {
				for (let j = 0; j < event.events.length; j++) {
					let subEvent = event.events[j];

					// Extract all loops from the trigger subevent
					if (subEvent.type === StoryboardEventType.Loop) {
						events.push(subEvent);
						event.events.splice(j--, 1);
					}
				}

				triggers.push(event);
				events.splice(i--, 1);
			}
		}
		
		events.sort((a, b) => a.startTime - b.startTime);
		let buckets: StoryboardEvent[][] = []; // Each bucket holds all events of a certain even type.
		let endTime = getEventsEndTime(events);

		// Sort all events into buckets
		for (let i = 0; i < events.length; i++) {
			let event = events[i];
			let arr = buckets[event.type];
			if (!arr) arr = buckets[event.type] = [];

			arr.push(event);
		}

		// Just to be sure, don't do this optimiztation if there's a trigger event. We don't wanna mess it up!
		if (triggers.length === 0) {
			// A common pattern for entities is to make them fade in and out. In that case, we can optimize start and end time to only cover the period in which the object has an opacity greater than zero. This optimization GREATLY reduces entity count for storyboards.

			let fades = buckets[StoryboardEventType.Fade];
			if (fades) {
				let first = fades[0] as StoryboardEventFade;
				if (first.opacityStart === 0) startTime = Math.max(startTime, first.startTime);
	
				let last = getLastEvent(fades) as StoryboardEventFade;
				if (last.opacityEnd === 0) endTime = Math.min(endTime, last.endTime);
			}
		}

		return {
			/** One bucket per event type */
			buckets,
			/** An array of all triggers */
			triggers,
			/** The optimized start time */
			startTime: startTime,
			/** The optimized end time */
			endTime: (triggers.length > 0)? Infinity : endTime // Sprites with triggers never disappear :thinking: #optimizedPpyCode
		};
	}
}