import { InteractionGroup, InteractionRegistration } from "../../input/interactivity";
import { Interpolator } from "../../util/interpolation";
import { currentWindowDimensions, REFERENCE_SCREEN_HEIGHT } from "../../visuals/ui";
import { MathUtil, EaseType } from "../../util/math_util";
import { globalState } from "../../global_state";
import { KeyCode } from "../../input/input";
import { NotificationPanelEntry } from "./notification_panel_entry";
import { Notification, NotificationType } from "./notification";
import { ScrollContainer } from "../components/scroll_container";
import { last, EMPTY_FUNCTION } from "../../util/misc_util";
import { colorToHexNumber } from "../../util/graphics_util";
import { svgToTexture } from "../../util/pixi_util";

export const NOTIFICATION_PANEL_WIDTH = 300;
export const NOTIFICATION_PANEL_PADDING = 12;
export const NOTIFICATION_MARGIN = 12;
const sectionsNames = ["tasks", "notifications"];

const circleXTexture = svgToTexture(document.querySelector('#svg-circle-x'), true);

class Section {
	public name: string;
	public headingElement: PIXI.Text;
	public headingInterpolator: Interpolator;
	public closeButton: PIXI.Sprite;
	public closeButtonInterpolator: Interpolator;
	public entries: NotificationPanelEntry[];

	constructor(parent: NotificationPanel, name: string) {
		this.name = name;
		this.entries = [];

		this.headingElement = new PIXI.Text(name.toUpperCase());
		this.headingElement.style = {
			fontFamily: "Exo2-ExtraBold",
			fill: 0xffffff
		};
		parent.contentContainer.addChild(this.headingElement);

		this.headingInterpolator = new Interpolator({
			duration: 500,
			ease: EaseType.EaseOutCubic,
			reverseEase: EaseType.EaseInCubic,
			defaultToFinished: true,
			beginReversed: true
		});

		this.closeButton = new PIXI.Sprite(circleXTexture);
		this.closeButton.anchor.set(1.0, 0.0);
		this.closeButton.visible = false;
		parent.contentContainer.addChild(this.closeButton);

		this.closeButtonInterpolator = new Interpolator({
			defaultToFinished: true,
			beginReversed: true,
			duration: 300,
			ease: EaseType.EaseOutCubic,
			reverseEase: EaseType.EaseInQuint
		});

		let registration = new InteractionRegistration(this.closeButton);
		registration.addButtonHandlers(
			() => {
				for (let entry of this.entries) {
					if (entry.allowManualClose) entry.close();
				}
			},
			() => this.closeButtonInterpolator.setReversedState(false, performance.now()),
			() => this.closeButtonInterpolator.setReversedState(true, performance.now()),
			EMPTY_FUNCTION,
			EMPTY_FUNCTION
		);
		parent.scrollContainer.contentInteractionGroup.add(registration);
	}
}

export class NotificationPanel {
	public container: PIXI.Container;
	public interactionGroup: InteractionGroup;
	public scalingFactor: number;

	private background: PIXI.Sprite;
	/** The actual panel that slides in */
	private panelContainer: PIXI.Container;
	private panelBackground: PIXI.Sprite;
	public scrollContainer: ScrollContainer;
	public contentContainer: PIXI.Container;
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

		this.sections = sectionsNames.map(name => new Section(this, name));

		this.fadeInInterpolator = new Interpolator({
			duration: 500,
			reverseDuration: 350,
			ease: EaseType.EaseOutQuint,
			reverseEase: EaseType.EaseInQuint,
			beginReversed: true,
			defaultToFinished: true
		});

		this.resize();
		this.hide();
	}

	showNotification(header: string, body: string, type: NotificationType = NotificationType.Neutral) {
		let drawable = new Notification(this, header, body, type);
		this.addEntryToSection(drawable, "notifications", true);
	}

	addEntryToSection(entry: NotificationPanelEntry, sectionName: string, front = false) {
		let section = this.sections.find(x => x.name === sectionName);
		if (!section) return;

		front? section.entries.unshift(entry) : section.entries.push(entry);
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
			section.closeButton.x = this.panelBackground.width - 2 * Math.floor(NOTIFICATION_PANEL_PADDING * this.scalingFactor);
			section.closeButton.width = section.closeButton.height = Math.floor(14 * this.scalingFactor);

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

			section.closeButton.y = section.headingElement.y;
			section.closeButton.height = section.closeButton.width * interpolatorValue;
			section.closeButton.alpha = interpolatorValue * MathUtil.lerp(0.25, 0.75, section.closeButtonInterpolator.getCurrentValue(now));

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

				let fadeInValue = entry.getFadeInValue(now);

				// If this is the last element, we add a negative margin on top to remove the margin created by the last element.
				if (section === last(this.sections) && i === section.entries.length-1) currentY -= margin * (1 - fadeInValue);
				entry.container.y = Math.floor(currentY);
				currentY += entry.getHeight(now) + margin * fadeInValue;
			}

			let activeEntries = section.entries.filter(x => !x.closed).length;
			if (activeEntries === 0) {
				// Hide the section header if there are no non-closed entries in this section (the section is empty)
				section.headingInterpolator.setReversedState(true, now);
			} else {
				let text = section.name.toUpperCase() + ' (' + activeEntries + ')';
				if (section.headingElement.text !== text) section.headingElement.text = text;
			}

			let closableEntries = section.entries.filter(x => x.allowManualClose).length;
			if (closableEntries > 0) {
				section.closeButton.visible = true;
			} else if (activeEntries > 0) {
				// No need to hide the button if the section is being hidden anyway
				section.closeButton.visible = false;
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