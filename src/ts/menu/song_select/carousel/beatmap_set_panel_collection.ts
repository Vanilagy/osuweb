import { BeatmapSetPanel } from "./beatmap_set_panel";
import { BeatmapCarousel } from "./beatmap_carousel";
import {  matchesSearchable, arraysEqualShallow, compareStrings, insertItemBinary, removeItem } from "../../../util/misc_util";
import { BeatmapSet } from "../../../datamodel/beatmap/beatmap_set";
import { BeatmapEntry } from "../../../datamodel/beatmap/beatmap_entry";

export enum BeatmapCarouselSortingType {
	None = "",
	Title = "Title",
	Artist = "Artist",
	Difficulty = "Difficulty",
	Length = "Length",
	DateAdded = "Date Added",
	Mapper = "Mapper"
}
export let beatmapCarouselSortingTypes = [BeatmapCarouselSortingType.Title, BeatmapCarouselSortingType.Artist, BeatmapCarouselSortingType.Difficulty, BeatmapCarouselSortingType.Length, BeatmapCarouselSortingType.DateAdded, BeatmapCarouselSortingType.Mapper];
export let defaultBeatmapCarouselSortingType = BeatmapCarouselSortingType.Title;

type BeatmapSetPanelComparator = (a: BeatmapSetPanel, b: BeatmapSetPanel) => number;
export let beatmapCarouselSortingTypeFunctions = new Map<BeatmapCarouselSortingType, BeatmapSetPanelComparator>();
beatmapCarouselSortingTypeFunctions.set(BeatmapCarouselSortingType.None, (a, b) => 0);
beatmapCarouselSortingTypeFunctions.set(BeatmapCarouselSortingType.Title, (a, b) => compareStrings(a.beatmapSet.titleLowerCase, b.beatmapSet.titleLowerCase));
beatmapCarouselSortingTypeFunctions.set(BeatmapCarouselSortingType.Artist, (a, b) => compareStrings(a.beatmapSet.artistLowerCase, b.beatmapSet.artistLowerCase));
beatmapCarouselSortingTypeFunctions.set(BeatmapCarouselSortingType.Difficulty, (a, b) => a.beatmapEntries[0].extendedMetadata.difficultyAttributes.starRating - b.beatmapEntries[0].extendedMetadata.difficultyAttributes.starRating);
beatmapCarouselSortingTypeFunctions.set(BeatmapCarouselSortingType.Length, (a, b) => a.beatmapEntries[0].extendedMetadata.playableLength - b.beatmapEntries[0].extendedMetadata.playableLength);
beatmapCarouselSortingTypeFunctions.set(BeatmapCarouselSortingType.DateAdded, (a, b) => b.beatmapSet.creationTime - a.beatmapSet.creationTime); // New ones first
beatmapCarouselSortingTypeFunctions.set(BeatmapCarouselSortingType.Mapper, (a, b) => compareStrings(a.beatmapSet.creatorLowerCase, b.beatmapSet.creatorLowerCase));

type BeatmapSetPanelFilter = (x: BeatmapSetPanel) => boolean;

/** Represents a collection of beatmap set panels and configurable functionality for adding, sorting and searching them. */
export abstract class BeatmapSetPanelCollection {
	public carousel: BeatmapCarousel;

	public allPanels: BeatmapSetPanel[];
	public allPanelsSet: Set<BeatmapSetPanel>;
	public displayedPanels: BeatmapSetPanel[];
	public displayedPanelsSet: Set<BeatmapSetPanel>;
	/** A set of panels that currently don't have the normal base height. */
	public specialHeightPanels: Set<BeatmapSetPanel>;

	/** Beatmap sets will be sorted according to this function. */
	protected sortingFunction: BeatmapSetPanelComparator = beatmapCarouselSortingTypeFunctions.get(BeatmapCarouselSortingType.None);
	/** Only beatmap sets passing this filter will be displayed. */
	protected filter: BeatmapSetPanelFilter = (x) => true;
	/** Only beatmap sets matching this query will be displayed. */
	protected queryWords: string[] = [];

	protected removalQueue: BeatmapSetPanel[];

	constructor(carousel: BeatmapCarousel) {
		this.carousel = carousel;
		this.allPanels = [];
		this.allPanelsSet = new Set();
		this.displayedPanels = [];
		this.displayedPanelsSet = new Set();
		this.specialHeightPanels = new Set();
		this.removalQueue = [];
	}
	
	/** Gets called when beatmap sets change. This method is the one responsible for creating panels. */
	abstract onChange(beatmapSets: BeatmapSet[]): void;

	/** Gets called when a beatmap set is removed. This method is responsible for removing the corresponding panels. */
	abstract remove(beatmapSet: BeatmapSet): void;

	/** Gets called with a beatmap entry is removed. This method is responsible for removing the corresponding difficulty and/or beatmap set panels. */
	abstract removeEntry(beatmapEntry: BeatmapEntry): void;

	getPanelsByBeatmapSet(beatmapSet: BeatmapSet) {
		let panels: BeatmapSetPanel[] = [];

		// A linear search is still fast enough for this
		for (let i = 0; i < this.displayedPanels.length; i++) {
			let panel = this.displayedPanels[i];
			if (panel.beatmapSet === beatmapSet) panels.push(panel);
		}

		return panels;
	}
	
	displayPanels(panels: BeatmapSetPanel[]) {
		let now = performance.now();

		// Add new panels to the 'allPanels' array
		for (let i = 0; i < panels.length; i++) {
			let panel = panels[i];
			if (this.allPanelsSet.has(panel)) continue;

			this.allPanels.push(panel);
			this.allPanelsSet.add(panel);
		}

		// Quick note! Regarding sorting order, it could be the case that the sorting order of two elements changes while they're visible (more metadata gets loaded, etc.). Technically, we would need to resort those elements, but that would cause random teleporting of panels that could be confusing. So we pull a more "eventually-consistent" approach by saying "Look, we won't sort them now since the order is *almost* right anyway, and we'll sort them the next time the user queries a command that triggers a sort."
		
		if (panels.length < 128) {
			// If we're adding just a few panels, it is faster to insert them manually instead of adding them naively and just resorting the whole thing.

			for (let i = 0; i < panels.length; i++) {
				let panel = panels[i];
				if (this.displayedPanelsSet.has(panel)) continue;
				if (!matchesSearchable(panel, this.queryWords)) continue;
				if (!this.filter(panel)) continue;

				let index = insertItemBinary(this.displayedPanels, panels[i], this.sortingFunction);
				if (this.displayedPanels.length === 1) {
					// If the panel is the only panel, give it order 0
					panel.order = 0;
				} else if (index === 0) {
					// If it's the first panel, give it an order lower than the next panel
					panel.order = this.displayedPanels[1].order - 0x10000;
				} else if (index === this.displayedPanels.length-1) {
					// If it's the last panel, give it an order higher than the previous panel
					panel.order = this.displayedPanels[this.displayedPanels.length-2].order + 0x10000;
				} else {
					// If it's in between two panels, assign the order to be in the middle of the surrounding order values.
					let lower = this.displayedPanels[index-1].order;
					let upper = this.displayedPanels[index+1].order;

					let middle = lower + (upper - lower)/2;
					if (middle === lower || middle === upper) {
						// Some of these values can get extremely close. If lower was 1.5, and upper was 1.5000000000000001, then their middle would be 1.5, meaning we wouldn't get a distinct order value. In this case, which is extremely rare but CAN happen for large sets of beatmaps, we choose to instead redetermine the order from scratch for all panels.
						this.redetermineDisplayedPanels();
						break;
					} else {
						panel.order = middle;
					}
				}
				
				panel.startFadeIn(now); // Play the fade-in animation
				this.displayedPanelsSet.add(panel);
			}
		} else {
			this.redetermineDisplayedPanels();
		}
	}

	/** Recalculates the displayed panels from scratch based on current sorting, filter and search query. */
	redetermineDisplayedPanels() {
		let now = performance.now();
		this.displayedPanels.length = 0; // Clear the array; we'll repopulate it here

		for (let i = 0; i < this.allPanels.length; i++) {
			let panel = this.allPanels[i];

			if (matchesSearchable(panel, this.queryWords) && this.filter(panel)) {
				this.displayedPanels.push(panel);
				if (panel.hasSpecialHeight) this.specialHeightPanels.add(panel);

				if (!this.displayedPanelsSet.has(panel)) {
					// If the panel wasn't being displayed before, play the fade-in animation
					panel.startFadeIn(now);
					this.displayedPanelsSet.add(panel);
				}
			} else {
				this.displayedPanelsSet.delete(panel);
			}
		}

		this.displayedPanels.sort(this.sortingFunction);

		// Assign order values
		for (let i = 0; i < this.displayedPanels.length; i++) {
			this.displayedPanels[i].order = i;
		}
	}

	update(now: number) {
		// Remove panels whose fade out animation has completed
		for (let panel of this.removalQueue) {
			if (panel.fadeInInterpolator.getCurrentValue(now) === 0) {
				removeItem(this.displayedPanels, panel);
				this.displayedPanelsSet.delete(panel);

				removeItem(this.removalQueue, panel);
				this.specialHeightPanels.delete(panel);
			}
		}
	}

	setSortingFunction(func: BeatmapSetPanelComparator) {
		if (this.sortingFunction === func) return;
		this.sortingFunction = func;
	}

	setSearchQuery(query: string) {
		let newWords = query.split(' ');
		if (arraysEqualShallow(newWords, this.queryWords)) return;

		this.queryWords = newWords;
	}

	setFilter(func: BeatmapSetPanelFilter) {
		this.filter = func;
	}

	removePanel(panel: BeatmapSetPanel) {
		removeItem(this.allPanels, panel);
		this.allPanelsSet.delete(panel);

		panel.startFadeOut(performance.now());
		this.removalQueue.push(panel);

		this.carousel.onPanelRemove(panel);
	}
}