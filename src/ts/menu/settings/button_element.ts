import { SettingsElement } from "./settings_element";
import { SettingsPanel, SETTINGS_PANEL_WIDTH, SETTINGS_PANEL_PADDING } from "./settings_panel";
import { THEME_COLORS } from "../../util/constants";
import { colorToHexNumber, lerpColors, Colors } from "../../util/graphics_util";
import { createPolygonBorderTexture } from "../../util/pixi_util";
import { Interpolator } from "../../util/interpolation";
import { EaseType } from "../../util/math_util";
import { InteractionRegistration } from "../../input/interactivity";

const HEIGHT = 25;

export class ButtonElement extends SettingsElement {
	private border: PIXI.Sprite;
	private text: PIXI.Text;

	private hoverInterpolator: Interpolator;
	private pressdownInterpolator: Interpolator;

	constructor(parent: SettingsPanel, label: string, onclick: () => any) {
		super(parent);

		this.border = new PIXI.Sprite();
		this.text = new PIXI.Text(label, {
			fontFamily: 'Exo2-RegularItalic',
			fill: 0xffffff
		});
		this.text.tint = colorToHexNumber(THEME_COLORS.PrimaryViolet);

		this.container.addChild(this.border, this.text);

		this.hoverInterpolator = new Interpolator({
			duration: 150,
			ease: EaseType.EaseOutCubic,
			reverseEase: EaseType.EaseInCubic,
			reverseDuration: 400,
			beginReversed: true,
			defaultToFinished: true
		});
		this.pressdownInterpolator = new Interpolator({
			duration: 50,
			ease: EaseType.EaseOutCubic,
			reverseEase: EaseType.EaseInCubic,
			reverseDuration: 400,
			beginReversed: true,
			defaultToFinished: true
		});

		let registration = new InteractionRegistration(this.container);
		this.interactionGroup.add(registration);
		registration.addButtonHandlers(
			() => onclick(),
			() => this.hoverInterpolator.setReversedState(false, performance.now()),
			() => this.hoverInterpolator.setReversedState(true, performance.now()),
			() => this.pressdownInterpolator.setReversedState(false, performance.now()),
			() => this.pressdownInterpolator.setReversedState(true, performance.now())
		);
	}

	resize() {
		let slantWidth = HEIGHT/5;
		let width = SETTINGS_PANEL_WIDTH - SETTINGS_PANEL_PADDING*2;
		let polygon = [new PIXI.Point(0, 0), new PIXI.Point(width - slantWidth, 0), new PIXI.Point(width, HEIGHT), new PIXI.Point(slantWidth, HEIGHT)];

		this.border.texture = createPolygonBorderTexture(width, HEIGHT, polygon, 1, this.parent.scalingFactor, 0, false, 3);

		this.text.style.fontSize = Math.floor(12 * this.parent.scalingFactor);
		this.text.x = Math.floor((this.border.width - this.text.width) / 2);
		this.text.y = Math.floor(5 * this.parent.scalingFactor);
	}

	update(now: number) {
		let hoverValue = this.hoverInterpolator.getCurrentValue(now);
		let pressdownValue = this.pressdownInterpolator.getCurrentValue(now);

		this.border.tint = colorToHexNumber(lerpColors(lerpColors({r: 64, g: 64, b: 64}, THEME_COLORS.PrimaryViolet, hoverValue), Colors.White, pressdownValue));
		this.text.tint = colorToHexNumber(lerpColors(THEME_COLORS.PrimaryViolet, Colors.White, pressdownValue));
	}

	getHeight() {
		return this.border.height;
	}
}