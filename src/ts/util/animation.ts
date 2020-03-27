import { EaseType, MathUtil } from "./math_util";
import { insertItem } from "./misc_util";

export class AnimationParameterList {
	public defaultValues: {[name: string]: number};
	public parameters = new Set<string>();

	constructor(list: {[name: string]: number}) {
		this.defaultValues = list;

		for (let parameter in this.defaultValues) this.parameters.add(parameter);
	}
}

export interface AnimationEventOptions {
	start: number,
	duration?: number,
	from?: number,
	to: number,
	ease?: EaseType,
	p?: number
}

export class AnimationEvent {
	public parameter: string;
	public start: number;
	public duration: number;
	public from: number;
	public to: number;
	public ease: EaseType;
	public p: number;

	constructor(parameter: string, options: AnimationEventOptions) {
		this.parameter = parameter;

		this.start = options.start;
		this.duration = (options.duration === undefined)? 0 : options.duration;
		this.from = (options.from === undefined)? null : options.from;
		this.to = options.to;
		this.ease = (options.ease === undefined)? EaseType.Linear : options.ease;
		this.p = options.p;
	}
}

export class Animation {
	public parameterList: AnimationParameterList;
	public events: AnimationEvent[] = [];

	constructor(parameterList: AnimationParameterList) {
		this.parameterList = parameterList;
	}

	addEvent(event: AnimationEvent) {
		if (!this.parameterList.parameters.has(event.parameter)) throw new Error(`Animation does not specify parameter '${event.parameter}'!`);

		insertItem(this.events, event, (a, b) => a.start - b.start);
	}
}

export class AnimationPlayer {
	private animation: Animation;
	private values: {[name: string]: number} = {};

	private startTime: number = null;
	private speed = 1.0;

	constructor(animation: Animation) {
		this.animation = animation;
		this.setDefaultValues();
	}

	private setDefaultValues() {
		for (let parameter in this.animation.parameterList.defaultValues) {
			this.values[parameter] = this.animation.parameterList.defaultValues[parameter];
		}
	}

	start(time: number, speed = 1.0) {
		this.startTime = time;
		this.speed = speed;
	}

	getCurrentTime(now: number) {
		if (this.startTime === null) return 0;
		return Math.max(0, now - this.startTime) * this.speed;
	}

	update(now: number) {
		let time = this.getCurrentTime(now);
		let parameterList = this.animation.parameterList;

		parameterList.parameters.forEach((parameter) => {
			let events = this.animation.events.filter((x) => x.parameter === parameter);

			let latestEventIndex: number = null;
			for (let i = 0; i < events.length; i++) {
				let event = events[i];
				if (time >= event.start) latestEventIndex = i;
				else break;
			}

			if (latestEventIndex === null) {
				this.values[parameter] = parameterList.defaultValues[parameter];
			} else {
				const sampleEventAtTime = (index: number, time: number) => {
					let event = events[index];

					let completion = MathUtil.clamp((time - event.start) / event.duration, 0, 1);
					if (isNaN(completion) || !isFinite(completion)) completion = 1;

					if (completion === 1) {
						return event.to;
					} else {
						let from: number;
						if (event.from !== null) from = event.from;
						else if (index === 0) from = parameterList.defaultValues[parameter];
						else from = sampleEventAtTime(index-1, time);

						if (completion === 0) {
							return from;
						} else {
							completion = MathUtil.ease(event.ease, completion, event.p);
							return MathUtil.lerp(from, event.to, completion);
						}
					}
				};

				this.values[parameter] = sampleEventAtTime(latestEventIndex, time);
			}
		});
	}

	getParameter(parameter: string) {
		return this.values[parameter];
	}
}