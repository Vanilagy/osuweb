import { SettingsElement } from "./settings_element";
import { SettingsPanel, SETTINGS_PANEL_WIDTH, SETTINGS_PANEL_PADDING } from "./settings_panel";
import { settingsDescription, RangeSettingDescription } from "./settings_description";
import { RangeSlider } from "../components/range_slider";
import { colorToHexNumber } from "../../util/graphics_util";
import { KeysWithType } from "../../util/misc_util";
import { globalState } from "../../global_state";

export class RangeElement extends SettingsElement {
	private titleElement: PIXI.Text;
	private rangeSlider: RangeSlider;

	constructor(parent: SettingsPanel, setting: KeysWithType<typeof settingsDescription, RangeSettingDescription>) {
		super(parent);

		this.identifier = setting;
		let description = settingsDescription[setting];

		this.titleElement = new PIXI.Text(description.displayName, {
			fontFamily: 'Exo2-Light',
			fill: colorToHexNumber({r: 220, g: 220, b: 220})
		});
		this.container.addChild(this.titleElement);

		this.rangeSlider = new RangeSlider(SETTINGS_PANEL_WIDTH - SETTINGS_PANEL_PADDING*2, description.options);
		this.container.addChild(this.rangeSlider.container);
		this.interactionGroup.add(this.rangeSlider.interactionGroup);

		this.rangeSlider.setValue(globalState.settings[setting]);
		this.rangeSlider.addListener('change', (val) => {
			globalState.settings[setting] = val;
			description.onChange?.(val);
		});
		this.rangeSlider.addListener('release', (val) => {
			globalState.settings[setting] = val;
			description.onChange?.(val);
			description.onFinish?.(val);
		});
	}

	resize() {
		this.titleElement.style.fontSize = Math.floor(12 * this.parent.scalingFactor);

		this.rangeSlider.container.y = Math.floor(25 * this.parent.scalingFactor);
		this.rangeSlider.resize(this.parent.scalingFactor);
	}

	update(now: number) {
		this.rangeSlider.update(now);
	}

	getHeight() {
		return this.container.height;
	}
}