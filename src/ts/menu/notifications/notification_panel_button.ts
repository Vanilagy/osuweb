import { ToolbarButton } from "../toolbar/toolbar_button";
import { Toolbar } from "../toolbar/toolbar";
import { svgToTexture } from "../../util/pixi_util";
import { globalState } from "../../global_state";

const menuTexture = svgToTexture(document.querySelector('#svg-menu'), true);

export class NotificationPanelButton extends ToolbarButton {
	constructor(parent: Toolbar) {
		super(parent, menuTexture);
	}

	onClick() {
		globalState.notificationPanel.toggle();
	}
}