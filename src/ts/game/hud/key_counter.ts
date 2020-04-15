import { GameButton } from "../../input/gameplay_input_state";
import { currentWindowDimensions, REFERENCE_SCREEN_HEIGHT } from "../../visuals/ui";
import { createPolygonTexture } from "../../util/pixi_util";
import { MathUtil, EaseType } from "../../util/math_util";
import { lerpColors, hexNumberToColor, colorToHexNumber, Color } from "../../util/graphics_util";
import { THEME_COLORS } from "../../util/constants";
import { Interpolator } from "../../util/interpolation";

const BUTTON_SIZE = 42;
const PADDING = 9;

export class KeyCounter {
	public container: PIXI.Container;
	public scalingFactor: number;
	
	private background: PIXI.Sprite;
	private buttons: KeyCounterButton[];

	constructor() {
		this.container = new PIXI.Container();

		this.background = new PIXI.Sprite();
		this.background.tint = 0x090909;
		this.background.alpha = 0.8;
		this.container.addChild(this.background);

		let k1 = new KeyCounterButton(this, 'K1', THEME_COLORS.PrimaryBlue);
		let k2 = new KeyCounterButton(this, 'K2', THEME_COLORS.PrimaryBlue);
		let m1 = new KeyCounterButton(this, 'M1', THEME_COLORS.PrimaryViolet);
		let m2 = new KeyCounterButton(this, 'M2', THEME_COLORS.PrimaryViolet);
		this.buttons = [k1, k2, m1, m2];
		for (let b of this.buttons) this.container.addChild(b.container);
	}

	resize() {
		this.scalingFactor = currentWindowDimensions.height / REFERENCE_SCREEN_HEIGHT;

		const containerWidth = BUTTON_SIZE + PADDING * 2;
		const containerHeight = BUTTON_SIZE * this.buttons.length + PADDING * (this.buttons.length + 1);
		const slantHeight = containerWidth/5;

		this.background.texture = createPolygonTexture(containerWidth, containerHeight + slantHeight*2, [
			new PIXI.Point(0, slantHeight), new PIXI.Point(containerWidth, 0), new PIXI.Point(containerWidth, containerHeight + slantHeight), new PIXI.Point(0, containerHeight + slantHeight*2)
		], this.scalingFactor);

		for (let i = 0; i < this.buttons.length; i++) {
			let button = this.buttons[i];

			button.container.x = Math.floor(PADDING * this.scalingFactor);
			button.container.y = Math.floor((slantHeight + PADDING + (BUTTON_SIZE + PADDING)*i) * this.scalingFactor);

			button.resize();
		}

		this.container.pivot.y = Math.floor(this.container.height / 2);
		this.container.pivot.x = this.container.width-1;
	}

	update(now: number) {
		for (let b of this.buttons) b.update(now);
	}

	setButtonState(button: GameButton, state: boolean, time: number) {
		let index = [GameButton.A1, GameButton.B1, GameButton.A2, GameButton.B2].indexOf(button);
		if (index === -1) return;
		
		this.buttons[index].setState(state, time);
	}

	reset() {
		for (let b of this.buttons) b.reset();
	}
}

class KeyCounterButton {
	public container: PIXI.Container;
	private parent: KeyCounter;

	private label: string;
	private accentColor: Color;
	private graphics: PIXI.Graphics;
	private labelText: PIXI.Text;

	private pressInterpolator: Interpolator;

	constructor(parent: KeyCounter, label: string, accentColor: Color) {
		this.parent = parent;
		this.container = new PIXI.Container();
		
		this.graphics = new PIXI.Graphics();

		this.accentColor = accentColor;
		this.label = label;
		this.labelText = new PIXI.Text(this.label);
		this.labelText.style = {
			fontFamily: 'FredokaOne-Regular',
			fill: 0xCECECE
		};

		this.container.addChild(this.graphics, this.labelText);

		this.pressInterpolator = new Interpolator({
			duration: 35,
			reverseDuration: 200,
			ease: EaseType.EaseOutQuad,
			reverseEase: EaseType.EaseInCubic
		});
	}

	resize() {
		this.labelText.style.fontSize = Math.floor(17 * this.parent.scalingFactor);
		this.labelText.pivot.x = Math.floor(this.labelText.width/2);
		this.labelText.pivot.y = Math.floor(this.labelText.height/2);
		this.labelText.x = Math.floor(BUTTON_SIZE * this.parent.scalingFactor / 2);
		this.labelText.y = this.labelText.x;
	}

	update(now: number) {
		let g = this.graphics;

		g.clear();

		let pressCompletion = this.pressInterpolator.getCurrentValue(now);

		let size = Math.floor(BUTTON_SIZE * this.parent.scalingFactor);
		let lineWidth = MathUtil.lerp(1.4, 3, pressCompletion) * this.parent.scalingFactor;
		if (pressCompletion % 1 === 0) lineWidth = Math.ceil(lineWidth);
		let lineColor = lerpColors(hexNumberToColor(0x4B4B4B), this.accentColor, pressCompletion);
		
		g.beginFill(0x000000, 0.4);
		g.drawRect(0, 0, size, size);
		g.beginFill(0x000000, 0.0);
		g.lineStyle(lineWidth, colorToHexNumber(lineColor));
		g.drawRect(lineWidth/2, lineWidth/2, size - lineWidth/2, size - lineWidth/2);
		g.endFill();
	}

	setState(state: boolean, time: number) {
		this.pressInterpolator.setReversedState(!state, time);
		this.pressInterpolator.start(time);
	}

	reset() {
		this.pressInterpolator.setReversedState(false, performance.now());
		this.pressInterpolator.reset();
	}
}