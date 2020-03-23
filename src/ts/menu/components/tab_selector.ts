import { EaseType } from "../../util/math_util";
import { InteractionGroup, InteractionRegistration } from "../../input/interactivity";
import { CustomEventEmitter } from "../../util/custom_event_emitter";
import { InterpolatedValueChanger, Interpolator } from "../../util/interpolation";
import { THEME_COLORS } from "../../util/constants";
import { colorToHexNumber } from "../../util/graphics_util";

export class TabSelector extends CustomEventEmitter<{selection: number}> {
	public container: PIXI.Container;
	private tabStrings: string[];
	private tabContainers: PIXI.Container[] = [];
	private selectionBar: PIXI.Sprite;
	private selectedIndex = 0;
	private selectionBarXInterpolator: InterpolatedValueChanger;
	private selectionBarWidthInterpolator: InterpolatedValueChanger;
	private hoverInterpolators = new WeakMap<PIXI.Container, Interpolator>();
	private margin: number;
	public interactionGroup: InteractionGroup;

	constructor(tabStrings: string[], defaultIndex = 0, margin = 12) {
		super();

		this.container = new PIXI.Container();
		this.tabStrings = tabStrings;
		this.interactionGroup = new InteractionGroup();
		this.margin = margin;

		for (let i = 0; i < this.tabStrings.length; i++) {
			let s = this.tabStrings[i];
			let container = new PIXI.Container();

			let text = new PIXI.Text(s);
			container.addChild(text);

			this.container.addChild(container);
			this.tabContainers.push(container);

			let hoverInterpolator = new Interpolator({
				from: 0.666,
				to: 0.9,
				ease: EaseType.EaseOutCubic,
				reverseEase: EaseType.EaseInCubic,
				duration: 150,
				beginReversed: true,
				defaultToFinished: true
			});
			this.hoverInterpolators.set(container, hoverInterpolator);

			let interaction = new InteractionRegistration(container);
			interaction.addListener('mouseDown', () => {
				this.setSelection(i);
				this.emit('selection', i);
			});
			interaction.addListener('mouseEnter', () => {
				hoverInterpolator.setReversedState(false, performance.now());
			});
			interaction.addListener('mouseLeave', () => {
				hoverInterpolator.setReversedState(true, performance.now());
			});

			this.interactionGroup.add(interaction);
		}

		this.selectionBar = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.selectionBar.tint = colorToHexNumber(THEME_COLORS.PrimaryBlue);
		this.container.addChild(this.selectionBar);

		this.selectedIndex = defaultIndex;
	}

	private setSelection(index: number) {
		if (index === this.selectedIndex) return;
		this.selectedIndex = index;

		let selectionBarWidth: number;
		let selectionBarX: number;

		for (let i = 0; i < this.tabContainers.length; i++) {
			let container = this.tabContainers[i];
			let text = container.children[0] as PIXI.Text;
			let isSelected = i === this.selectedIndex;

			text.style.fontFamily = isSelected? 'Exo2-Bold' : 'Exo2-Regular';

			if (isSelected) {
				selectionBarWidth = text.width;
				selectionBarX = container.x;
			}
		}

		let now = performance.now();

		this.selectionBarXInterpolator.setGoal(selectionBarX, now);
		this.selectionBarWidthInterpolator.setGoal(selectionBarWidth, now);
	}

	getSelectedIndex() {
		return this.selectedIndex;
	}

	resize(scalingFactor: number) {
		let currentX = 0;
		let selectionBarWidth: number;
		let selectionBarX: number;
		
		for (let i = 0; i < this.tabContainers.length; i++) {
			let container = this.tabContainers[i];
			let text = container.children[0] as PIXI.Text;
			let isSelected = i === this.selectedIndex;

			container.x = Math.floor(currentX);
			text.style = {
				fontFamily: isSelected? 'Exo2-Bold' : 'Exo2-Regular',
				fill: 0xffffff,
				fontSize: Math.floor(12 * scalingFactor),
				dropShadow: true,
				dropShadowDistance: 1,
				dropShadowBlur: 0
			};

			let textWidth = text.width,
				textHeight = text.height;
			currentX += textWidth + this.margin * scalingFactor;

			let halfMarginScaled = this.margin/2 * scalingFactor;
			let marginTop = textHeight/5;
			let hitbox = new PIXI.Rectangle(-halfMarginScaled, -marginTop, textWidth + 2*halfMarginScaled, textHeight + marginTop);
			container.hitArea = hitbox;

			if (isSelected) {
				selectionBarWidth = textWidth;
				selectionBarX = container.x;
			}
		}

		if (!this.selectionBarXInterpolator) {
			this.selectionBarXInterpolator = new InterpolatedValueChanger({
				initial: selectionBarX,
				duration: 150,
				ease: EaseType.EaseOutCubic
			});
			this.selectionBarWidthInterpolator = new InterpolatedValueChanger({
				initial: selectionBarWidth,
				duration: 150,
				ease: EaseType.EaseOutCubic
			});
		} else {
			let now = performance.now();

			this.selectionBarXInterpolator.setGoal(selectionBarX, now);
			this.selectionBarWidthInterpolator.setGoal(selectionBarWidth, now);
		}

		this.selectionBar.width = Math.ceil(selectionBarWidth);
		this.selectionBar.height = Math.ceil(1 * scalingFactor);
		this.selectionBar.y = Math.floor(17 * scalingFactor);

		this.container.pivot.y = this.container.height;
	}

	update(now: number) {
		for (let i = 0; i < this.tabContainers.length; i++) {
			let c = this.tabContainers[i];
			let isSelected = i === this.selectedIndex;

			if (isSelected) {
				c.alpha = 1.0;
			} else {
				c.alpha = this.hoverInterpolators.get(c).getCurrentValue(now);
			}
		}

		if (this.selectionBarXInterpolator) {
			this.selectionBar.x = this.selectionBarXInterpolator.getCurrentValue(now);
			this.selectionBar.width = this.selectionBarWidthInterpolator.getCurrentValue(now);
		}
	}
}