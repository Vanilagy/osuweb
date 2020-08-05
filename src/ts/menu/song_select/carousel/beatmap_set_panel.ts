import { Interpolator } from "../../../util/interpolation";
import { EaseType, MathUtil } from "../../../util/math_util";
import { getBitmapFromImageFile, BitmapQuality, hasBitmapFromImageFile } from "../../../util/image_util";
import { currentWindowDimensions } from "../../../visuals/ui";
import { BeatmapDifficultyPanel, BEATMAP_DIFFICULTY_PANEL_HEIGHT, BEATMAP_DIFFICULTY_PANEL_MARGIN } from "./beatmap_difficulty_panel";
import { Searchable, createSearchableString } from "../../../util/misc_util";
import { BeatmapSet } from "../../../datamodel/beatmap/beatmap_set";
import { BeatmapEntry } from "../../../datamodel/beatmap/beatmap_entry";
import { BeatmapSetPanelCollection } from "./beatmap_set_panel_collection";
import { BEATMAP_SET_PANEL_SNAP_TARGET } from "./beatmap_carousel";

export const BEATMAP_SET_PANEL_WIDTH = 700;
export const BEATMAP_SET_PANEL_HEIGHT = 100;
export const BEATMAP_SET_PANEL_MARGIN = 10;

/** For each beatmap set, remember if there has already been a panel that has loaded and displayed the image for that set. */
const imageLoadedForBeatmapSet = new WeakMap<BeatmapSet, boolean>();

export class BeatmapSetPanel implements Searchable {
	static readonly BASE_HEIGHT = BEATMAP_SET_PANEL_HEIGHT + BEATMAP_SET_PANEL_MARGIN;

	public collection: BeatmapSetPanelCollection;
	/** The order number of this panel in the panel array it belongs to. These aren't necessarily integers, but they monotonically increase as index increases in the array, thus meaning: arr == arr.sort(by order). The reason this field isn't "index" is that, when panel insertion happens, that would require shifting a lot of indices forwards, which we want to avoid. */
	public order: number = 0;
	/** The y-position assigned by the carousel's update loop. Will only be accurate as long as the panel is being updated. */
	public storedY: number = 0;
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
	public imageTexture: PIXI.Texture = null;
	public searchableString: string = null;
	public showStarRating = false;
	/** If the panel currently doesn't have the base height (maybe it's extended), then this is true. */
	public hasSpecialHeight = false;

	// Check the drawable for why there are two variants of each text
	public primaryTextA: string = null;
	public primaryTextB: string = null;
	public primaryTextInterpolator: Interpolator;
	public secondaryTextA: string = null;
	public secondaryTextB: string = null;
	public secondaryTextInterpolator: Interpolator;

	get carousel() {
		return this.collection.carousel;
	}

	/** The y-position of this panel. */
	computeY() {
		return this.carousel.getPanelPosition(this, performance.now());
	}

	constructor(collection: BeatmapSetPanelCollection, beatmapSet: BeatmapSet) {
		this.collection = collection;
		this.beatmapSet = beatmapSet;

		this.fadeInInterpolator = new Interpolator({
			duration: 900,
			reverseDuration: 750
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

	enableSpecialHeight() {
		this.hasSpecialHeight = true;
		this.collection.specialHeightPanels.add(this);
	}

	/** Gets the current scaling factor based on fade-in. */
	getScaleInValue(now: number) {
		let fadingOut = this.fadeInInterpolator.isReversed();
		return MathUtil.ease(fadingOut? EaseType.EaseInQuint : EaseType.EaseOutElasticHalf, this.fadeInInterpolator.getCurrentValue(now));
	}

	getTotalHeight(now: number) {
		let combinedSetPanelHeight = BEATMAP_SET_PANEL_HEIGHT + BEATMAP_SET_PANEL_MARGIN;
		return combinedSetPanelHeight * this.getScaleInValue(now) + this.getAdditionalExpansionHeight(now);
	}

	getAdditionalExpansionHeight(now: number) {
		let combinedDifficultyPanelHeight = BEATMAP_DIFFICULTY_PANEL_HEIGHT + BEATMAP_DIFFICULTY_PANEL_MARGIN;
		return this.expandInterpolator.getCurrentValue(now) * combinedDifficultyPanelHeight * this.difficultyPanels.length * this.getScaleInValue(now);
	}

	hasBaseHeight(now: number) {
		return this.fadeInInterpolator.isCompleted(now) && !this.fadeInInterpolator.isReversed() && this.expandInterpolator.isReversed() && this.expandInterpolator.isCompleted(now);
	}

	setBeatmapEntries(entries: BeatmapEntry[]) {
		this.beatmapEntries = entries;
	}

	private async loadImage(carouselVelocity: number) {
		if (!this.beatmapSet.basicData || this.imageLoadingStarted) return;		

		// Check if the image bitmap has already been loaded
		let bitmapLoadedAlready = imageLoadedForBeatmapSet.get(this.beatmapSet);
		let bitmap: ImageBitmap;

		if (bitmapLoadedAlready || carouselVelocity < 2500) {
			this.imageLoadingStarted = true;

			let imageFile = await this.beatmapSet.getBackgroundImage();
			if (!imageFile) return;

			bitmap = await getBitmapFromImageFile(imageFile, BitmapQuality.Medium);

			if (bitmap) {
				this.imageTexture = PIXI.Texture.from(bitmap as any);

				// If the bitmap has already been loaded, play no animation.
				if (!bitmapLoadedAlready) {
					this.imageFadeIn.start(performance.now());
					imageLoadedForBeatmapSet.set(this.beatmapSet, true);
				} else {
					this.imageFadeIn.end();
				}
			}
		}
	}

	refresh() {
		let primaryText = this.beatmapSet.title + ' '; // These spaces are added because otherwise, the last letter is cut off (due to italic text). This prevents that.
		let secondaryText = this.beatmapSet.artist + ' ';
		if (this.beatmapSet.creator) secondaryText += '| ' + this.beatmapSet.creator + ' ';

		this.setPrimaryText(primaryText);
		this.setSecondaryText(secondaryText);

		this.searchableString = this.beatmapSet.searchableString;

		if (this.beatmapEntries) {
			// Add the difficulty names to the searchable string
			for (let i = 0; i < this.beatmapEntries.length; i++) {
				let entry = this.beatmapEntries[i];
				if (entry.version) this.searchableString += ' ' + createSearchableString([entry.version]);
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
		let isClose = this.storedY * scalingFactor >= -currentWindowDimensions.height && this.storedY * scalingFactor <= (currentWindowDimensions.height * 2);
		if (isClose && this.fadeInInterpolator.getCurrentValue(now) >= 0.75) {
			let velocity = this.carousel.getCurrentAbsoluteVelocity(now);

			this.loadImage(velocity);
			if (velocity < 800) this.beatmapSet.loadEntries();
			if (velocity < 500) this.beatmapSet.loadMetadata();
		}

		let combinedPanelHeight = BEATMAP_DIFFICULTY_PANEL_HEIGHT + BEATMAP_DIFFICULTY_PANEL_MARGIN;
		let expansionValue = this.expandInterpolator.getCurrentValue(now);

		for (let i = 0; i < this.difficultyPanels.length; i++) {
			let panel = this.difficultyPanels[i];

			// Update the position for each difficulty panel
			let y = BEATMAP_SET_PANEL_HEIGHT/2 + combinedPanelHeight * expansionValue + combinedPanelHeight * i * expansionValue;
			panel.y = y;
			panel.update(now);
		}
	}

	/** Returns true iff the panel is currently visible based on its position and size. */
	isInView(now: number) {
		let height = this.getTotalHeight(now);
		return (this.storedY + height >= 0) && ((this.storedY - 10) * this.carousel.scalingFactor < currentWindowDimensions.height); // Subtract 10 'cause of the glow
	}

	async select(selectDifficultyIndex: number | 'random', selectionTime?: number, doSnap = true) {
		if (this.isExpanded) return;
		this.isExpanded = true;

		// If entries haven't loaded yet, we choose to jump to this panel (to avoid delays). If they have loaded, we jump to the difficulty panel instead.
		let snapToDifficultyPanel = this.beatmapSet.entriesLoaded;

		this.carousel.setSelectedPanel(this, !snapToDifficultyPanel && doSnap); // Don't snap to it, we'll snap later in the difficulty panel
		if (!snapToDifficultyPanel && doSnap) this.carousel.snapReferencePanelPosition(this.computeY(), BEATMAP_SET_PANEL_SNAP_TARGET);

		await this.beatmapSet.loadEntries();

		// Since the previous operation was asynchronous, it could be that this panel isn't selected anymore.
		if (this !== this.carousel.selectedPanel || this.beatmapEntries.length === 0 || this.beatmapSet.defective) return;

		let now = performance.now();
		this.expandInterpolator.setReversedState(false, selectionTime ?? now);
		this.enableSpecialHeight();

		this.carousel.songSelect.infoPanel.loadBeatmapSet(this.beatmapSet, this.beatmapSet.basicData);

		// Run this update function to update difficulty panel positions
		this.update(now);

		// Select the difficult panel at the corresponding index
		selectDifficultyIndex = (selectDifficultyIndex === 'random') ? Math.floor(Math.random() * this.difficultyPanels.length) : MathUtil.clamp(selectDifficultyIndex, 0, this.difficultyPanels.length-1);
		this.difficultyPanels[selectDifficultyIndex].select(snapToDifficultyPanel && doSnap, snapToDifficultyPanel, selectionTime);

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

		this.difficultyPanels[nextIndex].select(true, true);
		return true;
	}

	startFadeIn(now: number) {
		this.fadeInInterpolator.start(now);
		this.enableSpecialHeight();
	}

	startFadeOut(now: number) {
		this.fadeInInterpolator.setReversedState(true, now);
		this.enableSpecialHeight();
	}
}