import { InteractionGroup, InteractionRegistration, fullscreenHitRec } from "../../input/interactivity";
import { Color } from "../../util/graphics_util";
import { ListSelector } from "../components/list_selector";
import { currentWindowDimensions, REFERENCE_SCREEN_HEIGHT } from "../../visuals/ui";
import { Point } from "../../util/point";
import { getCurrentMousePosition, KeyCode } from "../../input/input";
import { Interpolator } from "../../util/interpolation";
import { EaseType, MathUtil } from "../../util/math_util";
import { removeItem } from "../../util/misc_util";

type ContextMenuDescription = {
	action: string,
	label: string,
	color?: Color
}[];

export class ContextMenuManager {
	public container: PIXI.Container;
	public interactionGroup: InteractionGroup;
	public scalingFactor: number = 1.0;

	private backgroundRegistration: InteractionRegistration;
	private contextMenus: ContextMenu[] = [];

	constructor() {
		this.container = new PIXI.Container();
		this.interactionGroup = new InteractionGroup();

		this.backgroundRegistration = new InteractionRegistration(fullscreenHitRec);
		this.backgroundRegistration.enableEmptyListeners();
		this.backgroundRegistration.allowAllMouseButtons();
		this.interactionGroup.add(this.backgroundRegistration);
		
		this.backgroundRegistration.addListener('mouseDown', () => {
			for (let c of this.contextMenus) {
				c.close();
			}
		});
		this.backgroundRegistration.addListener('keyDown', (e) => {
			if (e.keyCode === KeyCode.Escape) {
				for (let c of this.contextMenus) {
					c.close();
				}
			}
		});
	}

	showContextMenu(description: ContextMenuDescription, position: Point = getCurrentMousePosition()) {
		let contextMenu = new ContextMenu(this, description);

		this.container.addChild(contextMenu.container);
		this.interactionGroup.add(contextMenu.interactionGroup);
		this.contextMenus.push(contextMenu);

		contextMenu.container.position.set(position.x, position.y);

		this.resize(true);

		// Make sure the context menu doesn't go offscreen
		if (contextMenu.container.position.x + contextMenu.container.width >= currentWindowDimensions.width) {
			contextMenu.container.position.x = currentWindowDimensions.width - contextMenu.container.width;
		}
		if (contextMenu.container.position.y + contextMenu.container.height >= currentWindowDimensions.height) {
			contextMenu.container.position.y = currentWindowDimensions.height - contextMenu.container.height;
		}

		return new Promise(resolve => {
			contextMenu.listSelector.addListener('select', action => {
				resolve(action);
				contextMenu.close();
			});
		});
	}

	resize(manual = false) {
		let scalingFactor = currentWindowDimensions.height / REFERENCE_SCREEN_HEIGHT;
		this.scalingFactor = scalingFactor;

		for (let c of this.contextMenus) {
			if (manual) c.resize();
			else this.removeContextMenu(c); // Upon resize, instantly remove all context menus
		}
	}

	update(now: number) {
		let activeFound = false;

		for (let c of this.contextMenus) {
			c.update(now);
			if (c.isOpen()) activeFound = true;
		}

		if (activeFound) {
			this.backgroundRegistration.enable();
		} else {
			this.backgroundRegistration.disable();
		}
	}

	removeContextMenu(menu: ContextMenu) {
		this.container.removeChild(menu.container);
		this.interactionGroup.remove(menu.interactionGroup);
		removeItem(this.contextMenus, menu);
	}
}

class ContextMenu {
	public container: PIXI.Container;
	public interactionGroup: InteractionGroup;
	private parent: ContextMenuManager;

	public listSelector: ListSelector;
	private background: PIXI.Sprite;

	private interpolator: Interpolator;

	constructor(parent: ContextMenuManager, description: ContextMenuDescription) {
		this.container = new PIXI.Container();
		this.interactionGroup = new InteractionGroup();
		this.parent = parent;

		this.background = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.background.tint = 0x101010;
		this.background.alpha = 0.95;
		this.container.addChild(this.background);

		let listSelector = new ListSelector();
		listSelector.itemWidth = 170;
		listSelector.itemHeight = 30;
		listSelector.itemFontSize = 14;
		listSelector.itemMarginLeft = 20;
		listSelector.itemFontFamily = 'Exo2-Bold';

		listSelector.setSchema(description.map(x => {
			return {
				name: x.action,
				label: x.label,
				color: x.color
			};
		}));
		this.container.addChild(listSelector.container);
		this.interactionGroup.add(listSelector.interactionGroup);

		this.listSelector = listSelector;

		this.interpolator = new Interpolator({
			duration: 500,
			reverseDuration: 100,
			ease: EaseType.EaseOutElasticHalf,
			reverseEase: EaseType.EaseInQuad,
			defaultToFinished: true,
			beginReversed: true
		});
		this.interpolator.setReversedState(false, performance.now());
	}

	resize() {
		this.listSelector.resize(this.parent.scalingFactor);
		this.background.width = this.listSelector.container.width;
		this.background.height = this.listSelector.container.height;
	}

	update(now: number) {
		let interpolationValue = this.interpolator.getCurrentValue(now);

		this.listSelector.update(now);

		this.container.alpha = Math.min(interpolationValue, 1);
		this.container.scale.y = MathUtil.lerp(0.5, 1.0, interpolationValue);
		this.container.pivot.y = MathUtil.lerp(10 * this.parent.scalingFactor, 0, interpolationValue);
	}

	close() {
		if (!this.isOpen()) return;

		this.interpolator.setReversedState(true, performance.now());
		this.interactionGroup.disable();

		setTimeout(() => {
			this.parent.removeContextMenu(this);
		}, 1000);
	}

	isOpen() {
		return !this.interpolator.isReversed();
	}
}