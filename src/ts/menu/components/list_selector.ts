import { fitSpriteIntoContainer } from "../../util/pixi_util";
import { Interpolator } from "../../util/interpolation";
import { EaseType, MathUtil } from "../../util/math_util";
import { InteractionRegistration, InteractionGroup } from "../../input/interactivity";
import { EMPTY_FUNCTION } from "../../util/misc_util";
import { CustomEventEmitter } from "../../util/custom_event_emitter";

export interface ListSelectorItem {
	name: string,
	label: string,
	icon?: PIXI.Texture
}

/** Represents a generalized list selection interface (can be used for dropdowns, context menus, etc) */
export class ListSelector extends CustomEventEmitter<{select: string}> {
	public container: PIXI.Container;
	public interactionGroup: InteractionGroup;
	private schema: ListSelectorItem[];
	private drawables: ListSelectorItemDrawable[] = [];

	public itemWidth: number = 0;
	public itemHeight: number = 0;
	public itemFontSize: number = 0;
	public itemIconSize: number = 0;
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

	setRawItemDimensions(width: number, height: number, fontSize: number, iconSize: number) {
		this.itemWidth = width;
		this.itemHeight = height;
		this.itemFontSize = fontSize;
		this.itemIconSize = iconSize;
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
}

class ListSelectorItemDrawable {
	private parent: ListSelector;
	private item: ListSelectorItem;
	public container: PIXI.Container;
	public registration: InteractionRegistration;

	private highlightBackground: PIXI.Sprite;
	private label: PIXI.Text;
	private icon: PIXI.Sprite;

	private hoverInterpolator: Interpolator;
	private pressdownInterpolator: Interpolator;

	constructor(parent: ListSelector, item: ListSelectorItem) {
		this.parent = parent;
		this.item = item;
		this.container = new PIXI.Container;

		this.highlightBackground = new PIXI.Sprite(PIXI.Texture.WHITE);;
		this.container.addChild(this.highlightBackground);

		this.label = new PIXI.Text(item.label);
		this.label.style = {
			fontFamily: 'Exo2-Regular',
			fill: 0xffffff
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

		this.highlightBackground.width = width;
		this.highlightBackground.height = height;

		this.label.style.fontSize = Math.floor(this.parent.itemFontSize * this.parent.scalingFactor);
		this.label.pivot.y = Math.floor(this.label.height / 2);
		this.label.y = Math.floor(height / 2);
		this.label.x = Math.floor(height * 1.5);

		let iconSize = Math.floor(this.parent.itemIconSize * this.parent.scalingFactor);
		fitSpriteIntoContainer(this.icon, iconSize, iconSize);
		this.icon.anchor.set(0.0, 0.5);
		this.icon.x = Math.floor(height / 3);
		this.icon.y = Math.floor(height / 2);
	}

	update(now: number) {
		let hoverCompletion = this.hoverInterpolator.getCurrentValue(now);
		let pressdownCompletion = this.pressdownInterpolator.getCurrentValue(now);

		let backgroundAlpha = MathUtil.lerp(MathUtil.lerp(0, 0.10, hoverCompletion), 0.15, pressdownCompletion);
		this.highlightBackground.alpha = backgroundAlpha;
	}
}