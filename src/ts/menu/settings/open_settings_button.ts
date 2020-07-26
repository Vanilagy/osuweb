import { ToolbarButton } from "../toolbar/toolbar_button";
import { Toolbar } from "../toolbar/toolbar";
import { svgToTexture } from "../../util/pixi_util";
import { globalState } from "../../global_state";

const settingsTexture = svgToTexture(document.querySelector('#svg-settings'), true);

export class OpenSettingsButton extends ToolbarButton {
	constructor(parent: Toolbar) {
		super(parent, settingsTexture);
	}

	onClick() {
		globalState.settingsPanel.toggle();
	}
}