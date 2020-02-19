import { songSelectContainer } from "./song_select";
import { currentWindowDimensions } from "../../visuals/ui";
import { inputEventEmitter } from "../../input/input";
import { textInputEventEmitter } from "../../input/text_input";

let searchBar: SearchBar = null;

export function initSearchBar() {
    searchBar = new SearchBar();
    songSelectContainer.addChild(searchBar.container);

    updateSearchBarSizing();
}

export function updateSearchBarSizing() {
    searchBar.container.y = 0;
    searchBar.container.x = currentWindowDimensions.width - searchBar.container.width;
}

class SearchBar {
    public container: PIXI.Container;
    private text: PIXI.Text;
    private currentQuery: string = "";

    constructor() {
        this.container = new PIXI.Container();

        let bg = new PIXI.Sprite(PIXI.Texture.WHITE);
        bg.tint = 0xff0000;
        bg.height = 30;
        bg.width = 400;
        this.container.addChild(bg);

        this.text = new PIXI.Text(this.currentQuery);
        this.container.addChild(this.text);

        textInputEventEmitter.addListener('textInput', (str) => {
            this.currentQuery += str;
            this.text.text = this.currentQuery;
        });
        inputEventEmitter.addListener('keyDown', (e) => {
            if (e.keyCode === 8 && this.currentQuery.length > 0) {
                this.currentQuery = this.currentQuery.slice(0, -1);
                this.text.text = this.currentQuery;
            }
        });
    }
}