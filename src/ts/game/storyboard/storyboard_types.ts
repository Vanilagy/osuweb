import { Point, Vector2 } from "../../util/point";
import { EaseType } from "../../util/math_util";
import { Color } from "../../util/graphics_util";

export enum StoryboardEntityType {
	Sprite,
	Animation,
	Sample
}

export enum StoryboardLayer {
	/** Is always shown behind all other layers. */
	Background,
	/** Is only shown when the game is in a "fail" state. The game transfers to a fail state whenever the player doesn't get a geki at the end of a combo. */
	Fail,
	/** Is only shown when the game is in a "pass" state, which is the case when the game isn't in a "fail" state. */
	Pass,
	/** Is always shown above all other layers. */
	Foreground
}

export enum StoryboardOrigin {
	TopLeft,
	TopCenter,
	TopRight,
	CenterLeft,
	Center,
	CenterRight,
	BottomLeft,
	BottomCenter,
	BottomRight
}

export enum StoryboardLoopType {
	LoopOnce,
	LoopForever
}

interface StoryboardEntityBase {
	type: StoryboardEntityType,
	layer: StoryboardLayer,
	filepath: string
}

export interface StoryboardEntitySprite extends StoryboardEntityBase {
	type: StoryboardEntityType.Sprite,
	origin: StoryboardOrigin,
	position: Point,
	events: StoryboardEvent[]
}

export interface StoryboardEntityAnimation extends StoryboardEntityBase {
	type: StoryboardEntityType.Animation,
	origin: StoryboardOrigin,
	position: Point,
	events: StoryboardEvent[],
	frameCount: number,
	frameDelay: number,
	loopType: StoryboardLoopType
}

export interface StoryboardEntitySample extends StoryboardEntityBase {
	type: StoryboardEntityType.Sample,
	time: number,
	volume: number
}

export type StoryboardEntity = StoryboardEntitySprite | StoryboardEntityAnimation | StoryboardEntitySample;

export enum StoryboardEventType {
	Fade,
	Move,
	MoveX,
	MoveY,
	Scale,
	VectorScale,
	Rotate,
	Color,
	Loop,
	Trigger,
	Parameter
}

export enum StoryboardEventParameterValue {
	HorizontalFlip,
	VerticalFlip,
	AdditiveColor
}

interface StoryboardEventBase {
	type: StoryboardEventType,
	easing?: EaseType,
	startTime: number,
	endTime?: number
}

export interface StoryboardEventFade extends StoryboardEventBase {
	type: StoryboardEventType.Fade,
	opacityStart: number,
	opacityEnd: number
}

export interface StoryboardEventMove extends StoryboardEventBase {
	type: StoryboardEventType.Move,
	positionStart: Point,
	positionEnd: Point
}

export interface StoryboardEventMoveX extends StoryboardEventBase {
	type: StoryboardEventType.MoveX,
	xStart: number,
	xEnd: number
}

export interface StoryboardEventMoveY extends StoryboardEventBase {
	type: StoryboardEventType.MoveY,
	yStart: number,
	yEnd: number
}

export interface StoryboardEventScale extends StoryboardEventBase {
	type: StoryboardEventType.Scale,
	scaleStart: number,
	scaleEnd: number
}

export interface StoryboardEventVectorScale extends StoryboardEventBase {
	type: StoryboardEventType.VectorScale,
	scaleStart: Vector2,
	scaleEnd: Vector2
}

export interface StoryboardEventRotate extends StoryboardEventBase {
	type: StoryboardEventType.Rotate,
	rotationStart: number,
	rotationEnd: number
}

export interface StoryboardEventColor extends StoryboardEventBase {
	type: StoryboardEventType.Color,
	colorStart: Color,
	colorEnd: Color
}

export interface StoryboardEventLoop extends StoryboardEventBase {
	type: StoryboardEventType.Loop,
	loopCount: number,
	events: StoryboardEvent[]
}

export interface StoryboardEventTrigger extends StoryboardEventBase {
	type: StoryboardEventType.Trigger,
	/** This is either "Failing", "Passing" or a hit sound identifier, info about which can be found in the storyboarding spec. */
	trigger: string,
	/** Can be used to link several triggers of one entity together. If triggers are linked, all of the curerntly playing triggers will stop when a new trigger begins. */
	groupNumber: number,
	events: StoryboardEvent[]
}

export interface StoryboardEventParameter extends StoryboardEventBase {
	type: StoryboardEventType.Parameter,
	parameter: StoryboardEventParameterValue
}

export type StoryboardEvent = StoryboardEventFade | StoryboardEventMove | StoryboardEventMoveX | StoryboardEventMoveY | StoryboardEventScale | StoryboardEventVectorScale | StoryboardEventRotate | StoryboardEventColor | StoryboardEventLoop | StoryboardEventTrigger | StoryboardEventParameter;