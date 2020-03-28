import { EaseType, MathUtil } from "../util/math_util";
import { VirtualFile } from "../file_system/virtual_file";
import { BitmapQuality } from "../util/image_util";
import { getGlobalScalingFactor, currentWindowDimensions } from "./ui";
import { Interpolator } from "../util/interpolation";
import { ImageCrossfader } from "../menu/components/image_crossfader";

const backgroundVideoElement = document.querySelector('#background-video') as HTMLVideoElement;

export class BackgroundManager {
	public container: PIXI.Container = new PIXI.Container();
	
	private imageCrossfader = new ImageCrossfader();

	private videoElement: HTMLVideoElement;
	private videoOpacity = 0.0;

	private isInGameplay: boolean = false;
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

		this.container.addChild(this.imageCrossfader.container);

		this.blurFilter.quality = 5;
		this.container.filters = [this.blurFilter, this.colorMatrixFilter];

		this.setBlurState(true, 0, EaseType.Linear);
		this.setGameplayState(false, 0, EaseType.Linear);
		this.resize();
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

	getIsInGameplay() {
		return this.isInGameplay;
	}

	async setImage(file: VirtualFile, highQuality = false) {
		await this.imageCrossfader.loadImage(file, highQuality? BitmapQuality.High : BitmapQuality.Medium);
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
		this.imageCrossfader.container.alpha = MathUtil.lerp(1.0, 1 - this.videoOpacity, t);

		this.imageCrossfader.update(now);

		let blurValue = this.blurInterpolator.getCurrentValue(now);

		this.container.scale.set(MathUtil.lerp(1.0, 1.08, blurValue));
		this.blurFilter.blur = 5 * getGlobalScalingFactor() * blurValue;
		this.blurFilter.enabled = this.blurFilter.blur !== 0;
	}

	resize() {
		this.container.pivot.x = currentWindowDimensions.width / 2;
		this.container.pivot.y = currentWindowDimensions.height / 2;
		this.container.position.copyFrom(this.container.pivot);

		this.imageCrossfader.resize(currentWindowDimensions.width, currentWindowDimensions.height);
	}
}