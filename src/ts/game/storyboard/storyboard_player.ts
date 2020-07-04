import { Storyboard } from "./storyboard";
import { StoryboardEntityType, StoryboardEntitySprite, StoryboardEntityAnimation, StoryboardLayer, StoryboardEventType, StoryboardOrigin, StoryboardEventParameterValue, StoryboardEvent, StoryboardLoopType, StoryboardEventTrigger, StoryboardEntitySample } from "./storyboard_types";
import { getFileExtension } from "../../util/file_util";
import { VirtualDirectory } from "../../file_system/virtual_directory";
import { last, binarySearchLessOrEqual, promiseAllSettled } from "../../util/misc_util";
import { clonePoint, lerpPoints, Point } from "../../util/point";
import { MathUtil } from "../../util/math_util";
import { currentWindowDimensions } from "../../visuals/ui";
import { STANDARD_SCREEN_DIMENSIONS } from "../../util/constants";
import { Colors, lerpColors, colorToHexNumber } from "../../util/graphics_util";
import { uploadTexture } from "../../visuals/rendering";
import { VirtualFile } from "../../file_system/virtual_file";
import { audioContext, soundEffectsNode } from "../../audio/audio";
import { EMPTY_AUDIO_BUFFER } from "../../util/audio_util";
import { AudioBufferPlayer } from "../../audio/audio_buffer_player";
import { StoryboardUtil } from "./storyboard_util";
import { StoryboardParser } from "./storyboard_parser";

export class StoryboardPlayer {
	public storyboard: Storyboard;
	private directories: VirtualDirectory[];

	public container: PIXI.Container;
	private backgroundContainer: PIXI.Container;
	private failContainer: PIXI.Container;
	private passContainer: PIXI.Container;
	private foregroundContainer: PIXI.Container;
	private gameState: "Fail" | "Pass";

	private textures: Map<string, PIXI.Texture>;
	private spriteEntityMap: Map<PIXI.Sprite, StoryboardEntitySprite | StoryboardEntityAnimation>;
	/** Sprites sorted by start time. */
	private sortedSprites: PIXI.Sprite[];
	private preparedEvents: Map<PIXI.Sprite, ReturnType<typeof StoryboardUtil.prepareEvents>>;
	private allTriggers: StoryboardEventTrigger[];
	private triggerSpriteMap: Map<StoryboardEventTrigger, PIXI.Sprite>;
	private activeTriggerTriggerTimes: Map<StoryboardEventTrigger, number> = new Map();

	private lastSpriteIndex = 0;
	private visibleSprites: PIXI.Sprite[] = [];

	private audioBuffers: Map<string, AudioBuffer>;
	/** Samples sorted by time. */
	private sortedSamples: StoryboardEntitySample[];
	private lastSampleIndex = 0;
	private activeAudioPlayers: AudioBufferPlayer[] = [];

	constructor(storyboard: Storyboard, directories: VirtualDirectory[], container: PIXI.Container) {
		this.storyboard = storyboard;
		this.directories = directories;
		this.container = container;

		this.backgroundContainer = new PIXI.Container();
		this.failContainer = new PIXI.Container();
		this.passContainer = new PIXI.Container();
		this.foregroundContainer = new PIXI.Container();

		this.backgroundContainer.sortableChildren = true;
		this.failContainer.sortableChildren = true;
		this.passContainer.sortableChildren = true;
		this.foregroundContainer.sortableChildren = true;

		this.container.removeChildren();
		this.container.addChild(this.backgroundContainer, this.failContainer, this.passContainer, this.foregroundContainer);
	}

	reset() {
		this.pause();

		this.backgroundContainer.removeChildren();
		this.failContainer.removeChildren();
		this.passContainer.removeChildren();
		this.foregroundContainer.removeChildren();

		this.lastSpriteIndex = 0;
		this.lastSampleIndex = 0;
		this.visibleSprites.length = 0;
		this.activeTriggerTriggerTimes.clear();
		this.activeAudioPlayers.length = 0;

		this.setGameState("Pass", -Infinity);
	}

	async init() {
		let textureFilepaths = new Set<string>();
		let soundFilepaths = new Set<string>();

		this.spriteEntityMap = new Map();
		this.preparedEvents = new Map();
		this.sortedSprites = [];
		this.allTriggers = [];
		this.triggerSpriteMap = new Map();
		this.sortedSamples = [];

		for (let i = 0; i < this.storyboard.entities.length; i++) {
			let entity = this.storyboard.entities[i];

			if (entity.type === StoryboardEntityType.Sprite) {
				if (entity.events.length === 0) continue;

				// Add the texture path
				textureFilepaths.add(entity.filepath);
			} else if (entity.type === StoryboardEntityType.Animation) {
				if (entity.events.length === 0) continue;

				let extension = getFileExtension(entity.filepath);
				let pathWithoutExtension = entity.filepath.slice(0, -extension.length);

				// Add a texture path for each frame of the animation
				for (let j = 0; j < entity.frameCount; j++) {
					textureFilepaths.add(pathWithoutExtension + j + extension);
				}
			} else if (entity.type === StoryboardEntityType.Sample) {
				this.sortedSamples.push(entity);

				// Add the audio path
				soundFilepaths.add(entity.filepath);
			}

			// Create sprite
			if (entity.type !== StoryboardEntityType.Sample) {
				let sprite = new PIXI.Sprite();
				sprite.zIndex = i; // Sprites' z-index is determined solely be their declaration order in the file.
				setAnchor(sprite, entity);
				this.spriteEntityMap.set(sprite, entity);

				// Prepares the events of the entity for easier and more optimized playback later.
				let preparedEvents = StoryboardUtil.prepareEvents(entity.events);
				this.preparedEvents.set(sprite, preparedEvents);

				this.sortedSprites.push(sprite);

				// If the entity has triggers, record them.
				for (let j = 0; j < preparedEvents.triggers.length; j++) {
					let trigger = preparedEvents.triggers[j];

					this.allTriggers.push(trigger);
					this.triggerSpriteMap.set(trigger, sprite);
				}
			}
		}

		// Sort sprites and samples chronologically for easier sequential playback
		this.sortedSprites.sort((a, b) => {
			return this.preparedEvents.get(a).startTime - this.preparedEvents.get(b).startTime;
		});
		this.sortedSamples.sort((a, b) => {
			return a.time - b.time
		});

		// Load all textures //

		this.textures = new Map();
		let loadPromises: Promise<any>[] = [];

		for (let path of textureFilepaths) {
			// Search for the file in the directory structure
			let file: VirtualFile = null;
			for (let directory of this.directories) {
				let found = await directory.getFileByPath(path);

				if (found) {
					file = found;
					break;
				}
			}
			if (!file) continue;

			let url = await file.readAsResourceUrl();

			// We create an image here so that we can wait until it's loaded so that the PIXI.Texture can instantly start its upload to the GPU.
			let image = new Image();
			image.src = url;

			let promise = new Promise((resolve) => {
				image.addEventListener('load', () => {
					resolve();
				});
			});
			loadPromises.push(promise);

			let texture = PIXI.Texture.from(image);
			this.textures.set(path, texture);
		};

		// Wait until all images have loaded
		await promiseAllSettled(loadPromises);

		// Upload textures to the GPU
		for (let [, texture] of this.textures) {
			uploadTexture(texture);
		}

		// Load all audio buffers //

		this.audioBuffers = new Map();
		let audioPromises: Promise<AudioBuffer>[] = [];

		let i = 0;
		for (let path of soundFilepaths) {
			// Again, search for the file in the directory structure
			let file: VirtualFile = null;
			for (let directory of this.directories) {
				let found = await directory.getFileByPath(path);

				if (found) {
					file = found;
					break;
				}
			}

			if (file) {
				audioPromises.push(audioContext.decodeAudioData(await file.readAsArrayBuffer()));
			} else {
				// We have to push *something* so that we can properly map an index to each path.
				audioPromises.push(Promise.reject());
			}
		}

		// Wait until all the audio data has been decoded
		let decodedBuffers = await promiseAllSettled(audioPromises);

		i = 0;
		for (let path of soundFilepaths) {
			let result = decodedBuffers[i];
			if (result.status === 'fulfilled') {
				this.audioBuffers.set(path, result.value);
			} else {
				this.audioBuffers.set(path, EMPTY_AUDIO_BUFFER);
			}

			i++;
		}

		this.reset();
	}

	getStartTime() {
		let startTime = Infinity;
		
		let prepEvents = this.preparedEvents.get(this.sortedSprites[0]);
		if (prepEvents) startTime = Math.min(startTime, prepEvents.startTime);

		let firstSample = this.sortedSamples[0];
		if (firstSample) startTime = Math.min(startTime, firstSample.time);

		return startTime;
	}

	getEndTime() {
		let endTime = -Infinity;
		
		let prepEvents = this.preparedEvents.get(last(this.sortedSprites));
		if (prepEvents) endTime = Math.max(endTime, prepEvents.endTime);

		let lastSample = last(this.sortedSamples);
		if (lastSample) endTime = Math.max(endTime, lastSample.time);

		return endTime;
	}

	hasTexturePath(path: string) {
		for (let tex of this.textures) {
			if (tex[0] === path) return true;
		}

		return false;
	}

	/** Checks if there are any trigger listeners matching the incoming trigger. */
	trigger(time: number, type: "HitSound", hitSoundData: ReturnType<typeof StoryboardParser.parseHitSoundTrigger>): void;
	trigger(time: number, type: "Failing" | "Passing"): void;
	trigger(time: number, type: "HitSound" | "Failing" | "Passing", hitSoundData?: ReturnType<typeof StoryboardParser.parseHitSoundTrigger>) {
		for (let i = 0; i < this.allTriggers.length; i++) {
			let trigger = this.allTriggers[i];

			// If the trigger is currently active. Outside this time, the trigger does nothing.
			if (time >= trigger.startTime && time < trigger.endTime) {
				let activated = false;

				if (trigger.trigger === "Failing" || trigger.trigger === "Passing") {
					if (trigger.trigger === type) activated = true;
				} else if (type === "HitSound") {
					// Check if hit sounds match

					let parsedHitSound = StoryboardParser.parseHitSoundTrigger(trigger.trigger);
					let matches = true;

					if (parsedHitSound.sampleSet !== 0 && hitSoundData.sampleSet !== parsedHitSound.sampleSet) matches = false;
					if (parsedHitSound.additionSet !== 0 && hitSoundData.additionSet !== parsedHitSound.additionSet) matches = false;
					if (parsedHitSound.addition !== 0 && hitSoundData.addition !== parsedHitSound.addition) matches = false;
					if (parsedHitSound.sampleIndex !== null && hitSoundData.sampleIndex !== parsedHitSound.sampleIndex && !(hitSoundData.sampleIndex === 1 && parsedHitSound.sampleIndex === 0)) matches = false; // Extra case added because sample index 1 == sample index 0

					activated = matches;
				}

				if (!activated) continue;

				let sprite = this.triggerSpriteMap.get(trigger);

				// If the group number isn't zero, stop all currently active triggers with the same group number.
				if (trigger.groupNumber !== 0) {
					let spriteTriggers = this.preparedEvents.get(sprite).triggers;
					for (let t of spriteTriggers) if (t.groupNumber === trigger.groupNumber) this.activeTriggerTriggerTimes.delete(t);
				}

				this.activeTriggerTriggerTimes.set(trigger, time);
			}
		}
	}

	setGameState(state: "Fail" | "Pass", time: number) {
		if (state === this.gameState) return;

		let before = this.gameState;
		this.gameState = state;

		this.failContainer.visible = state === "Fail";
		this.passContainer.visible = state === "Pass";

		if (before === "Fail" && state === "Pass") {
			this.trigger(time, "Passing");
		} else if (before === "Pass" && state === "Fail") {
			this.trigger(time, "Failing");
		}
	}

	tick(currentTime: number) {
		for (let i = 0; i < this.activeAudioPlayers.length; i++) {
			// If the audio is over, remove the audio player.
			if (!this.activeAudioPlayers[i].isPlaying()) this.activeAudioPlayers.splice(i--, 1);
		}

		// Handle playback of samples
		for (this.lastSampleIndex; this.lastSampleIndex < this.sortedSamples.length; this.lastSampleIndex++) {
			let sample = this.sortedSamples[this.lastSampleIndex];
			if (sample.time > currentTime) break;

			// Don't play the audio if the layer doesn't match the current game state
			if (sample.layer === StoryboardLayer.Fail && this.gameState !== "Fail") continue;
			if (sample.layer === StoryboardLayer.Pass && this.gameState !== "Pass") continue;

			let player = new AudioBufferPlayer(soundEffectsNode);
			player.loadAudioBuffer(this.audioBuffers.get(sample.filepath));
			player.setVolume(sample.volume / 100);
			player.start(0);

			this.activeAudioPlayers.push(player);
		}
	}

	render(currentTime: number) {
		// Add new sprites
		for (this.lastSpriteIndex; this.lastSpriteIndex < this.sortedSprites.length; this.lastSpriteIndex++) {
			let sprite = this.sortedSprites[this.lastSpriteIndex];
			let preparedEvents = this.preparedEvents.get(sprite);

			if (preparedEvents.startTime > currentTime) break;

			// Insert the sprite into the correct layer
			let entity = this.spriteEntityMap.get(sprite);
			if (entity.layer === StoryboardLayer.Background) this.backgroundContainer.addChild(sprite);
			else if (entity.layer === StoryboardLayer.Fail) this.failContainer.addChild(sprite);
			else if (entity.layer === StoryboardLayer.Pass) this.passContainer.addChild(sprite);
			else if (entity.layer === StoryboardLayer.Foreground) this.foregroundContainer.addChild(sprite);

			this.visibleSprites.push(sprite);
		}

		for (let i = 0; i < this.visibleSprites.length; i++) {
			let sprite = this.visibleSprites[i];
			let preparedEvents = this.preparedEvents.get(sprite);

			if (currentTime >= preparedEvents.endTime) {
				// Remove sprite

				sprite.parent.removeChild(sprite);
				this.visibleSprites.splice(i--, 1);
				continue;
			}

			this.updateSprite(sprite, currentTime);
		}
	}

	pause() {
		// Pause all sample audio playback
		for (let player of this.activeAudioPlayers) player.pause();
	}

	unpause() {
		// Resume all sample audio playback
		for (let player of this.activeAudioPlayers) player.unpause();
	}

	dispose() {
		for (let [, tex] of this.textures) {
			tex.destroy(true);
		}
	}

	private updateSprite(sprite: PIXI.Sprite, currentTime: number) {
		let entity = this.spriteEntityMap.get(sprite);
		let scalingFac = getScalingFactor();
		let preparedEvents = this.preparedEvents.get(sprite);
		let eventBuckets = preparedEvents.buckets;
		let activeEventTypes = new Set<StoryboardEventType>();

		// The display properties of the sprite. These will be modified by events.
		let position = clonePoint(entity.position);
		let scale = new PIXI.Point(1.0, 1.0);
		let opacity = (preparedEvents.triggers.length === 0)? 1.0 : 0.0; // For some reason, sprites with triggers start at 0% opacity, regardless of if a trigger is currently active or not.
		let rotation = 0.0;
		let tint = Colors.White;
		let blendMode = PIXI.BLEND_MODES.NORMAL;

		/** Applies a storyboard event to the sprite. */
		function applyEvent(event: StoryboardEvent, time: number, isFromTrigger: boolean) {
			// If the event is trigger-caused, but a normal event of the same type is currently active, don't show this event! Trigger events are only displayed if no other events of the same type are currently active.
			if (isFromTrigger && activeEventTypes.has(event.type)) return;

			let duration = event.endTime - event.startTime;
			let completion: number;
			if (duration === 0) {
				// If the event is instant, completion should be 1 as soon as the event doesn't lie in the future anymore.
				completion = (time >= event.startTime)? 1 : 0;
			} else {
				completion = (time - event.startTime) / duration;
				completion = MathUtil.clamp(completion, 0, 1);
				completion = MathUtil.ease(event.easing, completion);
			}

			let active = time >= event.startTime && time < event.endTime;
			if (!isFromTrigger && active) activeEventTypes.add(event.type);

			// Update the display properties based on type
			if (event.type == StoryboardEventType.Fade) {
				opacity = MathUtil.lerp(event.opacityStart, event.opacityEnd, completion);
			} else if (event.type === StoryboardEventType.Move) {
				position = lerpPoints(event.positionStart, event.positionEnd, completion);
			} else if (event.type === StoryboardEventType.MoveX) {
				position.x = MathUtil.lerp(event.xStart, event.xEnd, completion);
			} else if (event.type === StoryboardEventType.MoveY) {
				position.y = MathUtil.lerp(event.yStart, event.yEnd, completion);
			} else if (event.type === StoryboardEventType.Scale) {
				scale.set(MathUtil.lerp(event.scaleStart, event.scaleEnd, completion));
			} else if (event.type === StoryboardEventType.VectorScale) {
				let x = MathUtil.lerp(event.scaleStart.x, event.scaleEnd.x, completion);
				let y = MathUtil.lerp(event.scaleStart.y, event.scaleEnd.y, completion);

				scale.set(x, y);
			} else if (event.type === StoryboardEventType.Rotate) {
				rotation = MathUtil.lerp(event.rotationStart, event.rotationEnd, completion);
			} else if (event.type === StoryboardEventType.Color) {
				tint = lerpColors(event.colorStart, event.colorEnd, completion);
			} else if (event.type === StoryboardEventType.Parameter) {
				// Parameter events are only applied while the event is active, and lose their effect afterwards again.
				if (active) {
					if (event.parameter === StoryboardEventParameterValue.HorizontalFlip) scale.y *= -1;
					else if (event.parameter === StoryboardEventParameterValue.VerticalFlip) scale.x *= -1;
					else if (event.parameter === StoryboardEventParameterValue.AdditiveColor) blendMode = PIXI.BLEND_MODES.ADD;
				}
			}
		}

		for (let i = 0; i < eventBuckets.length; i++) {
			let bucket = eventBuckets[i];
			if (!bucket) continue; // Since the bucket array is holey

			// Since the events are sorted, do a binary search to quickly skip to the current event.
			let index = binarySearchLessOrEqual(bucket, currentTime, (x) => x.startTime);
			if (index === -1) index = 0; // Always display the first event!

			// If multiple events overlap, we need to go back and search for the first event that still lies in the current time, since that's the one that gets displayed.
			while (index > 0) {
				let prevEvent = bucket[index - 1];
				if (prevEvent.endTime > currentTime) index--;
				else break;
			}

			applyEvent(bucket[index], currentTime, false);
		}

		for (let i = 0; i < preparedEvents.triggers.length; i++) {
			let trigger = preparedEvents.triggers[i];
			let triggerTime = this.activeTriggerTriggerTimes.get(trigger);
			if (triggerTime === undefined) continue; // If the trigger isn't currently active, don't bother.

			// The trigger is active, so go and display its events.
			for (let j = 0; j < trigger.events.length; j++) {
				let event = trigger.events[j];
				let relativeTime = currentTime - triggerTime; // Similar to loops, timing of trigger events is relative to the trigger time.

				applyEvent(event, relativeTime, true);
			}
		}

		sprite.alpha = opacity;
		sprite.visible = opacity > 0;
		if (opacity === 0) return;
		
		if (entity.type === StoryboardEntityType.Sprite && sprite.texture === PIXI.Texture.EMPTY) {
			// Set texture
			sprite.texture = this.textures.get(entity.filepath);
		} else if (entity.type === StoryboardEntityType.Animation) {
			// Set texture based on current animation frame
			let frameNumber = Math.floor((currentTime - preparedEvents.startTime) / entity.frameDelay);
			frameNumber = MathUtil.clamp(frameNumber, 0, (entity.loopType === StoryboardLoopType.LoopOnce)? entity.frameCount-1 : Infinity);
			frameNumber %= entity.frameCount;

			let extension = getFileExtension(entity.filepath);
			let pathWithoutExtension = entity.filepath.slice(0, -extension.length);
			let path = pathWithoutExtension + frameNumber + extension;

			sprite.texture = this.textures.get(path);
		}

		// Apply display properties
		let screenPos = toScreenCoordinates(position);
		sprite.position.set(screenPos.x, screenPos.y);
		sprite.scale.set(scale.x * scalingFac, scale.y * scalingFac);
		sprite.rotation = rotation;
		sprite.tint = colorToHexNumber(tint);
		sprite.blendMode = blendMode;
	}
}

function getScalingFactor() {
	return currentWindowDimensions.height / STANDARD_SCREEN_DIMENSIONS.height;
}

function toScreenCoordinates(storyboardPosition: Point): Point {
	let fac = getScalingFactor();

	return {
		x: currentWindowDimensions.width/2 + (storyboardPosition.x - STANDARD_SCREEN_DIMENSIONS.width/2) * fac,
		y: currentWindowDimensions.height/2 + (storyboardPosition.y - STANDARD_SCREEN_DIMENSIONS.height/2) * fac
	};
}

function setAnchor(sprite: PIXI.Sprite, entity: StoryboardEntitySprite | StoryboardEntityAnimation) {
	switch (entity.origin) {
		case StoryboardOrigin.TopLeft: sprite.anchor.set(0.0, 0.0); break;
		case StoryboardOrigin.TopCenter: sprite.anchor.set(0.5, 0.0); break;
		case StoryboardOrigin.TopRight: sprite.anchor.set(1.0, 0.0); break;
		case StoryboardOrigin.CenterLeft: sprite.anchor.set(0.0, 0.5); break;
		case StoryboardOrigin.Center: sprite.anchor.set(0.5, 0.5); break;
		case StoryboardOrigin.CenterRight: sprite.anchor.set(1.0, 0.5); break;
		case StoryboardOrigin.BottomLeft: sprite.anchor.set(0.0, 1.0); break;
		case StoryboardOrigin.BottomCenter: sprite.anchor.set(0.5, 1.0); break;
		case StoryboardOrigin.BottomRight: sprite.anchor.set(0.1, 1.0); break;
	}
}