import { fitSpriteIntoContainer, createPolygonTexture } from "../../util/pixi_util";
import { Interpolator } from "../../util/interpolation";
import { EaseType, MathUtil } from "../../util/math_util";
import { InteractionRegistration, InteractionGroup } from "../../input/interactivity";
import { CustomEventEmitter } from "../../util/custom_event_emitter";
import { Color, Colors, colorToHexNumber, lerpColors } from "../../util/graphics_util";

export interface ListSelectorItem {
	name: string,
	label: string,
	icon?: PIXI.Texture,
	color?: Color
}

/** Represents a generalized list selection interface (can be used for dropdowns, context menus, etc) */
export class ListSelector extends CustomEventEmitter<{select: string}> {
	public container: PIXI.Container;
	public interactionGroup: InteractionGroup;
	private schema: ListSelectorItem[];
	private drawables: ListSelectorItemDrawable[] = [];

	public itemWidth: number = 0;
	public itemHeight: number = 0;
	public itemFontFamily: string = 'Exo2-Regular';
	public itemFontSize: number = 0;
	public itemIconSize: number = 0;
	public itemHoverColor: Color = Colors.White; // Color of an item when hovered over
	public itemHighlightColor: Color = Colors.Red; // Color of a highlit item
	public itemCornerRadius: number = 0;
	public itemMarginLeft: number = 5;

	public scalingFactor: number = 1;

	constructor() {
		super();

		this.container = new PIXI.Container();
		this.interactionGroup = new InteractionGroup();
	}

	setSchema(schema: ListSelectorItem[]) {
		this.schema = schema;

		// Properly destroy all current drawables
		for (let drawable of this.drawables) {
			drawable.registration.detach();
		}

		this.drawables.length = 0;
		this.container.removeChildren();

		// Create new drawables based on the schema
		for (let item of schema) {
			let drawable = new ListSelectorItemDrawable(this, item);
			this.container.addChild(drawable.container);
			this.interactionGroup.add(drawable.registration);
			this.drawables.push(drawable);
		}
	}

	resize(scalingFactor: number) {
		this.scalingFactor = scalingFactor;
		let scaledHeight = Math.floor(scalingFactor * this.itemHeight);

		for (let i = 0; i < this.drawables.length; i++) {
			let drawable = this.drawables[i];

			drawable.resize();
			drawable.container.y = i * scaledHeight;
		}
	}

	update(now: number) {
		for (let drawable of this.drawables) {
			drawable.update(now);
		}
	}

	setHighlight(name: string) {
		// Unhighlight all other elements, highlight the specified one
		for (let d of this.drawables) {
			d.unhighlight();
			if (d.item.name === name) d.highlight();
		}
	}
}

class ListSelectorItemDrawable {
	private parent: ListSelector;
	public item: ListSelectorItem;
	public container: PIXI.Container;
	public registration: InteractionRegistration;

	private highlightBackground: PIXI.Sprite;
	private label: PIXI.Text;
	private icon: PIXI.Sprite;

	private hoverInterpolator: Interpolator;
	private pressdownInterpolator: Interpolator;
	private highlightInterpolator: Interpolator;

	constructor(parent: ListSelector, item: ListSelectorItem) {
		this.parent = parent;
		this.item = item;
		this.container = new PIXI.Container;

		this.highlightBackground = new PIXI.Sprite();
		this.container.addChild(this.highlightBackground);

		this.label = new PIXI.Text(item.label);
		this.label.style = {
			fontFamily: this.parent.itemFontFamily,
			fill: item.color? colorToHexNumber(item.color) : 0xffffff
		};
		this.container.addChild(this.label);

		this.icon = new PIXI.Sprite();
		if (item.icon) this.icon.texture = item.icon;
		this.container.addChild(this.icon);

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
		this.highlightInterpolator = new Interpolator({
			duration: 100,
			beginReversed: true,
			defaultToFinished: true
		});

		this.registration = new InteractionRegistration(this.container);
		this.registration.addButtonHandlers(
			() => this.parent.emit('select', this.item.name),
			() => this.hoverInterpolator.setReversedState(false, performance.now()),
			() => this.hoverInterpolator.setReversedState(true, performance.now()),
			() => this.pressdownInterpolator.setReversedState(false, performance.now()),
			() => this.pressdownInterpolator.setReversedState(true, performance.now())
		);
	}

	resize() {
		let width = Math.floor(this.parent.itemWidth * this.parent.scalingFactor);
		let height = Math.floor(this.parent.itemHeight * this.parent.scalingFactor);

		this.highlightBackground.texture = createPolygonTexture(width, height, [
			new PIXI.Point(0, 0), new PIXI.Point(width, 0), new PIXI.Point(width, height), new PIXI.Point(0, height)
		], 1, 0, false, this.parent.itemCornerRadius * this.parent.scalingFactor);

		this.label.style.fontSize = Math.floor(this.parent.itemFontSize * this.parent.scalingFactor);
		this.label.y = Math.floor((height - this.label.height) / 2);
		this.label.x = Math.floor(this.parent.itemMarginLeft * this.parent.scalingFactor);

		let iconSize = Math.floor(this.parent.itemIconSize * this.parent.scalingFactor);
		fitSpriteIntoContainer(this.icon, iconSize, iconSize);
		this.icon.width = Math.floor(this.icon.width);
		this.icon.height = Math.floor(this.icon.height);
		this.icon.x = Math.floor(height / 3);
		this.icon.y = Math.floor(height / 2 - this.icon.height/2);
	}

	update(now: number) {
		let hoverCompletion = this.hoverInterpolator.getCurrentValue(now);
		let pressdownCompletion = this.pressdownInterpolator.getCurrentValue(now);
		let highlightCompletion = this.highlightInterpolator.getCurrentValue(now);

		// Interpolate between the hover color and highlight color. The highlight color will shift slightly towards the hover color again, if the item is highlit and is being hovered over right now.
		this.highlightBackground.tint = colorToHexNumber(lerpColors(this.parent.itemHoverColor, lerpColors(this.parent.itemHighlightColor, this.parent.itemHoverColor, hoverCompletion * 0.1), highlightCompletion));

		// Interpolate the background's alpha based on hover, pressdown and highlight completions.
		let backgroundAlpha = MathUtil.lerp(MathUtil.lerp(MathUtil.lerp(0, 0.10, hoverCompletion), 0.15, pressdownCompletion), 1.0, highlightCompletion);
		this.highlightBackground.alpha = backgroundAlpha;
	}
	
	highlight() {
		this.highlightInterpolator.setReversedState(false, performance.now());
	}

	unhighlight() {
		this.highlightInterpolator.setReversedState(true, performance.now());
	}
}