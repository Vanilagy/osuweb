import { currentWindowDimensions, REFERENCE_SCREEN_HEIGHT } from "../../visuals/ui";
import { ToolbarEntry } from "./toolbar_entry";
import { InteractionGroup, InteractionRegistration } from "../../input/interactivity";
import { ImportBeatmapsButton } from "../import/import_beatmaps_button";
import { NotificationPanelButton } from "../notifications/notification_panel_button";
import { OpenSettingsButton } from "../settings/open_settings_button";
import { Interpolator } from "../../util/interpolation";
import { EaseType, MathUtil } from "../../util/math_util";
import { globalState } from "../../global_state";

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

	/** A screen-filling dim behind the toolbar. */
	public screenDim: PIXI.Sprite;
	public screenDimRegistration: InteractionRegistration;
	private screenDimInterpolator: Interpolator;

	private fadeInInterpolator: Interpolator;
	
	constructor() {
		this.container = new PIXI.Container();
		this.interactionGroup = new InteractionGroup();

		this.screenDim = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.screenDim.tint = 0x000000;
		this.screenDim.alpha = 0.5;

		this.screenDimRegistration = new InteractionRegistration(this.screenDim);
		this.screenDimRegistration.enableEmptyListeners();
		this.screenDimRegistration.setZIndex(-1);
		this.screenDimRegistration.addListener('mouseDown', () => {
			globalState.notificationPanel.hide();
			globalState.settingsPanel.hide();
		});
		// Note: Don't add the screen dim to this container or interaction group, since we want it to have a special position in the scene. The adding is done from the outside, which is why these properties are public.

		this.screenDimInterpolator = new Interpolator({
			duration: 500,
			reverseDuration: 350,
			ease: EaseType.EaseOutQuint,
			reverseEase: EaseType.EaseInQuint,
			beginReversed: true,
			defaultToFinished: true
		});
		this.fadeInInterpolator = new Interpolator({
			duration: 500,
			ease: EaseType.EaseOutQuint,
			reverseEase: EaseType.EaseInQuint,
			defaultToFinished: true
		});

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

		let openSettingsButton = new OpenSettingsButton(this);
		this.container.addChild(openSettingsButton.container);
		this.rightEntries.push(openSettingsButton);

		this.disableDim();
		this.resize();
	}

	resize() {
		this.scalingFactor = currentWindowDimensions.height / REFERENCE_SCREEN_HEIGHT;

		this.currentHeight = Math.floor(TOOLBAR_HEIGHT * this.scalingFactor);

		this.background.width = currentWindowDimensions.width;
		this.background.height = this.currentHeight;
		this.screenDim.width = currentWindowDimensions.width;
		this.screenDim.height = currentWindowDimensions.height;

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
		let fadeInValue = this.fadeInInterpolator.getCurrentValue(now);
		this.container.y = MathUtil.lerp(-this.currentHeight, 0, fadeInValue);
		this.container.alpha = fadeInValue;

		this.screenDim.alpha = MathUtil.lerp(0.0, 0.5, this.screenDimInterpolator.getCurrentValue(now));

		for (let e of this.leftEntries) e.update(now);
		for (let e of this.rightEntries) e.update(now);
	}

	enableDim() {
		this.screenDimInterpolator.setReversedState(false, performance.now());
		this.screenDimRegistration.enable();
	}

	disableDim() {
		this.screenDimInterpolator.setReversedState(true, performance.now());
		this.screenDimRegistration.disable();
	}

	show() {
		this.fadeInInterpolator.setReversedState(false, performance.now());
		this.interactionGroup.enable();
	}

	hide() {
		this.fadeInInterpolator.setReversedState(true, performance.now());
		this.interactionGroup.disable();
	}
}