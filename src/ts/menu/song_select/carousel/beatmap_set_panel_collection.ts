import { BeatmapSetPanel } from "./beatmap_set_panel";
import { BeatmapCarousel } from "./beatmap_carousel";
import {  matchesSearchable, arraysEqualShallow, compareStrings, insertItemBinary } from "../../../util/misc_util";
import { BeatmapSet } from "../../../datamodel/beatmap/beatmap_set";

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
beatmapCarouselSortingTypeFunctions.set(BeatmapCarouselSortingType.DateAdded, (a, b) => 0);
beatmapCarouselSortingTypeFunctions.set(BeatmapCarouselSortingType.Mapper, (a, b) => compareStrings(a.beatmapSet.creatorLowerCase, b.beatmapSet.creatorLowerCase));

type BeatmapSetPanelFilter = (x: BeatmapSetPanel) => boolean;

/** Representings a collection of beatmap set panels and configurable functionality for adding, sorting and searching them. */
export abstract class BeatmapSetPanelCollection {
	protected carousel: BeatmapCarousel;

	public allPanels: BeatmapSetPanel[];
	public allPanelsSet: Set<BeatmapSetPanel>;
	public displayedPanels: BeatmapSetPanel[];
	public displayedPanelsSet: Set<BeatmapSetPanel>;

	/** Beatmap sets will be sorted according to this function. */
	protected sortingFunction: BeatmapSetPanelComparator = beatmapCarouselSortingTypeFunctions.get(BeatmapCarouselSortingType.None);
	/** Only beatmap sets passing this filter will be displayed. */
	protected filter: BeatmapSetPanelFilter = (x) => true;
	/** Only beatmap sets matching this query will be displayed. */
	protected queryWords: string[] = [];

	constructor(carousel: BeatmapCarousel) {
		this.carousel = carousel;
		this.allPanels = [];
		this.allPanelsSet = new Set();
		this.displayedPanels = [];
		this.displayedPanelsSet = new Set();
	}
	
	/** Gets called when beatmap sets change. This method is the one responsible for creating panels. */
	abstract onChange(beatmapSets: BeatmapSet[]): void;

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
				
				panel.fadeInInterpolator.start(now); // Play the fade-in animation
				insertItemBinary(this.displayedPanels, panels[i], this.sortingFunction);
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

				if (!this.displayedPanelsSet.has(panel)) {
					// If the panel wasn't being displayed before, play the fade-in animation
					panel.fadeInInterpolator.start(now);
					this.displayedPanelsSet.add(panel);
				}
			} else {
				this.displayedPanelsSet.delete(panel);
			}
		}

		this.displayedPanels.sort(this.sortingFunction);
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
}