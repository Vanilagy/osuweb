import { BeatmapInfoPanel, INFO_PANEL_WIDTH, BeatmapInfoPanelTab, getBeatmapInfoPanelScalingFactor } from "./beatmap_info_panel";

export class BeatmapRankingTab implements BeatmapInfoPanelTab  {
	private parent: BeatmapInfoPanel;
	public container: PIXI.Container;
	private text: PIXI.Text;

	constructor(parent: BeatmapInfoPanel) {
		this.parent = parent;
		this.container = new PIXI.Container();

		this.text = new PIXI.Text("Oops. Nothing here yet!");
		this.container.addChild(this.text);
	}

	resize() {
		let scalingFactor = getBeatmapInfoPanelScalingFactor();

		this.text.style = {
			fontFamily: 'Exo2-Regular',
			fill: 0xffffff,
			textBaseline: 'alphabetic',
			fontSize: Math.floor(12 * scalingFactor)
		};
		this.text.x = Math.floor(INFO_PANEL_WIDTH / 2 * scalingFactor);
		this.text.y = Math.floor(40 * scalingFactor);
		this.text.pivot.x = Math.floor(this.text.width/2);
		this.text.pivot.y = Math.floor(this.text.height/2);

		this.parent.setTabBackgroundNormalizedHeight(this, 80);
	}

	update() {
		//
	}

	focus() {
		this.parent.setTabBackgroundNormalizedHeight(this, 80);
	}
}