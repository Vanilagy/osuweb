import { InterpolatedCounter, Interpolator } from "../../util/graphics_util";
import { EaseType } from "../../util/math_util";
import { Interactivity } from "../../input/interactivity";
import { CustomEventEmitter } from "../../util/custom_event_emitter";

export class TabSelector extends CustomEventEmitter {
	public container: PIXI.Container;
	private tabStrings: string[];
	private tabContainers: PIXI.Container[] = [];
	private selectionBar: PIXI.Sprite;
	private selectedIndex = 0;
	private selectionBarXInterpolator: InterpolatedCounter;
	private selectionBarWidthInterpolator: InterpolatedCounter;
	private hoverInterpolators = new WeakMap<PIXI.Container, Interpolator>();

	constructor(tabStrings: string[]) {
		super();

		this.container = new PIXI.Container();
		this.tabStrings = tabStrings;

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
				duration: 150
			});
			hoverInterpolator.reverse();
			this.hoverInterpolators.set(container, hoverInterpolator);

			let interaction = Interactivity.registerDisplayObject(container);
			interaction.addListener('mouseDown', () => {
				this.setSelection(i);
				this.emit('selection', i);
			});
			interaction.addListener('mouseEnter', () => {
				hoverInterpolator.setReversedState(false);
			});
			interaction.addListener('mouseLeave', () => {
				hoverInterpolator.setReversedState(true);
			});
		}

		this.selectionBar = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.selectionBar.tint = 0x6FC2FF;
		this.container.addChild(this.selectionBar);
	}

	private setSelection(index: number) {
		if (index === this.selectedIndex) return;
		this.selectedIndex = index;

		let selectionBarWidth: number;
		let selectionBarX: number;

		for (let i = 0; i < this.tabContainers.length; i++) {
			let c = this.tabContainers[i];
			let text = c.children[0] as PIXI.Text;
			let isSelected = i === this.selectedIndex;

			text.style.fontFamily = isSelected? 'Exo2-Bold' : 'Exo2-Regular';
			
			if (isSelected) {
				selectionBarWidth = text.width;
				selectionBarX = text.x;
			}
		}

		this.selectionBarXInterpolator.setGoal(selectionBarX);
		this.selectionBarWidthInterpolator.setGoal(selectionBarWidth);
	}

	resize(scalingFactor: number) {
		let currentX = 0;
		let selectionBarWidth: number;
		let selectionBarX: number;
		
		for (let i = 0; i < this.tabContainers.length; i++) {
			let c = this.tabContainers[i];
			let text = c.children[0] as PIXI.Text;
			let isSelected = i === this.selectedIndex;

			text.x = Math.floor(currentX);
			text.style = {
				fontFamily: isSelected? 'Exo2-Bold' : 'Exo2-Regular',
				fill: 0xffffff,
				fontSize: Math.floor(12 * scalingFactor),
				dropShadow: true,
				dropShadowDistance: 1,
				dropShadowBlur: 0
			};

			let textWidth = text.width;
			currentX += textWidth + 11 * scalingFactor; // some margin thing, TODO make parameterizable

			if (isSelected) {
				selectionBarWidth = textWidth;
				selectionBarX = text.x;
			}
		}

		if (!this.selectionBarXInterpolator) {
			this.selectionBarXInterpolator = new InterpolatedCounter({
				initial: selectionBarX,
				duration: 150,
				ease: EaseType.EaseOutCubic
			});
			this.selectionBarWidthInterpolator = new InterpolatedCounter({
				initial: selectionBarWidth,
				duration: 150,
				ease: EaseType.EaseOutCubic
			});
		} else {
			this.selectionBarXInterpolator.setGoal(selectionBarX);
			this.selectionBarWidthInterpolator.setGoal(selectionBarWidth);
		}

		this.selectionBar.width = Math.ceil(selectionBarWidth);
		this.selectionBar.height = Math.ceil(1 * scalingFactor);
		this.selectionBar.y = Math.floor(17 * scalingFactor);

		this.container.pivot.y = this.container.height;
	}

	update() {
		for (let i = 0; i < this.tabContainers.length; i++) {
			let c = this.tabContainers[i];
			let isSelected = i === this.selectedIndex;

			if (isSelected) {
				c.alpha = 1.0;
			} else {
				c.alpha = this.hoverInterpolators.get(c).getCurrentValue();
			}
		}

		if (this.selectionBarXInterpolator) {
			this.selectionBar.x = this.selectionBarXInterpolator.getCurrentValue();
			this.selectionBar.width = this.selectionBarWidthInterpolator.getCurrentValue();
		}
	}
}