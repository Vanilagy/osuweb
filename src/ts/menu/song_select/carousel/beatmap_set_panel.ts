import { BeatmapCarousel } from "./beatmap_carousel";
import { Interpolator } from "../../../util/interpolation";
import { EaseType, MathUtil } from "../../../util/math_util";
import { getBitmapFromImageFile, BitmapQuality } from "../../../util/image_util";
import { currentWindowDimensions } from "../../../visuals/ui";
import { BeatmapDifficultyPanel, BEATMAP_DIFFICULTY_PANEL_HEIGHT, BEATMAP_DIFFICULTY_PANEL_MARGIN } from "./beatmap_difficulty_panel";
import { Searchable, createSearchableString } from "../../../util/misc_util";
import { BeatmapSet } from "../../../datamodel/beatmap/beatmap_set";
import { BeatmapEntry } from "../../../datamodel/beatmap/beatmap_entry";

export const BEATMAP_SET_PANEL_WIDTH = 700;
export const BEATMAP_SET_PANEL_HEIGHT = 100;
export const BEATMAP_SET_PANEL_MARGIN = 10;

export class BeatmapSetPanel implements Searchable {
	public carousel: BeatmapCarousel;
	public currentNormalizedY: number;
	public beatmapSet: BeatmapSet;

	public fadeInInterpolator: Interpolator;
	public expandInterpolator: Interpolator;
	public imageFadeIn: Interpolator;
	public hoverInterpolator: Interpolator;
	public mouseDownBrightnessInterpolator: Interpolator;
	
	public beatmapEntries: BeatmapEntry[] = null;
	public difficultyPanels: BeatmapDifficultyPanel[] = [];

	public isExpanded = false;
	public imageLoadingStarted = false;
	public imageTexture: PIXI.Texture;
	public searchableString: string;
	public showStarRating = false;

	// Check the drawable for why there are two variants of each text
	public primaryTextA: string = null;
	public primaryTextB: string = null;
	public primaryTextInterpolator: Interpolator;
	public secondaryTextA: string = null;
	public secondaryTextB: string = null;
	public secondaryTextInterpolator: Interpolator;

	constructor(carousel: BeatmapCarousel, beatmapSet: BeatmapSet) {
		this.carousel = carousel;
		this.currentNormalizedY = 0;
		this.beatmapSet = beatmapSet;

		this.fadeInInterpolator = new Interpolator({
			duration: 900
		});
		this.expandInterpolator = new Interpolator({
			duration: 500,
			ease: EaseType.EaseOutCubic,
			reverseEase: EaseType.EaseInQuart,
			beginReversed: true,
			defaultToFinished: true
		});
		this.imageFadeIn = new Interpolator({
			duration: 250,
			ease: EaseType.EaseInOutSine
		});
		this.hoverInterpolator = new Interpolator({
			duration: 500,
			ease: EaseType.EaseOutCubic,
			reverseEase: EaseType.EaseInCubic,
			beginReversed: true,
			defaultToFinished: true
		});
		this.mouseDownBrightnessInterpolator = new Interpolator({
			duration: 50,
			ease: EaseType.EaseOutCubic,
			reverseEase: EaseType.EaseInCubic,
			reverseDuration: 400,
			beginReversed: true,
			defaultToFinished: true
		});
		this.primaryTextInterpolator = new Interpolator({
			duration: 400,
			ease: EaseType.EaseOutQuad,
			defaultToFinished: true
		});
		this.secondaryTextInterpolator = new Interpolator({
			duration: 400,
			ease: EaseType.EaseOutQuad,
			defaultToFinished: true
		});

		this.refresh();
	}

	setPrimaryText(text: string) {
		if (text === this.primaryTextB) return;

		if (this.primaryTextB === null) {
			this.primaryTextB = text;
		} else {
			this.primaryTextA = this.primaryTextB;
			this.primaryTextB = text;
			this.primaryTextInterpolator.start(performance.now());
		}
	}
	
	setSecondaryText(text: string) {
		if (text === this.secondaryTextB) return;

		if (this.secondaryTextB === null) {
			this.secondaryTextB = text;
		} else {
			this.secondaryTextA = this.secondaryTextB;
			this.secondaryTextB = text;
			this.secondaryTextInterpolator.start(performance.now());
		}
	}

	/** Gets the current scaling factor based on fade-in. */
	getScaleInValue(now: number) {
		return MathUtil.ease(EaseType.EaseOutElasticHalf, this.fadeInInterpolator.getCurrentValue(now));
	}

	getTotalHeight(now: number) {
		let combinedSetPanelHeight = BEATMAP_SET_PANEL_HEIGHT + BEATMAP_SET_PANEL_MARGIN;
		return combinedSetPanelHeight * this.getScaleInValue(now) + this.getAdditionalExpansionHeight(now);
	}

	getAdditionalExpansionHeight(now: number) {
		let combinedDifficultyPanelHeight = BEATMAP_DIFFICULTY_PANEL_HEIGHT + BEATMAP_DIFFICULTY_PANEL_MARGIN;
		return this.expandInterpolator.getCurrentValue(now) * combinedDifficultyPanelHeight * this.difficultyPanels.length * this.getScaleInValue(now);
	}

	setBeatmapEntries(entries: BeatmapEntry[]) {
		this.beatmapEntries = entries;
	}

	private async loadImage() {
		if (!this.beatmapSet.basicData || this.imageLoadingStarted) return;

		this.imageLoadingStarted = true;

		let imageFile = await this.beatmapSet.directory.getFileByPath(this.beatmapSet.basicData.imageName);
		if (!imageFile) return;

		let bitmap = await getBitmapFromImageFile(imageFile, BitmapQuality.Medium);
		if (bitmap) {
			this.imageTexture = PIXI.Texture.from(bitmap as any);
			this.imageFadeIn.start(performance.now());
		}
	}

	refresh() {
		let primaryText = this.beatmapSet.title + ' '; // These spaces are added because otherwise, the last letters is cut off (due to italic text). This prevents that.
		let secondaryText = this.beatmapSet.artist + ' ';
		if (this.beatmapSet.creator) secondaryText += '| ' + this.beatmapSet.creator + ' ';

		this.setPrimaryText(primaryText);
		this.setSecondaryText(secondaryText);

		this.searchableString = this.beatmapSet.searchableString;

		if (this.beatmapEntries) {
			// Add the difficulty names to the searchable string
			for (let i = 0; i < this.beatmapEntries.length; i++) {
				let entry = this.beatmapEntries[i];
				if (entry.extendedMetadata) this.searchableString += ' ' + createSearchableString([entry.extendedMetadata.version]);
			}

			// If there aren't enough difficulty panels, add some
			while (this.difficultyPanels.length < this.beatmapEntries.length) {
				this.difficultyPanels.push(new BeatmapDifficultyPanel(this));
			}
	
			// If there are too many difficulty panels, remove some
			while (this.difficultyPanels.length > this.beatmapEntries.length) {
				this.difficultyPanels.pop();
			}

			// If metadata's loaded, go assign the beatmap difficulties to the difficulty panels
			if (this.beatmapSet.metadataLoaded) {
				let sorted = this.getSortedEntries();

				for (let i = 0; i < this.difficultyPanels.length; i++) {
					let panel = this.difficultyPanels[i];
					panel.load(sorted[i]);
				}
			}
		}
	}

	update(now: number) {
		let scalingFactor = this.carousel.scalingFactor;

		// If the top of the panel is at most a full screen height away
		let isClose = this.currentNormalizedY * scalingFactor >= -currentWindowDimensions.height && this.currentNormalizedY * scalingFactor <= (currentWindowDimensions.height * 2);
		if (isClose && this.fadeInInterpolator.getCurrentValue(now) >= 0.75) {
			let velocity = this.carousel.getCurrentAbsoluteVelocity(now);

			if (velocity < 800) this.beatmapSet.loadEntries();
			if (velocity < 500) this.beatmapSet.loadMetadata();
			if (velocity < 2500) this.loadImage();
		}

		let combinedPanelHeight = BEATMAP_DIFFICULTY_PANEL_HEIGHT + BEATMAP_DIFFICULTY_PANEL_MARGIN;
		let expansionValue = this.expandInterpolator.getCurrentValue(now);

		for (let i = 0; i < this.difficultyPanels.length; i++) {
			let panel = this.difficultyPanels[i];

			// Update the position for each difficulty panel
			let y = BEATMAP_SET_PANEL_HEIGHT/2 + combinedPanelHeight * expansionValue + combinedPanelHeight * i * expansionValue;
			panel.currentNormalizedY = y;
			panel.update(now);
		}
	}

	/** Returns true iff the panel is currently visible based on its position and size. */
	isInView(now: number) {
		let height = this.getTotalHeight(now);
		return (this.currentNormalizedY + height >= 0) && ((this.currentNormalizedY - 10) * this.carousel.scalingFactor < currentWindowDimensions.height); // Subtract 10 'cause of the glow
	}

	async select(selectDifficultyIndex: number | 'random', selectionTime?: number, doSnap = true) {
		if (this.isExpanded) return;
		this.isExpanded = true;

		this.carousel.setSelectedPanel(this, false); // Don't snap to it, we'll snap later in the difficulty panel

		await this.beatmapSet.loadEntries();

		// Since the previous operation was asynchronous, it could be that this panel isn't selected anymore.
		if (this !== this.carousel.selectedPanel || this.beatmapEntries.length === 0) return;

		let now = performance.now();
		this.expandInterpolator.setReversedState(false, selectionTime ?? now);

		this.carousel.songSelect.infoPanel.loadBeatmapSet(this.beatmapSet, this.beatmapSet.basicData);
		this.carousel.songSelect.startAudio(this.beatmapSet, this.beatmapSet.basicData);

		// Run this update function to update difficulty panel positions
		this.update(now);

		// Select the difficult panel at the corresponding index
		selectDifficultyIndex = (selectDifficultyIndex === 'random') ? Math.floor(Math.random() * this.difficultyPanels.length) : MathUtil.clamp(selectDifficultyIndex, 0, this.difficultyPanels.length-1);
		this.difficultyPanels[selectDifficultyIndex].select(doSnap, selectionTime);

		await this.beatmapSet.loadMetadata();
	}

	/** Gets this panel's beatmap entries sorted by star rating. */
	getSortedEntries() {
		return this.beatmapEntries.slice().sort((a, b) => a.extendedMetadata.difficultyAttributes.starRating - b.extendedMetadata.difficultyAttributes.starRating);
	}

	collapse() {
		if (!this.isExpanded) return;

		let currentlySelectedDifficultyPanel = this.carousel.selectedDifficultyPanel;
		if (currentlySelectedDifficultyPanel) {
			currentlySelectedDifficultyPanel.deselect();
			this.carousel.selectedDifficultyPanel = null;
		}

		this.expandInterpolator.setReversedState(true, performance.now());
		this.isExpanded = false;
	}

	/** Changes the selected difficulty in this panel by going forward or backward one. */
	skip(forward = true) {
		let index = this.difficultyPanels.indexOf(this.carousel.selectedDifficultyPanel);
		if (index === -1) return;

		let nextIndex = index + (forward? 1 : -1);
		if (nextIndex < 0 || nextIndex >= this.difficultyPanels.length) return false;

		this.difficultyPanels[nextIndex].select(true);
		return true;
	}
}