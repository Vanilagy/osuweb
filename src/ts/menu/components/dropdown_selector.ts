import { InteractionGroup, InteractionRegistration } from "../../input/interactivity";
import { svgToTexture, createPolygonTexture } from "../../util/pixi_util";
import { colorToHexNumber, Colors, lerpColors } from "../../util/graphics_util";
import { THEME_COLORS } from "../../util/constants";
import { MathUtil, EaseType } from "../../util/math_util";
import { ListSelector, ListSelectorItem } from "./list_selector";
import { ScrollContainer } from "./scroll_container";
import { Interpolator } from "../../util/interpolation";
import { CustomEventEmitter } from "../../util/custom_event_emitter";

const SELECTION_HEIGHT = 28;
const LIST_ENTRY_HEIGHT = 20;
const MAX_SCROLL_HEIGHT = 190;
const chevronTexture = svgToTexture(document.querySelector('#svg-chevron-bottom'), true);

export class DropdownSelector extends CustomEventEmitter<{change: string}> {
	public container: PIXI.Container;
	public interactionGroup: InteractionGroup;
	public scalingFactor: number = 1;
	
	private options: Record<string, string>;
	private width: number;

	public selectionBackground: PIXI.Sprite;
	private selectionText: PIXI.Text;
	private chevron: PIXI.Sprite;

	public dropdownContainer: PIXI.Container;
	private scrollContainer: ScrollContainer;
	public dropdownBackground: PIXI.Sprite;
	private dropdownMask: PIXI.Sprite; // Masks the entire dropdown part, including scrollbar
	private listSelector: ListSelector;

	private hoverInterpolator: Interpolator;
	private pressdownInterpolator: Interpolator;
	public dropdownInterpolator: Interpolator;

	constructor(width: number) {
		super();

		this.container = new PIXI.Container();
		this.interactionGroup = new InteractionGroup();
		this.width = width;

		this.selectionBackground = new PIXI.Sprite();
		this.selectionBackground.tint = 0x000000;
		this.selectionBackground.alpha = 0.8;

		this.selectionText = new PIXI.Text('fra moment', {
			fontFamily: 'Exo2-Light',
			fill: 0xffffff
		});
	
		this.chevron = new PIXI.Sprite(chevronTexture);
		this.chevron.anchor.set(0.5, 0.5);
		this.chevron.tint = colorToHexNumber(THEME_COLORS.PrimaryViolet);

		this.container.addChild(this.selectionBackground, this.selectionText, this.chevron);

		let selectionRegistration = new InteractionRegistration(this.selectionBackground);
		this.interactionGroup.add(selectionRegistration);
		selectionRegistration.addButtonHandlers(
			() => this.dropdownInterpolator.reverse(performance.now()),
			() => this.hoverInterpolator.setReversedState(false, performance.now()),
			() => this.hoverInterpolator.setReversedState(true, performance.now()),
			() => this.pressdownInterpolator.setReversedState(false, performance.now()),
			() => this.pressdownInterpolator.setReversedState(true, performance.now())
		);

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

		this.dropdownContainer = new PIXI.Container();
		this.container.addChild(this.dropdownContainer);

		this.dropdownBackground = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.dropdownBackground.tint = this.selectionBackground.tint;
		this.dropdownBackground.alpha = this.selectionBackground.alpha;
		this.dropdownContainer.addChild(this.dropdownBackground);

		this.scrollContainer = new ScrollContainer();
		this.dropdownContainer.addChild(this.scrollContainer.container);
		this.interactionGroup.add(this.scrollContainer.interactionGroup);

		this.listSelector = new ListSelector();
		this.listSelector.itemWidth = this.width;
		this.listSelector.itemHeight = LIST_ENTRY_HEIGHT;
		this.listSelector.itemFontSize = 10;
		this.listSelector.itemFontFamily = 'Exo2-Light';
		this.listSelector.itemHighlightColor = THEME_COLORS.PrimaryViolet;
		this.listSelector.itemCornerRadius = 2;
		this.listSelector.itemMarginLeft = 10;
		this.listSelector.addListener('select', (name) => {
			this.setSelection(name);
			this.dropdownInterpolator.setReversedState(true, performance.now());
			this.emit('change', name);
		});

		this.scrollContainer.contentContainer.addChild(this.listSelector.container);
		this.scrollContainer.contentInteractionGroup.add(this.listSelector.interactionGroup);

		this.dropdownMask = new PIXI.Sprite();
		this.dropdownContainer.addChild(this.dropdownMask);
		this.dropdownContainer.mask = this.dropdownMask;

		this.dropdownInterpolator = new Interpolator({
			duration: 350,
			reverseDuration: 400,
			ease: EaseType.EaseOutQuint,
			reverseEase: EaseType.EaseInQuint,
			beginReversed: true,
			defaultToFinished: true
		});
	}

	setOptions(options: Record<string, string>) {
		this.options = options;
		let schema: ListSelectorItem[] = [];
		
		for (let key in options) {
			schema.push({
				name: key,
				label: options[key]
			});
		}

		this.listSelector.setSchema(schema);
	}

	setSelection(name: string) {
		this.selectionText.text = this.options[name];
		this.listSelector.setHighlight(name);
	}

	resize(scalingFactor: number) {
		this.scalingFactor = scalingFactor;

		this.selectionBackground.texture = createPolygonTexture(this.width, SELECTION_HEIGHT, [
			new PIXI.Point(0, 0), new PIXI.Point(this.width, 0), new PIXI.Point(this.width, SELECTION_HEIGHT), new PIXI.Point(0, SELECTION_HEIGHT)
		], this.scalingFactor, 0, false, 3);

		this.selectionText.style.fontSize = Math.floor(12 * this.scalingFactor);
		this.selectionText.y = Math.floor((this.selectionBackground.height - this.selectionText.height) / 2);
		this.selectionText.x = Math.floor(this.listSelector.itemMarginLeft * this.scalingFactor);

		this.chevron.y = Math.floor(this.selectionBackground.height / 2);
		this.chevron.x = this.selectionBackground.width - this.chevron.y;
		this.chevron.width = this.chevron.height = MathUtil.floorToMultiple(16 * this.scalingFactor, 2);

		this.listSelector.resize(this.scalingFactor);
		this.dropdownBackground.width = this.listSelector.container.width - 1;
		this.dropdownBackground.height = Math.min(this.listSelector.container.height - 1, Math.floor(MAX_SCROLL_HEIGHT * this.scalingFactor));

		this.dropdownContainer.y = this.selectionBackground.x + this.selectionBackground.height + Math.floor(5 * this.scalingFactor);
		this.scrollContainer.setHeight(Math.floor(MAX_SCROLL_HEIGHT * this.scalingFactor));
		this.scrollContainer.setWidth(this.dropdownBackground.width);
		this.scrollContainer.setScrollScalingFactor(this.scalingFactor);
		this.scrollContainer.setScrollbarScalingFactor(this.scalingFactor);

		this.dropdownMask.texture = createPolygonTexture(this.dropdownBackground.width, this.dropdownBackground.height, [
			new PIXI.Point(0, 0), new PIXI.Point(this.dropdownBackground.width, 0), new PIXI.Point(this.dropdownBackground.width, this.dropdownBackground.height), new PIXI.Point(0,  this.dropdownBackground.height)
		], 1, 0, false, 3); // Rounded corners
	}

	update(now: number) {
		let hoverValue = this.hoverInterpolator.getCurrentValue(now);
		let pressdownValue = this.pressdownInterpolator.getCurrentValue(now);

		let brightness = MathUtil.lerp(MathUtil.lerp(0, 0.1, hoverValue), 0.15, pressdownValue);
		this.selectionBackground.tint = colorToHexNumber(lerpColors(Colors.Black, Colors.White, brightness));

		this.listSelector.update(now);
		this.scrollContainer.update(now);

		let dropdownValue = this.dropdownInterpolator.getCurrentValue(now);
		this.dropdownMask.scale.y = dropdownValue;

		// Adjust chevron rotation
		this.chevron.rotation = MathUtil.lerp(0, Math.PI, dropdownValue);

		if (this.dropdownInterpolator.isReversed()) this.scrollContainer.interactionGroup.disable();
		else this.scrollContainer.interactionGroup.enable();
	}
}