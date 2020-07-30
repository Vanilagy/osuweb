import { SettingsElement } from "./settings_element";
import { SettingsPanel, SETTINGS_PANEL_WIDTH, SETTINGS_PANEL_PADDING } from "./settings_panel";
import { settingsDescription, SelectionSettingDescription } from "./settings_description";
import { colorToHexNumber } from "../../util/graphics_util";
import { KeysWithType } from "../../util/misc_util";
import { DropdownSelector } from "../components/dropdown_selector";
import { MathUtil } from "../../util/math_util";
import { globalState } from "../../global_state";

export class SelectionElement extends SettingsElement {
	private titleElement: PIXI.Text;
	private selector: DropdownSelector;

	constructor(parent: SettingsPanel, setting: KeysWithType<typeof settingsDescription, SelectionSettingDescription>) {
		super(parent);

		let description = settingsDescription[setting];

		this.titleElement = new PIXI.Text(description.displayName, {
			fontFamily: 'Exo2-Light',
			fill: colorToHexNumber({r: 220, g: 220, b: 220})
		});
		this.container.addChild(this.titleElement);

		this.selector = new DropdownSelector(SETTINGS_PANEL_WIDTH - SETTINGS_PANEL_PADDING*2);
		this.container.addChild(this.selector.container);
		this.interactionGroup.add(this.selector.interactionGroup);

		this.selector.setOptions(description.options);
		this.selector.setSelection(globalState.settings[setting]);
		this.selector.addListener('change', (val) => {
			globalState.settings[setting] = val;
			description.onChange(val);
		});
	}

	resize() {
		this.titleElement.style.fontSize = Math.floor(12 * this.parent.scalingFactor);

		this.selector.resize(this.parent.scalingFactor);
		this.selector.container.y = Math.floor(20 * this.parent.scalingFactor);
	}

	update(now: number) {
		this.selector.update(now);
	}

	getHeight(now: number) {
		// Depending on the state of the dropdown interpolator, either the height of the dropdown or the height of the selectionBackground is used.
		return this.selector.container.y + MathUtil.lerp(this.selector.selectionBackground.height, this.selector.dropdownContainer.y + this.selector.dropdownBackground.height, this.selector.dropdownInterpolator.getCurrentValue(now));
	}

	getBottomMargin(now: number) {
		return 10 * this.parent.scalingFactor;
	}
}