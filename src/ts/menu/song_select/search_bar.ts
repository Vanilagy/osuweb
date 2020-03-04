import { currentWindowDimensions, REFERENCE_SCREEN_HEIGHT } from "../../visuals/ui";
import { inputEventEmitter } from "../../input/input";
import { textInputEventEmitter, TextInputStorage } from "../../input/text_input";
import { BeatmapSet } from "../../datamodel/beatmap_set";
import { beatmapCarouselSortingTypes, defaultBeatmapCarouselSortingType } from "./beatmap_carousel";
import { OverridableDelay } from "../../util/misc_util";
import { createPolygonTexture } from "../../util/pixi_util";
import { TabSelector } from "../components/tab_selector";
import { addRenderingTask } from "../../visuals/rendering";
import { Interactivity, InteractionGroup } from "../../input/interactivity";
import { SongSelect } from "./song_select";
import { calculateRatioBasedScalingFactor } from "../../util/graphics_util";

const SEARCH_BAR_WIDTH = 530;
const SEARCH_BAR_HEIGHT = 49;
const TEXT_BACKGROUND_HEIGHT = 20;
const EMPTY_SEARCH_PLACEHOLDER = "type to search";

export class SearchBar {
	public songSelect: SongSelect;
	public container: PIXI.Container;
	public interactionGroup: InteractionGroup;

	private background: PIXI.Sprite;
	private sortSelector: TabSelector;

	private scalingFactor: number = 1.0;
	private delay: OverridableDelay = new OverridableDelay();

	private textStorage: TextInputStorage;
	private textElement: PIXI.Text;
	private textBackground: PIXI.Sprite;

    constructor(songSelect: SongSelect) {
		this.songSelect = songSelect;
		this.container = new PIXI.Container();
		this.interactionGroup = Interactivity.createGroup();
		this.interactionGroup.setZIndex(3);

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
		this.interactionGroup.add(this.sortSelector.interactionGroup);
		this.container.addChild(this.sortSelector.container);

		this.textStorage.addListener('change', () => this.onInput());
		this.onInput();

		let registration = Interactivity.registerDisplayObject(this.container);
		registration.enableEmptyListeners();
		registration.setZIndex(-1);
		this.interactionGroup.add(registration);
	}

	resize() {
		this.scalingFactor = calculateRatioBasedScalingFactor(currentWindowDimensions.width, currentWindowDimensions.height, 16/9, REFERENCE_SCREEN_HEIGHT);

		this.container.y = 0;
		this.container.x = currentWindowDimensions.width - Math.floor(SEARCH_BAR_WIDTH * this.scalingFactor);

		let slantWidth = SEARCH_BAR_HEIGHT/5;
		let textBackgroundSlantWidth = TEXT_BACKGROUND_HEIGHT/5;

		this.background.texture = createPolygonTexture(SEARCH_BAR_WIDTH, SEARCH_BAR_HEIGHT, 
			[new PIXI.Point(0, 0), new PIXI.Point(SEARCH_BAR_WIDTH, 0), new PIXI.Point(SEARCH_BAR_WIDTH, SEARCH_BAR_HEIGHT), new PIXI.Point(slantWidth, SEARCH_BAR_HEIGHT)],
		this.scalingFactor);

		this.textBackground.texture = createPolygonTexture(SEARCH_BAR_WIDTH, TEXT_BACKGROUND_HEIGHT, 
			[new PIXI.Point(0, 0), new PIXI.Point(SEARCH_BAR_WIDTH, 0), new PIXI.Point(SEARCH_BAR_WIDTH, TEXT_BACKGROUND_HEIGHT), new PIXI.Point(textBackgroundSlantWidth, TEXT_BACKGROUND_HEIGHT)],
		this.scalingFactor);

		this.textBackground.x = Math.floor(15 * this.scalingFactor);
		this.textBackground.y = Math.floor(7 * this.scalingFactor);

		this.textElement.style = {
			fontFamily: 'Exo2-Light',
			fill: 0xffffff,
			fontSize: Math.floor(13 * this.scalingFactor),
			dropShadow: true,
			dropShadowDistance: 1,
			dropShadowBlur: 0
		};
		this.textElement.x = this.textBackground.x + Math.floor(13 * this.scalingFactor);
		this.textElement.y = this.textBackground.y + Math.floor(2 * this.scalingFactor);

		this.sortSelector.resize(this.scalingFactor);
		this.sortSelector.container.x = Math.floor(28 * this.scalingFactor);
		this.sortSelector.container.y = Math.floor(SEARCH_BAR_HEIGHT * this.scalingFactor);
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
		for (let set of this.songSelect.loadedBeatmapSets) {
			let matchCount = 0;

			for (let i = 0; i < words.length; i++) {
				if (set.searchableString.includes(words[i])) matchCount++;
			}

			if (matchCount === words.length) matching.push(set);
		}

		if (matching.length > 0) {
			let sort = beatmapCarouselSortingTypes[this.sortSelector.getSelectedIndex()];
			this.songSelect.carousel.showBeatmapSets(matching, sort);
		}
	}
}