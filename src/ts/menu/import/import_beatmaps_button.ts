import { ToolbarButton } from "../toolbar/toolbar_button";
import { Toolbar } from "../toolbar/toolbar";
import { svgToTexture, createPolygonTexture } from "../../util/pixi_util";
import { ListSelector } from "../components/list_selector";
import { Interpolator } from "../../util/interpolation";
import { InteractionGroup } from "../../input/interactivity";
import { EaseType, MathUtil } from "../../util/math_util";
import { globalState } from "../../global_state";

const plusTexture = svgToTexture(document.querySelector('#svg-plus'), true);
const folderTexture = svgToTexture(document.querySelector('#svg-folder'), true);
const downloadBoldTexture = svgToTexture(document.querySelector('#svg-download-bold'), true);

export class ImportBeatmapsButton extends ToolbarButton {
	private dropdown: ImportMethodDropdown;
	public dropdownInterpolator: Interpolator;

	constructor(parent: Toolbar) {
		super(parent, plusTexture);

		this.dropdown = new ImportMethodDropdown(this);
		this.interactionGroup.add(this.dropdown.interactionGroup);

		this.container.addChild(this.dropdown.container);

		this.dropdownInterpolator = new Interpolator({
			duration: 500,
			reverseDuration: 250,
			ease: EaseType.EaseOutElasticHalf,
			reverseEase: EaseType.EaseInQuint,
			beginReversed: true,
			defaultToFinished: true
		});
	}

	onClick() {
		this.dropdownInterpolator.reverse(performance.now());
	}

	resize() {
		super.resize();

		let nudge = Math.floor(7 * this.parent.scalingFactor);
		this.dropdown.container.x = nudge;
		this.dropdown.resize();
	}

	update(now: number) {
		super.update(now);

		let dropdownCompletion = this.dropdownInterpolator.getCurrentValue(now);
		let nudge = Math.floor(7 * this.parent.scalingFactor);
		
		this.dropdown.update(now);
		this.dropdown.container.y = (this.parent.currentHeight + nudge) * MathUtil.lerp(0.8, 1.0, dropdownCompletion);
		this.dropdown.container.alpha = dropdownCompletion;
		this.dropdown.container.scale.y = MathUtil.lerp(0.75, 1.0, dropdownCompletion);

		if (dropdownCompletion >= 0.75) {
			this.dropdown.interactionGroup.enable();
		} else {
			this.dropdown.interactionGroup.disable();
		}
	}
}

class ImportMethodDropdown {
	private button: ImportBeatmapsButton;
	public container: PIXI.Container;
	public selector: ListSelector;
	private background: PIXI.Sprite;
	public interactionGroup: InteractionGroup;
	private pointer: PIXI.Sprite;

	constructor(button: ImportBeatmapsButton) {
		this.button = button;
		this.container = new PIXI.Container();
		this.interactionGroup = new InteractionGroup();

		this.background = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.background.tint = 0x131313;
		this.background.alpha = 0.9;
		this.container.addChild(this.background);

		this.pointer = new PIXI.Sprite();
		this.pointer.tint = this.background.tint;
		this.pointer.alpha = this.background.alpha;
		this.container.addChild(this.pointer);

		this.selector = new ListSelector();
		this.selector.itemHeight = 40;
		this.selector.itemWidth = 150;
		this.selector.itemFontSize = 14;
		this.selector.itemIconSize = 24;
		this.selector.itemMarginLeft = 50;
		this.container.addChild(this.selector.container);
		this.interactionGroup.add(this.selector.interactionGroup);

		this.selector.setSchema([
			{
				name: 'folder',
				label: 'from folder',
				icon: folderTexture
			},
			{
				name: 'download',
				label: 'download',
				icon: downloadBoldTexture
			}
		]);

		this.selector.addListener('select', (name) => {
			switch (name) {
				case "folder": {
					globalState.folderSelector.show();
				}; break;
			}

			this.button.dropdownInterpolator.setReversedState(true, performance.now());
		})
	}

	resize() {
		this.selector.resize(this.button.parent.scalingFactor);
		this.background.width = this.selector.container.width;
		this.background.height = this.selector.container.height;

		// Create a little pointy triangle that points towards the toolbar button
		this.pointer.texture.destroy(true);
		this.pointer.texture = createPolygonTexture(14, 7, [
			new PIXI.Point(7, 0), new PIXI.Point(14, 7), new PIXI.Point(0, 7)
		], this.button.parent.scalingFactor);
		this.pointer.pivot.x = Math.floor(this.pointer.width / 2);
		this.pointer.x = this.button.entryContainer.width/2 - this.container.x;

		this.background.y = this.pointer.height-1;
		this.selector.container.y = this.pointer.height-1;
	}

	update(now: number) {
		this.selector.update(now);
	}
}