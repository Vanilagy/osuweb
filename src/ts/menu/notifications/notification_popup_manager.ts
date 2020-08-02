import { NotificationPanel } from "./notification_panel";
import { currentWindowDimensions } from "../../visuals/ui";
import { NOTIFICATION_POPUP_WIDTH, NotificationPopup } from "./notification_popup";
import { InteractionGroup } from "../../input/interactivity";
import { MathUtil, EaseType } from "../../util/math_util";

const MARGIN = 10;
const MARGIN_BETWEEN = 5;
const POPUP_LIMIT = 5;

export class NotificationPopupManager {
	public container: PIXI.Container;
	public interactionGroup: InteractionGroup;
	private parent: NotificationPanel;

	private popups: NotificationPopup[] = [];

	constructor(parent: NotificationPanel) {
		this.container = new PIXI.Container();
		this.container.sortableChildren = true;
		this.interactionGroup = new InteractionGroup();
		this.parent = parent;
	}

	get scalingFactor() {
		return this.parent.scalingFactor;
	}

	addPopup(popup: NotificationPopup) {
		this.popups.unshift(popup);
		this.container.addChild(popup.container);
		this.interactionGroup.add(popup.interactionGroup);

		if (this.popups.length > POPUP_LIMIT) {
			for (let i = 5; i < this.popups.length; i++) {
				this.popups[i].close();
			}
		}
	}

	resize() {
		this.container.x = currentWindowDimensions.width - Math.floor((NOTIFICATION_POPUP_WIDTH + 10) * this.scalingFactor);
		
		for (let p of this.popups) p.resize();
	}

	update(now: number) {
		const margin = MARGIN_BETWEEN * this.scalingFactor;
		let currentY = currentWindowDimensions.height - MARGIN * this.scalingFactor;

		for (let i = 0; i < this.popups.length; i++) {
			let popup = this.popups[i];
			popup.container.zIndex = i;
			popup.update(now);

			if (popup.destroyable) {
				this.popups.splice(i--, 1);
				this.container.removeChild(popup.container);
				this.interactionGroup.remove(popup.interactionGroup);

				continue;
			}

			let fadeIn = popup.fadeInInterpolator.getCurrentValue(now);
			let fadeOutCompletion = popup.fadeOutInterpolator.getCurrentCompletion(now);
			let easedFadeOut = popup.swipedAway? MathUtil.ease(EaseType.EaseOutQuart, fadeOutCompletion) : popup.fadeOutInterpolator.getCurrentValue(now);

			currentY -= popup.container.height;
			popup.container.y = currentY;
			currentY -= margin * fadeIn * (1 - easedFadeOut);
			currentY += popup.container.height * easedFadeOut;
		}
	}

	closeAll() {
		for (let p of this.popups) p.close(true);
	}
}