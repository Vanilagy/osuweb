import { EaseType, MathUtil } from "../util/math_util";
import { VirtualFile } from "../file_system/virtual_file";
import { getBitmapFromImageFile, BitmapQuality } from "../util/image_util";
import { fitSpriteIntoContainer } from "../util/pixi_util";
import { getGlobalScalingFactor, currentWindowDimensions } from "./ui";
import { Interpolator } from "../util/interpolation";

const IMAGE_FADE_IN_DURATION = 333; // In ms
const backgroundVideoElement = document.querySelector('#background-video') as HTMLVideoElement;

export class BackgroundManager {
	public container: PIXI.Container = new PIXI.Container();
	private isInGameplay: boolean = false;
	private imageContainer = new PIXI.Container();
	private videoElement: HTMLVideoElement;
	private videoOpacity = 0.0;
	private currentImageFile: VirtualFile = null;
	private markedForDeletionSprites: WeakSet<PIXI.Sprite> = new WeakSet();
	private fadeInterpolators: WeakMap<PIXI.Sprite, Interpolator> = new WeakMap();
	private currentGameplayBrightness: number = 1.0;
	private blurFilter = new PIXI.filters.KawaseBlurFilter(0);
	private colorMatrixFilter = new PIXI.filters.ColorMatrixFilter();

	private blurInterpolator: Interpolator = new Interpolator({
		beginReversed: true,
		defaultToFinished: true
	});
	private gameplayInterpolator: Interpolator = new Interpolator({
		beginReversed: true,
		defaultToFinished: true
	});

	constructor() {
		this.videoElement = backgroundVideoElement;
		this.videoElement.setAttribute('muted', '');
		this.videoElement.setAttribute('preload', 'auto');
		this.videoElement.setAttribute('webkit-playsinline', '');
		this.videoElement.setAttribute('playsinline', '');

		this.setBlurState(true, 0, EaseType.Linear);
		this.setGameplayState(false, 0, EaseType.Linear);
		this.resize();

		this.container.addChild(this.imageContainer);

		this.blurFilter.quality = 5;
		this.container.filters = [this.blurFilter, this.colorMatrixFilter];
	}

	setBlurState(on: boolean, duration: number, ease: EaseType) {
		let now = performance.now();

		this.blurInterpolator.setReversedState(!on, now);
		this.blurInterpolator.setDuration(duration, now);
		this.blurInterpolator.setEase(ease, now);
	}

	setGameplayState(isInGameplay: boolean, brightnessTransitionDuration: number, ease: EaseType) {
		let now = performance.now();
		this.isInGameplay = isInGameplay;

		this.gameplayInterpolator.setReversedState(!isInGameplay, now);
		this.gameplayInterpolator.setDuration(brightnessTransitionDuration, now);
		this.gameplayInterpolator.setEase(ease, now);
	}

	async setImage(file: VirtualFile) {
		if (this.currentImageFile === file) return;
		this.currentImageFile = file;

		let newSprite = new PIXI.Sprite();
		newSprite.visible = false;
		this.imageContainer.addChild(newSprite);

		let bitmap = await getBitmapFromImageFile(file, this.isInGameplay? BitmapQuality.High : BitmapQuality.Medium);
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
		let url = await file.readAsResourceUrl();
		if (this.videoElement.src === url) return;

		this.videoElement.src = url;

		return new Promise((resolve, reject) => {
			this.videoElement.addEventListener('error', reject);
			this.videoElement.addEventListener('canplaythrough', () => {
				resolve();
			});
		});
	}

	removeVideo() {
		this.videoElement.pause();
		this.videoElement.src = '';
		this.videoOpacity = 0.0;
	}

	setVideoOpacity(opacity: number) {
		this.videoOpacity = opacity;
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
		this.videoElement.style.opacity = brightness.toString();
		this.imageContainer.alpha = MathUtil.lerp(1.0, 1 - this.videoOpacity, t);

		for (let obj of this.imageContainer.children) {
			let sprite = obj as PIXI.Sprite;
			let interpolator = this.fadeInterpolators.get(sprite);
			if (!interpolator) continue;

			sprite.alpha = interpolator.getCurrentValue(now);
		}

		let blurValue = this.blurInterpolator.getCurrentValue(now);

		this.container.scale.set(MathUtil.lerp(1.0, 1.08, blurValue));
		this.blurFilter.blur = 5 * getGlobalScalingFactor() * blurValue;
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
	}
}