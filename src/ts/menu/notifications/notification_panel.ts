import { InteractionGroup, InteractionRegistration } from "../../input/interactivity";
import { Interpolator } from "../../util/interpolation";
import { currentWindowDimensions, REFERENCE_SCREEN_HEIGHT } from "../../visuals/ui";
import { MathUtil, EaseType } from "../../util/math_util";
import { globalState } from "../../global_state";
import { DrawableTask } from "./drawable_task";
import { Task } from "../../multithreading/task";
import { KeyCode } from "../../input/input";
import { NotificationPanelEntry } from "./notification_panel_entry";
import { Notification } from "./notification";
import { ScrollContainer } from "../components/scroll_container";
import { randomInArray, last } from "../../util/misc_util";
import { colorToHexNumber } from "../../util/graphics_util";

export const NOTIFICATION_PANEL_WIDTH = 300;
export const NOTIFICATION_PANEL_PADDING = 12;
export const NOTIFICATION_MARGIN = 12;
const sectionsNames = ["tasks", "notifications"];

interface Section {
	name: string,
	headingElement: PIXI.Text,
	headingInterpolator: Interpolator,
	entries: NotificationPanelEntry[]
}

export class NotificationPanel {
	public container: PIXI.Container;
	public interactionGroup: InteractionGroup;
	public scalingFactor: number;

	private background: PIXI.Sprite;
	/** The actual panel that slides in */
	private panelContainer: PIXI.Container;
	private panelBackground: PIXI.Sprite;
	private scrollContainer: ScrollContainer;
	private contentContainer: PIXI.Container;
	private missingContentNotice: PIXI.Text; // Will show if there are no entries currently being shown

	private fadeInInterpolator: Interpolator;

	private sections: Section[];

	/** Store the last time the notification panel is closed, so that when it is reopened again, we can run one update pass at that stored time. This is done to prevent sudden animations happening only when the panel is updated. The alternative would be to update the panel continuously even when it isn't visible, which is obviously a waste of resources. */
	private lastHideTime = -1e6;

	constructor() {
		this.container = new PIXI.Container();
		this.interactionGroup = new InteractionGroup();

		this.background = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.background.tint = 0x000000;
		this.background.alpha = 0.5;
		this.container.addChild(this.background);

		let backgroundRegistration = new InteractionRegistration(this.background);
		backgroundRegistration.enableEmptyListeners();
		backgroundRegistration.addListener('mouseDown', () => {
			// When you click on the background, it should close the notification panel
			this.hide();
		});
		backgroundRegistration.addListener('keyDown', (e) => {
			if (e.keyCode === KeyCode.Escape) this.hide();
		});
		this.interactionGroup.add(backgroundRegistration);

		this.panelContainer = new PIXI.Container();
		this.container.addChild(this.panelContainer);

		let panelRegistration = new InteractionRegistration(this.panelContainer);
		panelRegistration.enableEmptyListeners();
		this.interactionGroup.add(panelRegistration);

		this.panelBackground = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.panelBackground.tint = 0x101010;
		this.panelBackground.alpha = 0.95;
		this.panelContainer.addChild(this.panelBackground);

		this.missingContentNotice = new PIXI.Text("Nothing here right now.", {
			fontFamily: "Exo2-Light",
			fill: colorToHexNumber({r: 192, g: 192, b: 192})
		});
		this.panelContainer.addChild(this.missingContentNotice);

		this.scrollContainer = new ScrollContainer();
		this.panelContainer.addChild(this.scrollContainer.container);
		this.interactionGroup.add(this.scrollContainer.interactionGroup);
		this.contentContainer = this.scrollContainer.contentContainer;

		this.sections = sectionsNames.map(name => {
			let headingElement = new PIXI.Text(name.toUpperCase());
			headingElement.style = {
				fontFamily: "Exo2-ExtraBold",
				fill: 0xffffff
			};
			this.contentContainer.addChild(headingElement);

			return {
				name,
				headingElement,
				headingInterpolator: new Interpolator({
					duration: 500,
					ease: EaseType.EaseOutCubic,
					reverseEase: EaseType.EaseInCubic,
					defaultToFinished: true,
					beginReversed: true
				}),
				entries: []
			};
		});

		this.fadeInInterpolator = new Interpolator({
			duration: 500,
			reverseDuration: 350,
			ease: EaseType.EaseOutQuint,
			reverseEase: EaseType.EaseInQuint,
			beginReversed: true,
			defaultToFinished: true
		});

		for (let i = 0; i < 20; i++) {
			let words = "Alrighty. Here is some sample text. More sample text. Very long, deep, philosophical sample text! Miles better than Lorem Ipsum, isn't it?".split(" ");
			let len = MathUtil.getRandomInt(10, 100);
			let text = "";
			for (let i = 0; i < len; i++) text += randomInArray(words) + " ";

			let mhh = new Notification(this, "bruh " + Math.random(), text);
			this.addEntryToSection(mhh, "notifications");
		}

		this.resize();
		this.hide();
	}

	addEntryToSection(entry: NotificationPanelEntry, sectionName: string) {
		let section = this.sections.find(x => x.name === sectionName);
		if (!section) return;

		section.entries.push(entry);
		this.contentContainer.addChild(entry.container);
		this.scrollContainer.contentInteractionGroup.add(entry.interactionGroup);

		if (section.entries.length === 1) {
			section.headingInterpolator.setReversedState(false, performance.now());
		}
	}

	resize() {
		this.scalingFactor = currentWindowDimensions.height / REFERENCE_SCREEN_HEIGHT;

		this.background.width = currentWindowDimensions.width;
		this.background.height = currentWindowDimensions.height;

		this.panelContainer.y = globalState.toolbar.currentHeight;
		this.panelBackground.width = Math.floor(NOTIFICATION_PANEL_WIDTH * this.scalingFactor);
		this.panelBackground.height = currentWindowDimensions.height - this.panelContainer.y;

		this.scrollContainer.setHeight(this.panelBackground.height);
		this.scrollContainer.setWidth(this.panelBackground.width);
		this.scrollContainer.setPadding(Math.floor(NOTIFICATION_PANEL_PADDING * this.scalingFactor));
		this.scrollContainer.setScrollScalingFactor(this.scalingFactor);
		this.scrollContainer.setScrollbarScalingFactor(this.scalingFactor);

		for (let section of this.sections) {
			section.headingElement.style.fontSize = Math.floor(12 * this.scalingFactor);
			for (let e of section.entries) e.resize();
		}

		this.missingContentNotice.style.fontSize = Math.floor(12 * this.scalingFactor);
		this.missingContentNotice.pivot.x = Math.floor(this.missingContentNotice.width / 2);
		this.missingContentNotice.x = Math.floor(this.panelBackground.width / 2);
		this.missingContentNotice.y = Math.floor(35 * this.scalingFactor);
	}

	update(now: number) {
		let fadeInCompletion = this.fadeInInterpolator.getCurrentValue(now);
		if (fadeInCompletion === 0) {
			this.container.visible = false;
			return;
		}
		this.container.visible = true;

		this.background.alpha = MathUtil.lerp(0, 0.5, fadeInCompletion);
		this.panelContainer.x = currentWindowDimensions.width - MathUtil.lerp(0, this.panelContainer.width, fadeInCompletion);

		this.scrollContainer.update(now);

		let margin = NOTIFICATION_MARGIN * this.scalingFactor;
		let currentY = 0;
		let biggestInterpolatorValue = 0; // Remember the biggest interpolation value of all section headings for the missing content notice

		for (let section of this.sections) {
			let interpolatorValue = section.headingInterpolator.getCurrentValue(now);
			biggestInterpolatorValue = Math.max(biggestInterpolatorValue, interpolatorValue);

			section.headingElement.y = Math.floor(currentY);
			section.headingElement.alpha = interpolatorValue;
			section.headingElement.scale.y = interpolatorValue;
			currentY += section.headingElement.height + margin * interpolatorValue;

			for (let i = 0; i < section.entries.length; i++) {
				let entry = section.entries[i];
				entry.update(now);

				if (entry.destroyable) {
					// Remove the entry
					this.contentContainer.removeChild(entry.container);
					this.scrollContainer.contentInteractionGroup.remove(entry.interactionGroup);
					section.entries.splice(i--, 1);

					continue;
				}

				let bruh = entry.getFadeInValue(now);

				// If this is the last element, we add a negative margin on top to remove the margin created by the last element.
				if (section === last(this.sections) && i === section.entries.length-1) currentY -= margin * (1 - bruh);
				entry.container.y = Math.floor(currentY);
				currentY += entry.getHeight(now) + margin * bruh;
			}

			if (section.entries.filter(x => !x.closed).length === 0) {
				// Hide the section header if there are no non-closed entries in this section (the section is empty)
				section.headingInterpolator.setReversedState(true, now);
			}
		}

		// Show the missing content notice only if all sections are hidden
		this.missingContentNotice.alpha = 1 - biggestInterpolatorValue;
	}

	show() {
		this.fadeInInterpolator.setReversedState(false, performance.now());
		this.interactionGroup.enable();

		this.update(this.lastHideTime);
	}

	hide() {
		let now = performance.now();

		this.fadeInInterpolator.setReversedState(true, now);
		this.interactionGroup.disable();

		this.lastHideTime = now;
	}

	toggle() {
		if (this.interactionGroup.enabled) this.hide();
		else this.show();
	}
}