import { NotificationPanelEntry, NOTIFICATION_PADDING } from "./notification_panel_entry";
import { NotificationPanel } from "./notification_panel";
import { THEME_COLORS } from "../../util/constants";
import { colorToHexNumber } from "../../util/graphics_util";

export class Notification extends NotificationPanelEntry {
	private contentText: PIXI.Text;

	constructor(parent: NotificationPanel, heading: string, content: string) {
		super(parent, heading, THEME_COLORS.PrimaryBlue, true);

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