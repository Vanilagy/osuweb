import { EaseType, MathUtil } from "../util/math_util";
import { addRenderingTask } from "./rendering";
import { VirtualFile } from "../file_system/virtual_file";
import { getBitmapFromImageFile, BitmapQuality } from "../util/image_util";
import { fitSpriteIntoContainer } from "../util/pixi_util";
import { uiEventEmitter, getGlobalScalingFactor, currentWindowDimensions } from "./ui";
import { last } from "../util/misc_util";
import { Interpolator } from "../util/interpolation";

const IMAGE_FADE_IN_DURATION = 333; // In ms

export enum BackgroundState {
	None,
	SongSelect,
	Gameplay
}

export class BackgroundManager {
	public container: PIXI.Container = new PIXI.Container();
	private state: BackgroundState = BackgroundState.None;
	private imageContainer = new PIXI.Container();
	private videoElement = document.createElement('video');
	private videoSprite: PIXI.Sprite;
	private currentImageFile: VirtualFile = null;
	private currentVideoFile: VirtualFile = null;
	private markedForDeletionSprites: WeakSet<PIXI.Sprite> = new WeakSet();
	private fadeInterpolators: WeakMap<PIXI.Sprite, Interpolator> = new WeakMap();
	private currentGameplayBrightness: number = 1.0;
	private blurFilter = new PIXI.filters.KawaseBlurFilter(0);
	private colorMatrixFilter = new PIXI.filters.ColorMatrixFilter();
	private gameplayInterpolator: Interpolator = new Interpolator({
		ease: EaseType.EaseInOutQuad,
		duration: 1000
	});
	private blurInterpolator: Interpolator = new Interpolator({
		from: 1,
		to: 0,
		ease: EaseType.EaseInOutSine,
		duration: 500
	});
	private scaleInterpolator: Interpolator = new Interpolator({
		from: 1.08,
		to: 1.0,
		duration: 700,
		ease: EaseType.EaseOutCubic,
		reverseEase: EaseType.EaseInCubic
	});

	constructor() {
		this.videoElement.setAttribute('muted', '');
		this.videoElement.setAttribute('preload', 'auto');
		this.videoElement.setAttribute('webkit-playsinline', '');
		this.videoElement.setAttribute('playsinline', '');

		let videoTex = PIXI.Texture.from(this.videoElement);
		this.videoSprite = new PIXI.Sprite(videoTex);
		(videoTex.baseTexture.resource as any).autoPlay = false;

		this.setState(BackgroundState.SongSelect);
		this.resize();

		this.container.addChild(this.imageContainer, this.videoSprite);

		this.blurFilter.quality = 5;
		this.container.filters = [this.blurFilter, this.colorMatrixFilter];
	}

	async setState(newState: BackgroundState) {
		if (newState === this.state) return;

		let now = performance.now();

		if (newState === BackgroundState.SongSelect) {
			this.gameplayInterpolator.setReversedState(true, now);
			this.blurInterpolator.setReversedState(true, now);
			this.scaleInterpolator.setReversedState(true, now);
		} else if (newState === BackgroundState.Gameplay) {
			if (this.currentImageFile) {
				let fullResBitmap = await getBitmapFromImageFile(this.currentImageFile, BitmapQuality.High);
				let sprite = last(this.imageContainer.children) as PIXI.Sprite;
				sprite.texture = PIXI.Texture.from(fullResBitmap as any);
			}

			this.gameplayInterpolator.setReversedState(false, now);
			this.blurInterpolator.setReversedState(false, now);
			this.scaleInterpolator.setReversedState(false, now);
		}

		this.state = newState;
	}

	async setImage(file: VirtualFile) {
		if (this.currentImageFile === file) return;
		this.currentImageFile = file;

		let newSprite = new PIXI.Sprite();
		newSprite.visible = false;
		this.imageContainer.addChild(newSprite);

		let bitmap = await getBitmapFromImageFile(file, (this.state === BackgroundState.Gameplay)? BitmapQuality.High : BitmapQuality.Medium);
		newSprite.texture = PIXI.Texture.from(bitmap as any);
		newSprite.visible = true;
		
		fitSpriteIntoContainer(newSprite, currentWindowDimensions.width, currentWindowDimensions.height);

		for (let obj of this.imageContainer.children) {
			let sprite = obj as PIXI.Sprite;
			if (this.markedForDeletionSprites.has(sprite) || sprite === newSprite) continue;

			this.markedForDeletionSprites.add(sprite);
			setTimeout(() => this.imageContainer.removeChild(sprite), IMAGE_FADE_IN_DURATION);
		}

		let fadeInterpolator = new Interpolator({
			ease: EaseType.EaseInOutSine,
			duration: IMAGE_FADE_IN_DURATION
		});
		fadeInterpolator.start(performance.now());
		this.fadeInterpolators.set(newSprite, fadeInterpolator);
	}

	/** Returns a Promise that resolves once the video is ready for playback. */
	async setVideo(file: VirtualFile): Promise<void> {
		if (this.currentVideoFile === file) return Promise.resolve();
		this.currentVideoFile = file;

		this.videoElement.src = await file.readAsResourceUrl();

		return new Promise((resolve, reject) => {
			this.videoElement.addEventListener('error', reject);
			this.videoElement.addEventListener('canplaythrough', () => {
				fitSpriteIntoContainer(this.videoSprite, currentWindowDimensions.width, currentWindowDimensions.height);
				resolve();
			});
		});
	}

	removeVideo() {
		this.videoElement.pause();
		this.videoElement.src = '';
	}

	setVideoOpacity(opacity: number) {
		this.videoElement.style.opacity = opacity.toString();
	}

	playVideo() {
		this.videoElement.play();
	}

	pauseVideo() {
		this.videoElement.pause();
	}

	videoIsPaused() {
		return this.videoElement.paused;
	}

	getVideoCurrentTime() {
		return this.videoElement.currentTime;
	}

	setVideoCurrentTime(time: number) {
		this.videoElement.currentTime = time;
	}

	setVideoPlaybackRate(time: number) {
		this.videoElement.playbackRate = time;
	}

	setGameplayBrightness(newBrightness: number) {
		this.currentGameplayBrightness = newBrightness;
	}

	update(now: number) {
		let t = this.gameplayInterpolator.getCurrentValue(now);
		let brightness = MathUtil.lerp(0.7, this.currentGameplayBrightness, t);

		this.colorMatrixFilter.brightness(brightness, false);

		for (let obj of this.imageContainer.children) {
			let sprite = obj as PIXI.Sprite;
			let interpolator = this.fadeInterpolators.get(sprite);
			if (!interpolator) continue;

			sprite.alpha = interpolator.getCurrentValue(now);
		}

		this.container.scale.set(this.scaleInterpolator.getCurrentValue(now));
		this.blurFilter.blur = 5 * getGlobalScalingFactor() * this.blurInterpolator.getCurrentValue(now);
		this.blurFilter.enabled = this.blurFilter.blur !== 0;
	}

	resize() {
		this.container.pivot.x = currentWindowDimensions.width / 2;
		this.container.pivot.y = currentWindowDimensions.height / 2;
		this.container.position.copyFrom(this.container.pivot);

		for (let obj of this.imageContainer.children) {
			let sprite = obj as PIXI.Sprite;
			fitSpriteIntoContainer(sprite, currentWindowDimensions.width, currentWindowDimensions.height);
		}

		fitSpriteIntoContainer(this.videoSprite, currentWindowDimensions.width, currentWindowDimensions.height);
	}
}