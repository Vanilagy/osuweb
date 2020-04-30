import { Button, ButtonPivot } from "../components/button";
import { rootInteractionGroup } from "../../input/interactivity";
import { globalState } from "../../global_state";

export class FolderSelector {
	public container: PIXI.Container;
	private background: PIXI.Sprite;

	constructor() {
		this.container = new PIXI.Container();

		this.background = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.background.width = 500;
		this.background.height = 200;
		this.container.addChild(this.background);

		let instructionText = new PIXI.Text("Select a beatmap folder to import.");
		this.container.addChild(instructionText);

		let selectButton = new Button(140, 40, 18, ButtonPivot.TopLeft, "Select", 0xffffff);
		this.container.addChild(selectButton.container);
		selectButton.container.y = 30;

		selectButton.resize(1);
		

		selectButton.setupInteraction(rootInteractionGroup, async () => {
			let directoryHandle = await chooseFileSystemEntries({type: 'open-directory'});
			globalState.beatmapLibrary.addFromDirectoryHandle(directoryHandle);
		});
		selectButton.registration.setZIndex(1000);
	}
}