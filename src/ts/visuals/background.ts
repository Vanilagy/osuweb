import { Interpolator } from "../util/graphics_util";
import { EaseType, MathUtil } from "../util/math_util";
import { addRenderingTask, backgroundContainer } from "./rendering";
import { VirtualFile } from "../file_system/virtual_file";
import { getBitmapFromImageFile, BitmapQuality } from "../util/image_util";
import { fitSpriteIntoContainer } from "../util/pixi_util";
import { uiEventEmitter, getGlobalScalingFactor } from "./ui";
import { last } from "../util/misc_util";

const IMAGE_FADE_IN_DURATION = 333; // In ms

export enum BackgroundState {
	None,
	SongSelect,
	Gameplay
}

export abstract class BackgroundManager {
	private static state: BackgroundState = BackgroundState.None;
	private static imageContainer = new PIXI.Container();
	private static videoElement = document.createElement('video');
	private static videoSprite: PIXI.Sprite;
	private static currentImageFile: VirtualFile = null;
	private static currentVideoFile: VirtualFile = null;
	private static markedForDeletionSprites: WeakSet<PIXI.Sprite> = new WeakSet();
	private static fadeInterpolators: WeakMap<PIXI.Sprite, Interpolator> = new WeakMap();
	private static currentGameplayBrightness: number = 1.0;
	private static blurFilter = new PIXI.filters.KawaseBlurFilter(0);
	private static colorMatrixFilter = new PIXI.filters.ColorMatrixFilter();
	private static gameplayInterpolator: Interpolator = new Interpolator({
		ease: EaseType.EaseInOutQuad,
		duration: 1000
	});
	private static blurInterpolator: Interpolator = new Interpolator({
		from: 1,
		to: 0,
		ease: EaseType.EaseInOutSine,
		duration: 500
	});
	private static scaleInterpolator: Interpolator = new Interpolator({
		from: 1.08,
		to: 1.0,
		duration: 700,
		ease: EaseType.EaseOutCubic,
		reverseEase: EaseType.EaseInCubic
	});

	static initialize() {
		this.videoElement.setAttribute('muted', '');
		this.videoElement.setAttribute('preload', 'auto');
		this.videoElement.setAttribute('webkit-playsinline', '');
		this.videoElement.setAttribute('playsinline', '');

		let videoTex = PIXI.Texture.from(this.videoElement);
		this.videoSprite = new PIXI.Sprite(videoTex);
		(videoTex.baseTexture.resource as any).autoPlay = false;

		this.setState(BackgroundState.SongSelect);
		this.resize();

		backgroundContainer.addChild(this.imageContainer, this.videoSprite);

		this.blurFilter.quality = 5;
		backgroundContainer.filters = [this.blurFilter, this.colorMatrixFilter];
	}

	static async setState(newState: BackgroundState) {
		if (newState === this.state) return;

		if (newState === BackgroundState.SongSelect) {
			this.gameplayInterpolator.setReversedState(true);
			this.blurInterpolator.setReversedState(true);
			this.scaleInterpolator.setReversedState(true);
		} else if (newState === BackgroundState.Gameplay) {
			if (this.currentImageFile) {
				let fullResBitmap = await getBitmapFromImageFile(this.currentImageFile, BitmapQuality.High);
				let sprite = last(this.imageContainer.children) as PIXI.Sprite;
				sprite.texture = PIXI.Texture.from(fullResBitmap as any);
			}

			this.gameplayInterpolator.setReversedState(false);
			this.blurInterpolator.setReversedState(false);
			this.scaleInterpolator.setReversedState(false);
		}

		this.state = newState;
	}

	static async setImage(file: VirtualFile) {
		if (this.currentImageFile === file) return;
		this.currentImageFile = file;

		let bitmap = await getBitmapFromImageFile(file, (this.state === BackgroundState.Gameplay)? BitmapQuality.High : BitmapQuality.Medium);

		let newSprite = new PIXI.Sprite(PIXI.Texture.from(bitmap as any));
		fitSpriteIntoContainer(newSprite, window.innerWidth, window.innerHeight);

		for (let obj of this.imageContainer.children) {
			let sprite = obj as PIXI.Sprite;
			if (this.markedForDeletionSprites.has(sprite)) continue;

			this.markedForDeletionSprites.add(sprite);
			setTimeout(() => this.imageContainer.removeChild(sprite), IMAGE_FADE_IN_DURATION);
		}

		this.imageContainer.addChild(newSprite);

		let fadeInterpolator = new Interpolator({
			ease: EaseType.EaseInOutSine,
			duration: IMAGE_FADE_IN_DURATION
		});
		fadeInterpolator.start();
		this.fadeInterpolators.set(newSprite, fadeInterpolator);
	}

	/** Returns a Promise that resolves once the video is ready for playback. */
	static async setVideo(file: VirtualFile): Promise<void> {
		if (this.currentVideoFile === file) return Promise.resolve();
		this.currentVideoFile = file;

		this.videoElement.src = await file.readAsResourceUrl();

		return new Promise((resolve, reject) => {
			this.videoElement.addEventListener('error', reject);
			this.videoElement.addEventListener('canplaythrough', () => {
				fitSpriteIntoContainer(this.videoSprite, window.innerWidth, window.innerHeight);
				resolve();
			});
		});
	}

	static removeVideo() {
		this.videoElement.pause();
		this.videoElement.src = '';
	}

	static setVideoOpacity(opacity: number) {
		this.videoElement.style.opacity = opacity.toString();
	}

	static playVideo() {
		this.videoElement.play();
	}

	static videoIsPaused() {
		return this.videoElement.paused;
	}

	static getVideoCurrentTime() {
		return this.videoElement.currentTime;
	}

	static setVideoCurrentTime(time: number) {
		this.videoElement.currentTime = time;
	}

	static setVideoPlaybackRate(time: number) {
		this.videoElement.playbackRate = time;
	}

	static setGameplayBrightness(newBrightness: number) {
		this.currentGameplayBrightness = newBrightness;
	}

	static update() {
		let t = this.gameplayInterpolator.getCurrentValue();
		let brightness = MathUtil.lerp(0.75, this.currentGameplayBrightness, t);

		this.colorMatrixFilter.brightness(brightness, false);

		for (let obj of this.imageContainer.children) {
			let sprite = obj as PIXI.Sprite;
			sprite.alpha = this.fadeInterpolators.get(sprite).getCurrentValue();
		}

		backgroundContainer.scale.set(this.scaleInterpolator.getCurrentValue());
		this.blurFilter.blur = 5 * getGlobalScalingFactor() * this.blurInterpolator.getCurrentValue();
		this.blurFilter.enabled = this.blurFilter.blur !== 0;
	}

	static resize() {
		backgroundContainer.pivot.x = window.innerWidth / 2;
		backgroundContainer.pivot.y = window.innerHeight / 2;
		backgroundContainer.position.copyFrom(backgroundContainer.pivot);

		for (let obj of this.imageContainer.children) {
			let sprite = obj as PIXI.Sprite;
			fitSpriteIntoContainer(sprite, window.innerWidth, window.innerHeight);
		}

		fitSpriteIntoContainer(this.videoSprite, window.innerWidth, window.innerHeight);
	}
}
BackgroundManager.initialize();

addRenderingTask(() => BackgroundManager.update());

uiEventEmitter.addListener('resize', () => BackgroundManager.resize());