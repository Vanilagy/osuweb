import { currentWindowDimensions, REFERENCE_SCREEN_HEIGHT } from "../../visuals/ui";
import { ToolbarEntry } from "./toolbar_entry";
import { InteractionGroup, InteractionRegistration } from "../../input/interactivity";
import { ImportBeatmapsButton } from "../import/import_beatmaps_button";
import { NotificationPanelButton } from "../notifications/notification_panel_button";

export const TOOLBAR_HEIGHT = 40;

export class Toolbar {
	public container: PIXI.Container;
	public scalingFactor: number;
	public interactionGroup: InteractionGroup;
	public currentHeight: number = 0;

	private background: PIXI.Sprite;
	/** The entries lined up at the left side of the toolbar. */
	private leftEntries: ToolbarEntry[] = [];
	/** The entries lined up at the right side of the toolbra. */
	private rightEntries: ToolbarEntry[] = [];
	
	constructor() {
		this.container = new PIXI.Container();
		this.interactionGroup = new InteractionGroup();

		this.background = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.background.tint = 0x131313;
		this.background.alpha = 0.90;
		this.container.addChild(this.background);

		let backgroundRegistration = new InteractionRegistration(this.background);
		backgroundRegistration.enableEmptyListeners();
		this.interactionGroup.add(backgroundRegistration);

		let importBeatmapsButton = new ImportBeatmapsButton(this);
		this.container.addChild(importBeatmapsButton.container);
		this.leftEntries.push(importBeatmapsButton);

		let notificationPanelButton = new NotificationPanelButton(this);
		this.container.addChild(notificationPanelButton.container);
		this.rightEntries.push(notificationPanelButton);

		this.resize();
	}

	resize() {
		this.scalingFactor = currentWindowDimensions.height / REFERENCE_SCREEN_HEIGHT;

		this.currentHeight = Math.floor(TOOLBAR_HEIGHT * this.scalingFactor);

		this.background.width = currentWindowDimensions.width;
		this.background.height = this.currentHeight;

		let currentX = 0;
		for (let e of this.leftEntries) {
			e.resize();
			e.container.x = currentX;
			currentX += e.entryContainer.width;
		}

		currentX = currentWindowDimensions.width;
		for (let e of this.rightEntries) {
			e.resize();
			currentX -= e.entryContainer.width; // Offset the x first this time
			e.container.x = currentX;
		}
	}

	update(now: number) {
		for (let e of this.leftEntries) e.update(now);
		for (let e of this.rightEntries) e.update(now);
	}
}