import { songSelectContainer, loadedBeatmapSets, songSelectInteractionGroup } from "./song_select";
import { currentWindowDimensions } from "../../visuals/ui";
import { inputEventEmitter } from "../../input/input";
import { textInputEventEmitter, TextInputStorage } from "../../input/text_input";
import { BeatmapSet } from "../../datamodel/beatmap_set";
import { createCarouselFromBeatmapSets, beatmapCarouselSortingTypes, defaultBeatmapCarouselSortingType } from "./beatmap_carousel";
import { OverridableDelay } from "../../util/misc_util";
import { getBeatmapInfoPanelScalingFactor } from "./beatmap_info_panel";
import { createPolygonTexture } from "../../util/pixi_util";
import { TabSelector } from "../components/tab_selector";
import { addRenderingTask } from "../../visuals/rendering";
import { Interactivity } from "../../input/interactivity";

const SEARCH_BAR_WIDTH = 530;
const SEARCH_BAR_HEIGHT = 49;
const TEXT_BACKGROUND_HEIGHT = 20;
const EMPTY_SEARCH_PLACEHOLDER = "type to search";

let searchBar: SearchBar = null;
let searchBarInteractionGroup = Interactivity.createGroup();
searchBarInteractionGroup.setZIndex(3);

export function initSearchBar() {
	songSelectInteractionGroup.add(searchBarInteractionGroup);
    searchBar = new SearchBar();
    songSelectContainer.addChild(searchBar.container);

    updateSearchBarSizing();
}

export function updateSearchBarSizing() {
	if (!searchBar) return;
	
	searchBar.resize();

	searchBar.container.y = 0;
	searchBar.container.x = currentWindowDimensions.width - Math.floor(SEARCH_BAR_WIDTH * getBeatmapInfoPanelScalingFactor());
}

addRenderingTask((now) => {
	if (!searchBar) return;
	searchBar.update(now);
});

class SearchBar {
    public container: PIXI.Container;
    private textElement: PIXI.Text;
	private delay: OverridableDelay = new OverridableDelay();
	private textStorage: TextInputStorage;
	private background: PIXI.Sprite;
	private textBackground: PIXI.Sprite;
	private sortSelector: TabSelector;

    constructor() {
		this.container = new PIXI.Container();
		this.textStorage = new TextInputStorage();
		this.textStorage.enable();

		this.background = new PIXI.Sprite();
		this.background.tint = 0x000000;
		this.background.alpha = 0.8;
		this.container.addChild(this.background);

		this.textBackground = new PIXI.Sprite();
		this.textBackground.tint = 0x000000;
		this.textBackground.alpha = 0.5;
		this.container.addChild(this.textBackground);

		this.textElement = new PIXI.Text('');
		this.container.addChild(this.textElement);

		this.sortSelector = new TabSelector(beatmapCarouselSortingTypes, beatmapCarouselSortingTypes.indexOf(defaultBeatmapCarouselSortingType));
		this.sortSelector.addListener('selection', () => this.updateCarousel());
		searchBarInteractionGroup.add(this.sortSelector.interactionGroup);
		this.container.addChild(this.sortSelector.container);

		this.textStorage.addListener('change', () => this.onInput());
		this.onInput();

		let registration = Interactivity.registerDisplayObject(this.container);
		registration.enableEmptyListeners();
		registration.setZIndex(-1);
		searchBarInteractionGroup.add(registration);
	}

	resize() {
		let scalingFactor = getBeatmapInfoPanelScalingFactor(); // dis fine?
		let slantWidth = SEARCH_BAR_HEIGHT/5;
		let textBackgroundSlantWidth = TEXT_BACKGROUND_HEIGHT/5;

		this.background.texture = createPolygonTexture(SEARCH_BAR_WIDTH, SEARCH_BAR_HEIGHT, 
			[new PIXI.Point(0, 0), new PIXI.Point(SEARCH_BAR_WIDTH, 0), new PIXI.Point(SEARCH_BAR_WIDTH, SEARCH_BAR_HEIGHT), new PIXI.Point(slantWidth, SEARCH_BAR_HEIGHT)],
		scalingFactor);

		this.textBackground.texture = createPolygonTexture(SEARCH_BAR_WIDTH, TEXT_BACKGROUND_HEIGHT, 
			[new PIXI.Point(0, 0), new PIXI.Point(SEARCH_BAR_WIDTH, 0), new PIXI.Point(SEARCH_BAR_WIDTH, TEXT_BACKGROUND_HEIGHT), new PIXI.Point(textBackgroundSlantWidth, TEXT_BACKGROUND_HEIGHT)],
		scalingFactor);

		this.textBackground.x = Math.floor(15 * scalingFactor);
		this.textBackground.y = Math.floor(7 * scalingFactor);

		this.textElement.style = {
			fontFamily: 'Exo2-Light',
			fill: 0xffffff,
			fontSize: Math.floor(13 * scalingFactor),
			dropShadow: true,
			dropShadowDistance: 1,
			dropShadowBlur: 0
		};
		this.textElement.x = this.textBackground.x + Math.floor(13 * scalingFactor);
		this.textElement.y = this.textBackground.y + Math.floor(2 * scalingFactor);

		this.sortSelector.resize(scalingFactor);
		this.sortSelector.container.x = Math.floor(28 * scalingFactor);
		this.sortSelector.container.y = Math.floor(49 * scalingFactor);
	}

	update(now: number) {
		this.sortSelector.update(now);
	}
	
	private onInput() {
		if (!this.textStorage.stored) {
			this.textElement.text = EMPTY_SEARCH_PLACEHOLDER;
			this.textElement.alpha = 0.5;
		} else {
			this.textElement.text = this.textStorage.stored;
			this.textElement.alpha = 1.0;
		}

		this.delay.schedule(250, () => this.updateCarousel());
	}

	private updateCarousel() {
		let query = this.textStorage.stored.toLowerCase();
		let words = query.split(' ');

		let matching: BeatmapSet[] = [];
		for (let set of loadedBeatmapSets) {
			let matchCount = 0;

			for (let i = 0; i < words.length; i++) {
				if (set.searchableString.includes(words[i])) matchCount++;
			}

			if (matchCount === words.length) matching.push(set);
		}

		if (matching.length > 0) {
			let sort = beatmapCarouselSortingTypes[this.sortSelector.getSelectedIndex()];
			createCarouselFromBeatmapSets(matching, sort);
		}
	}
}