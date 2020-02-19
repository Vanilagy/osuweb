import { songSelectContainer, loadedBeatmapSets } from "./song_select";
import { currentWindowDimensions } from "../../visuals/ui";
import { inputEventEmitter } from "../../input/input";
import { textInputEventEmitter, TextInputStorage } from "../../input/text_input";
import { BeatmapSet } from "../../datamodel/beatmap_set";
import { createCarouselFromBeatmapSets } from "./beatmap_carousel";
import { OverridableDelay } from "../../util/misc_util";

let searchBar: SearchBar = null;

export function initSearchBar() {
    searchBar = new SearchBar();
    songSelectContainer.addChild(searchBar.container);

    updateSearchBarSizing();
}

export function updateSearchBarSizing() {
	if (!searchBar) return;

    searchBar.container.y = 0;
    searchBar.container.x = currentWindowDimensions.width - searchBar.container.width;
}

class SearchBar {
    public container: PIXI.Container;
    private textElement: PIXI.Text;
	private delay: OverridableDelay = new OverridableDelay();
	private textStorage: TextInputStorage;

    constructor() {
		this.container = new PIXI.Container();
		this.textStorage = new TextInputStorage();
		this.textStorage.enable();

        let bg = new PIXI.Sprite(PIXI.Texture.WHITE);
        bg.tint = 0xff0000;
        bg.height = 30;
        bg.width = 400;
        this.container.addChild(bg);

        this.textElement = new PIXI.Text(this.textStorage.stored);
		this.container.addChild(this.textElement);
		
		this.textStorage.addListener('change', () => this.updateText());
	}
	
	private updateText() {
		this.textElement.text = this.textStorage.stored;
		let query = this.textStorage.stored.toLowerCase();

		let matching: BeatmapSet[] = [];
		for (let set of loadedBeatmapSets) {
			if (set.searchableString.includes(query)) {
				matching.push(set);
			}
		}

		if (matching.length > 0) {
			this.delay.schedule(250, () => createCarouselFromBeatmapSets(matching));
		}
	}
}