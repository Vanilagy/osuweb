import { InteractionGroup, InteractionRegistration } from "../../input/interactivity";
import { OpenMusicPlayerButton } from "./open_music_player_button";
import { svgToTexture, createLinearGradientTexture, cutOffText, createCircleTexture } from "../../util/pixi_util";
import { ThumblessSlider } from "../components/thumbless_slider";
import { Colors } from "../../util/graphics_util";
import { THEME_COLORS } from "../../util/constants";
import { Slideshow } from "../components/slideshow";
import { globalState } from "../../global_state";
import { BeatmapSet } from "../../datamodel/beatmap/beatmap_set";
import { MathUtil, EaseType } from "../../util/math_util";
import { Interpolator } from "../../util/interpolation";
import { AudioMediaPlayer } from "../../audio/audio_media_player";
import { mediaAudioNode } from "../../audio/audio";
import { BeatmapEntry } from "../../datamodel/beatmap/beatmap_entry";
import { removeItem } from "../../util/misc_util";
import { VirtualFile } from "../../file_system/virtual_file";

const WIDTH = 300;
const HEIGHT = 200;
const THUMBNAIL_HEIGHT = 140;

const playTexture = svgToTexture(document.querySelector('#svg-player-play'), true);
const pauseTexture = svgToTexture(document.querySelector('#svg-player-pause'), true);
const skipBackTexture = svgToTexture(document.querySelector('#svg-player-skip-back'), true);
const skipForwardTexture = svgToTexture(document.querySelector('#svg-player-skip-forward'), true);

export class MusicPlayer {
	public container: PIXI.Container;
	public interactionGroup: InteractionGroup;
	private button: OpenMusicPlayerButton;

	/** The player that actually plays the audio. */
	public player: AudioMediaPlayer;
	/** All the songs. This excludes duplicate beatmap sets that represent the same song. */
	private songs: BeatmapSet[] = [];
	/** Keep track of these for a performance boost. */
	private songIdentifiers = new Set<string>();

	public background: PIXI.Sprite;

	private songTitle: PIXI.Text;
	private songArtist: PIXI.Text;

	private gradient: PIXI.Sprite;
	private slideshow: Slideshow;

	private controlButtons: MusicPlayerButton[];
	private playPauseButton: MusicPlayerButton;
	private skipBackButton: MusicPlayerButton;
	private skipForwardButton: MusicPlayerButton;
	private progressBar: ThumblessSlider;

	private currentBeatmapEntry: BeatmapEntry = null;
	private currentAudioFile: VirtualFile = null;
	/** Remember what position in the song the user has scrubbed to incase the audio was paused. */
	private scrubToValue: number = null;
	private textFadeIn: Interpolator;
	private loopingState: boolean = false;

	constructor(button: OpenMusicPlayerButton) {
		this.button = button;
		this.container = new PIXI.Container();
		this.interactionGroup = new InteractionGroup();

		let shadowFilter = new PIXI.filters.DropShadowFilter({
			rotation: 45,
			alpha: 0.25,
			quality: 10,
			pixelSize: 0.1,
		});
		this.container.filters = [shadowFilter];

		this.player = new AudioMediaPlayer(mediaAudioNode);

		this.background = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.background.tint = 0x101010;
		this.background.alpha = 0.95;
		this.container.addChild(this.background);

		let backgroundRegistration = new InteractionRegistration(this.background);
		backgroundRegistration.enableEmptyListeners(['keyDown', 'keyUp']);
		this.interactionGroup.add(backgroundRegistration);

		this.slideshow = new Slideshow();
		this.container.addChild(this.slideshow.container);

		this.gradient = new PIXI.Sprite();
		this.container.addChild(this.gradient);

		this.songTitle = new PIXI.Text("", {
			fontFamily: 'Exo2-BoldItalic',
			fill: 0xffffff
		});
		this.songArtist = new PIXI.Text("", {
			fontFamily: 'Exo2-RegularItalic',
			fill: 0xffffff
		});
		this.songTitle.anchor.set(0, 1);
		this.songArtist.anchor.set(0, 1);
		this.container.addChild(this.songTitle, this.songArtist);

		this.playPauseButton = new MusicPlayerButton(this, playTexture, () => {
			if (this.player.isPaused()) {
				if (this.scrubToValue === null) this.player.unpause();
				else this.player.start(this.scrubToValue * this.player.getDuration());

				this.scrubToValue = null;
			} else {
				this.player.pause();
			}
		});
		this.skipBackButton = new MusicPlayerButton(this, skipBackTexture, () => {
			this.skip(-1);
		});
		this.skipForwardButton = new MusicPlayerButton(this, skipForwardTexture, () => {
			this.skip(1);
		});
		this.controlButtons = [this.playPauseButton, this.skipBackButton, this.skipForwardButton];

		for (let b of this.controlButtons) {
			this.container.addChild(b.container);
			this.interactionGroup.add(b.interactionGroup);
		}

		this.progressBar = new ThumblessSlider({width: WIDTH - 30, height: 6}, false, {r: 255, g: 255, b: 255, a: 0.25}, Colors.White, THEME_COLORS.PrimaryYellow);
		this.container.addChild(this.progressBar.container);
		this.interactionGroup.add(this.progressBar.interactionGroup);

		this.progressBar.setCompletion(0.3);
		this.progressBar.addListener('finish', completion => {
			if (this.player.isPaused()) {
				this.scrubToValue = completion;
			} else {
				this.player.start(completion * this.player.getDuration());
			}
		});

		globalState.beatmapLibrary.addListener('add', (sets) => {
			for (let i = 0; i < sets.length; i++) {
				let set = sets[i];
				let songIdentifier = set.getSongIdentifier();
				if (this.songIdentifiers.has(songIdentifier)) continue; // The song is already in the player from another beatmap; skip this beatmap

				this.songs.push(set);
				this.songIdentifiers.add(songIdentifier);

				set.addListener('change', () => {
					// Update the identifier
					this.songIdentifiers.delete(songIdentifier);
					songIdentifier = set.getSongIdentifier();
					this.songIdentifiers.add(songIdentifier);
				});
			}
		});
		globalState.beatmapLibrary.addListener('remove', (set) => {
			let songIdentifier = set.getSongIdentifier();

			this.songIdentifiers.delete(songIdentifier);
			removeItem(this.songs, set);

			if (this.currentBeatmapEntry.beatmapSet === set) {
				this.stop();
				this.slideshow.put(null);
			}
		});
		globalState.beatmapLibrary.addListener('removeEntry', (entry) => {
			if (this.currentBeatmapEntry === entry) {
				this.stop();
				this.slideshow.put(null);
			}
		});

		this.textFadeIn = new Interpolator({
			duration: 500,
			ease: EaseType.EaseOutCubic,
			defaultToFinished: true
		});

		this.stop();
		this.resize();
	}

	get scalingFactor() {
		return this.button.parent.scalingFactor;
	}

	resize() {
		this.background.width = Math.floor(WIDTH * this.scalingFactor);
		this.background.height = Math.floor(HEIGHT * this.scalingFactor);

		let thumbnailHeight = Math.floor(THUMBNAIL_HEIGHT * this.scalingFactor);

		this.slideshow.resize(this.background.width, thumbnailHeight);
		this.gradient.texture = createLinearGradientTexture(this.background.width, thumbnailHeight, new PIXI.Point(0, thumbnailHeight), new PIXI.Point(0, 0), [[0, 'rgba(0,0,0,0.5)'], [0.5, 'rgba(0,0,0,0)']]);

		this.songTitle.style.fontSize = Math.floor(16 * this.scalingFactor);
		this.songArtist.style.fontSize = Math.floor(12 * this.scalingFactor);
		this.songTitle.x = this.songArtist.x = Math.floor(12 * this.scalingFactor);
		this.songTitle.y = Math.floor((THUMBNAIL_HEIGHT - 25) * this.scalingFactor);
		this.songArtist.y = Math.floor((THUMBNAIL_HEIGHT - 10) * this.scalingFactor);

		for (let b of this.controlButtons) {
			b.container.y = Math.floor((THUMBNAIL_HEIGHT + 12) * this.scalingFactor);
			b.resize();
		}

		this.playPauseButton.container.x = Math.floor(this.background.width / 2);
		let sideMargin = Math.floor(70 * this.scalingFactor);
		this.skipBackButton.container.x = this.playPauseButton.container.x - sideMargin;
		this.skipForwardButton.container.x = this.playPauseButton.container.x + sideMargin;

		this.progressBar.resize(this.scalingFactor);
		this.progressBar.container.y = Math.floor((THUMBNAIL_HEIGHT + 28) * this.scalingFactor);
		this.progressBar.container.x = Math.floor((this.container.width - this.progressBar.container.width) / 2);

		let shadowFilter = this.container.filters[0] as PIXI.filters.DropShadowFilter;
		shadowFilter.blur = 8 * this.scalingFactor;
		shadowFilter.distance = 4 * this.scalingFactor;
	}

	update(now: number, noRender: boolean) {
		if (this.player.getCurrentTime() >= this.player.getDuration() && this.currentBeatmapEntry && this.player.isPlaying() && !this.loopingState) {
			// If the song reaches the end of its playback, and there is no looping enabled, go jump to the next song.
			this.skip(1);
		}

		if (noRender) return;

		for (let b of this.controlButtons) b.update(now);

		this.progressBar.update(now);
		this.slideshow.update(now);

		if (!this.player.isPaused()) {
			let songCompletion = MathUtil.clamp(this.player.getCurrentTime() / this.player.getDuration(), 0, 1);
			this.progressBar.setCompletion(songCompletion, true);
		}

		if (!this.currentAudioFile || this.player.isPaused()) {
			this.playPauseButton.setTexture(playTexture);
		} else {
			this.playPauseButton.setTexture(pauseTexture);
		}

		if (this.currentAudioFile) {
			this.playPauseButton.enable();
			this.progressBar.container.alpha = 1.0;
			this.progressBar.interactionGroup.enable();
		} else {
			this.playPauseButton.disable();
			this.progressBar.container.alpha = 0.333;
			this.progressBar.interactionGroup.disable();
		}

		if (this.songs.length > 1) { this.skipBackButton.enable(); this.skipForwardButton.enable(); }
		else { this.skipBackButton.disable(); this.skipForwardButton.disable(); } // No need for these buttons to be active in this case

		let textFadeIn = this.textFadeIn.getCurrentValue(now);
		this.songTitle.pivot.x = MathUtil.lerp(-15 * this.scalingFactor, 0, textFadeIn);
		this.songArtist.pivot.x = MathUtil.lerp(-7.5 * this.scalingFactor, 0, textFadeIn);
		this.songTitle.alpha = this.songArtist.alpha = textFadeIn;
	}

	async playBeatmap(entry: BeatmapEntry, startTimeOverride?: number) {
		if (!entry) return;

		// Make sure the set is fully loaded
		await entry.beatmapSet.loadEntries();
		await entry.beatmapSet.loadMetadata();
		let data = entry.extendedMetadata ?? entry.beatmapSet.basicData;
		let imageFile = await entry.beatmapSet.directory.getFileByPath(data.imageName);

		if (!this.currentBeatmapEntry) {
			this.slideshow.put(imageFile);
		} else {
			let currentSongIdentifer = this.currentBeatmapEntry.beatmapSet.getSongIdentifier();
			let currentIndex = this.songs.findIndex(set => set.getSongIdentifier() === currentSongIdentifer);
			let targetSongIdentifier = entry.beatmapSet.getSongIdentifier();
			let targetIndex = this.songs.findIndex(set => set.getSongIdentifier() === targetSongIdentifier);

			// These two cases here handle wraparound:
			if (targetIndex === 0 && currentIndex+1 === this.songs.length) this.slideshow.slideRight(imageFile);
			else if (targetIndex === this.songs.length-1 && currentIndex === 0) this.slideshow.slideLeft(imageFile);
			// And these cases handle the normal case:
			else if (currentIndex < targetIndex) this.slideshow.slideRight(imageFile);
			else if (currentIndex > targetIndex) this.slideshow.slideLeft(imageFile);
			// Finally, this case happens image changes within the current song.
			else this.slideshow.put(imageFile);
		}

		this.currentBeatmapEntry = entry;

		globalState.songSelect.carousel.selectEntry(entry);
		
		let audioFile = await entry.beatmapSet.directory.getFileByPath(data.audioName);
		if (!audioFile || (this.currentAudioFile === audioFile && !this.player.isPaused())) return;

		// Update the text
		cutOffText(this.songTitle, data.title, this.background.width - 20 * this.scalingFactor);
		cutOffText(this.songArtist, data.artist, this.background.width - 20 * this.scalingFactor);
		this.textFadeIn.start(performance.now());
		
		this.currentAudioFile = audioFile;
		await this.player.loadFile(audioFile);

		this.player.start(startTimeOverride ?? 0);
		if (this.loopingState) {
			let startTime = this.currentBeatmapEntry.extendedMetadata.audioPreviewTime;
			this.player.setLoopBehavior(true, startTime);
		}

		this.scrubToValue = null;
	}

	async skip(direction: number) {
		let index: number;
		if (!this.currentBeatmapEntry) {
			// If there is nothing currently playing, play either the first or last song.
			index = (direction > 0)? 0 : -1;
		} else {
			let currentSongIdentifer = this.currentBeatmapEntry?.beatmapSet.getSongIdentifier();
			let currentIndex = this.songs.findIndex(set => set.getSongIdentifier() === currentSongIdentifer);
			index = currentIndex + direction;
		}

		index = MathUtil.adjustedMod(index, this.songs.length);
		await this.songs[index].loadEntries();
		this.playBeatmap(this.songs[index].entries[0]);
	}

	getCurrentEntry() {
		return this.currentBeatmapEntry;
	}

	pause() {
		this.player.pause();
	}

	playPause() {
		if (!this.currentAudioFile) return;

		if (this.player.isPaused()) this.player.unpause();
		else this.player.pause();
	}

	stop() {
		this.songTitle.text = "";
		this.songArtist.text = "Nothing playing.";

		this.player.stop();
		this.currentAudioFile = null;
		this.currentBeatmapEntry = null;
	}

	setLoopingState(state: boolean) {
		if (this.loopingState === state) return;
		this.loopingState = state;

		if (state) {
			if (this.currentBeatmapEntry) {
				let startTime = this.currentBeatmapEntry.extendedMetadata.audioPreviewTime;
				this.player.setLoopBehavior(true, startTime);
			}
		} else {
			this.player.setLoopBehavior(false);
		}
	}
}

const ICON_SIZE = 20;

class MusicPlayerButton {
	private parent: MusicPlayer;
	public container: PIXI.Container;
	public interactionGroup: InteractionGroup;

	private background: PIXI.Sprite;
	private icon: PIXI.Sprite;

	private hoverInterpolator: Interpolator;
	private pressdownInterpolator: Interpolator;

	constructor(parent: MusicPlayer, texture: PIXI.Texture, onclick: Function) {
		this.parent = parent;
		this.container = new PIXI.Container();
		this.interactionGroup = new InteractionGroup();

		this.background = new PIXI.Sprite();
		this.container.addChild(this.background);

		this.icon = new PIXI.Sprite(texture);
		this.container.addChild(this.icon);

		let registration = new InteractionRegistration(this.container);
		registration.addButtonHandlers(
			() => onclick(),
			() => this.hoverInterpolator.setReversedState(false, performance.now()),
			() => this.hoverInterpolator.setReversedState(true, performance.now()),
			() => this.pressdownInterpolator.setReversedState(false, performance.now()),
			() => this.pressdownInterpolator.setReversedState(true, performance.now())
		);
		this.interactionGroup.add(registration);

		this.hoverInterpolator = new Interpolator({
			duration: 150,
			ease: EaseType.EaseOutCubic,
			reverseEase: EaseType.EaseInCubic,
			reverseDuration: 400,
			beginReversed: true,
			defaultToFinished: true
		});
		this.pressdownInterpolator = new Interpolator({
			duration: 50,
			ease: EaseType.EaseOutCubic,
			reverseEase: EaseType.EaseInCubic,
			reverseDuration: 400,
			beginReversed: true,
			defaultToFinished: true
		});
	}

	setTexture(tex: PIXI.Texture) {
		this.icon.texture = tex;
	}

	resize() {
		let scaledIconSize = Math.floor(ICON_SIZE * this.parent.scalingFactor);

		this.icon.width = this.icon.height = scaledIconSize;
		this.container.pivot.set(Math.floor(ICON_SIZE * this.parent.scalingFactor / 2), 0);

		this.background.texture = createCircleTexture(18 * this.parent.scalingFactor);
		this.background.x = this.container.pivot.x;
		this.background.y = this.container.pivot.x;
		this.background.pivot.x = Math.floor(this.background.width / 2);
		this.background.pivot.y = Math.floor(this.background.width / 2);
	}

	update(now: number) {
		let hoverValue = this.hoverInterpolator.getCurrentValue(now);
		let pressdownValue = this.pressdownInterpolator.getCurrentValue(now);

		this.background.alpha = MathUtil.lerp(MathUtil.lerp(0, 0.1, hoverValue), 0.2, pressdownValue);
	}

	enable() {
		this.interactionGroup.enable();
		this.container.alpha = 1;
	}

	disable() {
		this.interactionGroup.releaseAllPresses();
		this.interactionGroup.disable();
		this.container.alpha = 0.333;
	}
}