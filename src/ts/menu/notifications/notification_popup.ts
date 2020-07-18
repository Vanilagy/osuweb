import { NotificationType, notificationTypeToColor, Notification } from "./notification";
import { InteractionGroup, InteractionRegistration } from "../../input/interactivity";
import { colorToHexNumber } from "../../util/graphics_util";
import { createPolygonTexture, cutOffText } from "../../util/pixi_util";
import { NotificationPopupManager } from "./notification_popup_manager";
import { Interpolator } from "../../util/interpolation";
import { EaseType, MathUtil } from "../../util/math_util";
import { globalState } from "../../global_state";
import { Vector2, addToPoint } from "../../util/point";

export const NOTIFICATION_POPUP_WIDTH = 270;
export const NOTIFICATION_POPUP_HEIGHT = 38;
export const POPUP_LONGEVITY = 6000; // How long popups last 'til they automatically disappear.

export class NotificationPopup {
	private parent: NotificationPopupManager;
	public container: PIXI.Container;
	public interactionGroup: InteractionGroup;
	private registration: InteractionRegistration;
	private connectedNotification: Notification;

	private body: string;
	
	private mask: PIXI.Sprite;
	private background: PIXI.Sprite;
	private topHighlight: PIXI.Sprite;
	private heading: PIXI.Text;
	private contentText: PIXI.Text;

	public spawnTime: number;
	public closed = false;
	public destroyable = false;
	public fadeInInterpolator: Interpolator;
	public fadeOutInterpolator: Interpolator;
	public hoverInterpolator: Interpolator;
	public pressdownInterpolator: Interpolator;

	public currentDragOffset: Vector2 = {x: 0, y: 0};
	public snappingBack = false;
	public snapBackInterpolator: Interpolator;
	public swipedAway = false;

	constructor(parent: NotificationPopupManager, header: string, body: string, type: NotificationType, connectedNotification: Notification = null) {
		this.container = new PIXI.Container();
		this.interactionGroup = new InteractionGroup();
		this.parent = parent;
		this.connectedNotification = connectedNotification;

		this.body = body;

		this.mask = new PIXI.Sprite();
		this.container.addChild(this.mask);
		this.container.mask = this.mask;

		this.background = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.background.tint = 0x101010;
		this.background.alpha = 0.95;
		this.container.addChild(this.background);

		this.topHighlight = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.topHighlight.tint = colorToHexNumber(notificationTypeToColor.get(type));
		this.container.addChild(this.topHighlight);

		this.heading = new PIXI.Text(header, {
			fontFamily: "Exo2-Regular",
			fill: 0xffffff
		});
		this.container.addChild(this.heading);

		this.contentText = new PIXI.Text("", {
			fontFamily: "Exo2-Light",
			fill: colorToHexNumber({r: 192, g: 192, b: 192})
		});
		this.container.addChild(this.contentText);
		
		let now = performance.now();

		this.fadeInInterpolator = new Interpolator({
			duration: 500,
			ease: EaseType.EaseOutElasticQuarter
		});
		this.fadeInInterpolator.start(now);
		this.spawnTime = now;

		this.fadeOutInterpolator = new Interpolator({
			duration: 500,
			ease: EaseType.EaseInElastic,
			p: 0.9
		});

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

		this.snappingBack = false;
		this.snapBackInterpolator = new Interpolator({
			duration: 400,
			ease: EaseType.EaseOutCubic
		});

		this.registration = new InteractionRegistration(this.container);
		this.registration.enableEmptyListeners();
		this.interactionGroup.add(this.registration);

		this.registration.addButtonHandlers(
			() => ((this.connectedNotification)? globalState.notificationPanel.show() : this.close(true)),
			() => this.hoverInterpolator.setReversedState(false, performance.now()),
			() => this.hoverInterpolator.setReversedState(true, performance.now()),
			() => this.pressdownInterpolator.setReversedState(false, performance.now()),
			() => this.pressdownInterpolator.setReversedState(true, performance.now())
		);
		this.registration.makeDraggable(() => {
			this.snappingBack = false;
			this.currentDragOffset.x = this.container.x;
		}, (e) => {
			if (Math.abs(e.distanceFromStart.x) >= 5) this.registration.releaseAllPresses();

			addToPoint(this.currentDragOffset, e.movement);
			this.currentDragOffset.x = Math.max(this.currentDragOffset.x, 0);
		}, (e) => {
			this.snappingBack = true;

			let x = this.currentDragOffset.x / this.parent.scalingFactor;
			this.snapBackInterpolator.setValueRange(x, 0);
			this.snapBackInterpolator.start(performance.now());

			// If the user let go with high velocity or has dragged the popup more than halfway to the right, swipe it away
			if (e.velocity.x * this.parent.scalingFactor > 1250 || e.velocity.x >= 0 && x >= this.container.width / this.parent.scalingFactor / 2) {
				this.close(true);
			}
		});

		this.resize();
	}

	resize() {
		let slantWidth = NOTIFICATION_POPUP_HEIGHT/5;
		this.mask.texture = createPolygonTexture(NOTIFICATION_POPUP_WIDTH + slantWidth, NOTIFICATION_POPUP_HEIGHT, [
			new PIXI.Point(0, 0), new PIXI.Point(NOTIFICATION_POPUP_WIDTH, 0), new PIXI.Point(NOTIFICATION_POPUP_WIDTH + slantWidth, NOTIFICATION_POPUP_HEIGHT), new PIXI.Point(slantWidth, NOTIFICATION_POPUP_HEIGHT)
		], this.parent.scalingFactor, 0, false, 0);
		this.mask.x = -Math.floor(slantWidth * this.parent.scalingFactor);

		this.background.x = this.mask.x;
		this.background.width = Math.floor((NOTIFICATION_POPUP_WIDTH + slantWidth) * this.parent.scalingFactor);
		this.background.height = Math.floor(NOTIFICATION_POPUP_HEIGHT * this.parent.scalingFactor);

		this.topHighlight.x = this.mask.x;
		this.topHighlight.width = this.background.width;
		this.topHighlight.height = Math.ceil(1 * this.parent.scalingFactor);

		this.heading.style.fontSize = Math.floor(10 * this.parent.scalingFactor);
		this.heading.x = Math.floor(8 * this.parent.scalingFactor);
		this.heading.y = this.topHighlight.height + Math.floor(6 * this.parent.scalingFactor);
		
		this.contentText.style.fontSize = Math.floor(9 * this.parent.scalingFactor);
		this.contentText.x = this.heading.x;
		this.contentText.y = this.heading.y + Math.floor(14 * this.parent.scalingFactor);
		cutOffText(this.contentText, this.body, this.background.width - slantWidth - 18 * this.parent.scalingFactor);
	}

	update(now: number) {
		let fadeInValue = this.fadeInInterpolator.getCurrentValue(now);
		let fadeOutValue = this.fadeOutInterpolator.getCurrentValue(now);

		if (fadeOutValue === 1) this.destroyable = true;

		this.container.alpha = Math.min(1, fadeInValue * (1 - fadeOutValue));
		this.container.scale.y = fadeInValue;

		this.container.x = MathUtil.lerp(150 * this.parent.scalingFactor, 0, fadeInValue);
		if (!this.swipedAway) {
			// If the panel disappeared naturally, move it away with an elastic animation
			this.container.x += MathUtil.lerp(0, 150 * this.parent.scalingFactor, fadeOutValue);
		} else {
			// Otherwise, make the thing go whoosh.
			let fadeOutCompletion = this.fadeOutInterpolator.getCurrentCompletion(now);
			this.container.x += MathUtil.lerp(0, 1100 * this.parent.scalingFactor, fadeOutCompletion);
		}

		if (this.snappingBack) {
			this.container.x += this.snapBackInterpolator.getCurrentValue(now) * this.parent.scalingFactor;
		} else {
			this.container.x += this.currentDragOffset.x;
		}

		let hoverValue = this.hoverInterpolator.getCurrentValue(now);
		let pressdownValue = this.pressdownInterpolator.getCurrentValue(now);
		this.background.tint = Math.floor(MathUtil.lerp(MathUtil.lerp(15, 6, hoverValue), 1, pressdownValue)) * 0x10101;

		if (this.registration.mouseInside) this.spawnTime = now;
		if (now - this.spawnTime >= POPUP_LONGEVITY) this.close();
	}

	close(userInitiated = false) {
		if (this.closed) return;
		this.closed = true;

		if (userInitiated) {
			this.swipedAway = true;
			if (this.connectedNotification) this.connectedNotification.close(); // Close the corresponding notification in the notification panel
		}

		this.fadeOutInterpolator.start(performance.now());
		this.interactionGroup.disable();
	}
}