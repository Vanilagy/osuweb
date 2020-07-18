import { NotificationPanelEntry, NOTIFICATION_PADDING } from "./notification_panel_entry";
import { NotificationPanel } from "./notification_panel";
import { THEME_COLORS } from "../../util/constants";
import { colorToHexNumber, Color, Colors } from "../../util/graphics_util";

export enum NotificationType {
	Neutral,
	Warning,
	Error
}

export let notificationTypeToColor = new Map<NotificationType, Color>();
notificationTypeToColor.set(NotificationType.Neutral, THEME_COLORS.PrimaryBlue);
notificationTypeToColor.set(NotificationType.Warning, THEME_COLORS.PrimaryYellow);
notificationTypeToColor.set(NotificationType.Error, THEME_COLORS.JudgementMiss);

export class Notification extends NotificationPanelEntry {
	private contentText: PIXI.Text;

	constructor(parent: NotificationPanel, heading: string, content: string, type: NotificationType) {
		let color = notificationTypeToColor.get(type);
		super(parent, heading, color, true);

		this.contentText = new PIXI.Text(content);
		this.contentText.style = {
			fontFamily: "Exo2-Light",
			fill: colorToHexNumber({r: 192, g: 192, b: 192}),
			wordWrap: true
		};
		this.container.addChild(this.contentText);

		this.resize();
	}

	calculateRawHeight() {
		return (this.heading.y + this.heading.height + 3 + NOTIFICATION_PADDING * this.parent.scalingFactor + this.contentText.height) / this.parent.scalingFactor;
	}

	resize() {
		super.resize();

		this.contentText.style.fontSize = Math.floor(10 * this.parent.scalingFactor);
		this.contentText.style.wordWrapWidth = this.background.width - 2 * NOTIFICATION_PADDING * this.parent.scalingFactor;
		this.contentText.x = this.heading.x;
		this.contentText.y = this.heading.y + this.heading.height + Math.floor(3 * this.parent.scalingFactor);

		super.resize();
	}
}