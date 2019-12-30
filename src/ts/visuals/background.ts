import { Interpolator } from "../util/graphics_util";
import { EaseType, MathUtil } from "../util/math_util";
import { addRenderingTask } from "./rendering";

const IMAGE_FADE_IN_DURATION = 333; // In ms

const beatmapBackgroundElement: HTMLDivElement = document.querySelector('#beatmap-background');
const imageContainer: HTMLDivElement = beatmapBackgroundElement.querySelector('._images');
const videoContainer: HTMLVideoElement = beatmapBackgroundElement.querySelector('._video');

export enum BackgroundState {
	None,
	SongSelect,
	Gameplay
}

export abstract class BackgroundManager {
	private static state: BackgroundState = BackgroundState.None;
	private static currentImageSource: string = null;
	private static markedForDeletionImages: WeakSet<Element> = new WeakSet();
	private static currentGameplayBrightness: number = 1.0;
	private static gameplayInterpolator: Interpolator = new Interpolator({
		from: 0.0,
		to: 1.0,
		ease: EaseType.EaseInOutQuad,
		duration: 1000,
		defaultToFinished: false
	});
	private static blurInterpolator: Interpolator = new Interpolator({
		from: 0.0,
		to: 1.0,
		ease: EaseType.EaseInOutSine,
		duration: 500,
		defaultToFinished: false
	});

	static initialize() {
		this.setState(BackgroundState.SongSelect);

		this.gameplayInterpolator.start();
		this.gameplayInterpolator.reverse();
		this.blurInterpolator.start();
		this.blurInterpolator.reverse();
	}

	static setState(newState: BackgroundState) {
		if (newState === this.state) return;

		if (newState === BackgroundState.SongSelect) {
			//beatmapBackgroundElement.classList.add('blurred');
			beatmapBackgroundElement.style.transform = 'scale(1.06)';

			if (this.state === BackgroundState.Gameplay) {
				this.gameplayInterpolator.reverse();
				this.blurInterpolator.reverse();
			}
		} else if (newState === BackgroundState.Gameplay) {
			//beatmapBackgroundElement.classList.remove('blurred');
			beatmapBackgroundElement.style.transform = 'scale(1.0)';

			if (this.state === BackgroundState.SongSelect) {
				this.gameplayInterpolator.reverse();
				this.blurInterpolator.reverse();
			}
		}

		this.state = newState;
	}

	static setImage(src: string) {
		if (src === this.currentImageSource) return;
		this.currentImageSource = src;

		let imageElement = new Image();
		imageElement.src = src;
		imageElement.onload = () => {
			for (let elem of imageContainer.children) {
				if (this.markedForDeletionImages.has(elem)) continue;

				this.markedForDeletionImages.add(elem);
				setTimeout(() => imageContainer.removeChild(elem), IMAGE_FADE_IN_DURATION);
			}

			// The reason for wrapping the image into a div here is that without it, there's some weird blur artifact upon animation, probably caused by the way the browser renders the layers. The wrapping fixed it.
			let container = document.createElement('div');
			container.appendChild(imageElement);
			imageContainer.appendChild(container);

			container.style.animation = `fade-in ${IMAGE_FADE_IN_DURATION}ms forwards`;
		};
	}

	/** Returns a Promise that resolves once the video is ready for playback. */
	static setVideo(src: string): Promise<void> {
		if (videoContainer.src === src) return Promise.resolve();
		
		videoContainer.src = src;
		videoContainer.style.display = 'block';

		return new Promise((resolve) => {
			videoContainer.addEventListener('canplaythrough', () => resolve());
		});
	}

	static removeVideo() {
		videoContainer.pause();
		videoContainer.src = '';
		videoContainer.style.display = 'none';
	}

	static setVideoOpacity(opacity: number) {
		videoContainer.style.opacity = opacity.toString();
	}

	static playVideo() {
		videoContainer.play();
	}

	static videoIsPaused() {
		return videoContainer.paused;
	}

	static getVideoCurrentTime() {
		return videoContainer.currentTime;
	}

	static setVideoCurrentTime(time: number) {
		videoContainer.currentTime = time;
	}

	static setVideoPlaybackRate(time: number) {
		videoContainer.playbackRate = time;
	}

	static setGameplayBrightness(newBrightness: number) {
		this.currentGameplayBrightness = newBrightness;
	}

	static update() {
		let t = this.gameplayInterpolator.getCurrentValue();
		let brightness = MathUtil.lerp(0.75, this.currentGameplayBrightness, t);

		beatmapBackgroundElement.style.filter = `brightness(${brightness})`;

		// The blur is animated manually because of CSS animation artifacts that I wanted to avoid.
		for (let i = 0; i < imageContainer.children.length; i++) {
			(imageContainer.children[i].children[0] as HTMLElement).style.filter = `blur(${(1 - this.blurInterpolator.getCurrentValue()) * 0.8}vmax)`;
		}
	}
}
BackgroundManager.initialize();

addRenderingTask(() => BackgroundManager.update());