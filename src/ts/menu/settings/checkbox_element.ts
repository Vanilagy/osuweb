import { SettingsElement } from "./settings_element";
import { SettingsPanel, SETTINGS_PANEL_WIDTH, SETTINGS_PANEL_PADDING } from "./settings_panel";
import { settingsDescription, CheckboxSettingDescription } from "./settings_description";
import { colorToHexNumber } from "../../util/graphics_util";
import { KeysWithType } from "../../util/misc_util";
import { Checkbox } from "../components/checkbox";
import { globalState } from "../../global_state";
import { changeSetting } from "./settings";

export class CheckboxElement extends SettingsElement {
	private titleElement: PIXI.Text;
	private checkbox: Checkbox;
	private setting: KeysWithType<typeof settingsDescription, CheckboxSettingDescription>;

	constructor(parent: SettingsPanel, setting: KeysWithType<typeof settingsDescription, CheckboxSettingDescription>) {
		super(parent);

		this.setting = setting;
		this.identifier = setting;
		let description = settingsDescription[setting];

		this.titleElement = new PIXI.Text(description.displayName, {
			fontFamily: 'Exo2-Light',
			fill: colorToHexNumber({r: 220, g: 220, b: 220})
		});
		this.container.addChild(this.titleElement);

		this.checkbox = new Checkbox();
		this.container.addChild(this.checkbox.container);
		this.interactionGroup.add(this.checkbox.interactionGroup);

		this.checkbox.setState(globalState.settings[setting]);
		this.checkbox.addListener('change', (val) => {
			changeSetting(setting, val);
		});
	}

	resize() {
		this.titleElement.style.fontSize = Math.floor(12 * this.parent.scalingFactor);

		this.checkbox.resize(this.parent.scalingFactor);
		// Position the checkbox all the way on the right side
		this.checkbox.container.x = Math.floor((SETTINGS_PANEL_WIDTH - SETTINGS_PANEL_PADDING*2) * this.parent.scalingFactor - this.checkbox.container.width);
	}

	update(now: number) {
		this.checkbox.update(now);
	}

	getHeight() {
		return 16 * this.parent.scalingFactor;
	}

	getBottomMargin(now: number) {
		return 10 * this.parent.scalingFactor;
	}

	refresh() {
		this.checkbox.setState(globalState.settings[this.setting]);
	}
}