import { InteractionGroup, InteractionRegistration } from "../../input/interactivity";
import { Interpolator } from "../../util/interpolation";
import { currentWindowDimensions, REFERENCE_SCREEN_HEIGHT } from "../../visuals/ui";
import { MathUtil, EaseType } from "../../util/math_util";
import { globalState } from "../../global_state";
import { DrawableTask } from "./drawable_task";
import { Task } from "../../multithreading/task";
import { KeyCode } from "../../input/input";

export const NOTIFICATION_PANEL_WIDTH = 300;
export const NOTIFICATION_PANEL_PADDING = 12;
export const NOTIFICATION_MARGIN = 12;

export class NotificationPanel {
	public container: PIXI.Container;
	public interactionGroup: InteractionGroup;
	public scalingFactor: number;

	private background: PIXI.Sprite;
	/** The actual panel that slides in */
	private panelContainer: PIXI.Container;
	private panelBackground: PIXI.Sprite;

	private fadeInInterpolator: Interpolator;

	private tasksHeading: PIXI.Text;
	private tasks: DrawableTask[] = [];

	/** Store the last time the notification panel is closed, so that when it is reopened again, we can run one update pass at that stored time. This is done to prevent sudden animations happening only when the panel is updated. The alternative would be to update the panel continuously even when it isn't visible, which is obviously a waste of resources. */
	private lastHideTime = -1e6;

	constructor() {
		this.container = new PIXI.Container();
		this.interactionGroup = new InteractionGroup();

		this.background = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.background.tint = 0x000000;
		this.background.alpha = 0.5;
		this.container.addChild(this.background);

		let backgroundRegistration = new InteractionRegistration(this.background);
		backgroundRegistration.enableEmptyListeners();
		backgroundRegistration.addListener('mouseDown', () => {
			// When you click on the background, it should close the notification panel
			this.hide();
		});
		backgroundRegistration.addListener('keyDown', (e) => {
			if (e.keyCode === KeyCode.Escape) this.hide();
		});
		this.interactionGroup.add(backgroundRegistration);

		this.panelContainer = new PIXI.Container();
		this.container.addChild(this.panelContainer);

		let panelRegistration = new InteractionRegistration(this.panelContainer);
		panelRegistration.enableEmptyListeners();
		this.interactionGroup.add(panelRegistration);

		this.panelBackground = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.panelBackground.tint = 0x101010;
		this.panelBackground.alpha = 0.95;
		this.panelContainer.addChild(this.panelBackground);

		this.tasksHeading = new PIXI.Text("TASKS");
		this.tasksHeading.style = {
			fontFamily: "Exo2-ExtraBold",
			fill: 0xffffff
		};
		this.panelContainer.addChild(this.tasksHeading);

		this.fadeInInterpolator = new Interpolator({
			duration: 500,
			reverseDuration: 350,
			ease: EaseType.EaseOutQuint,
			reverseEase: EaseType.EaseInQuint,
			beginReversed: true,
			defaultToFinished: true
		});

		this.resize();
		this.hide();
	}

	addTask(task: Task<any, any>) {
		let drawable = new DrawableTask(this, task);
		this.panelContainer.addChild(drawable.container);
		this.tasks.push(drawable);
	}

	resize() {
		this.scalingFactor = currentWindowDimensions.height / REFERENCE_SCREEN_HEIGHT;

		this.background.width = currentWindowDimensions.width;
		this.background.height = currentWindowDimensions.height;

		this.panelContainer.y = globalState.toolbar.currentHeight;
		this.panelBackground.width = Math.floor(NOTIFICATION_PANEL_WIDTH * this.scalingFactor);
		this.panelBackground.height = currentWindowDimensions.height - this.panelContainer.y;

		this.tasksHeading.style.fontSize = Math.floor(12 * this.scalingFactor);
		this.tasksHeading.x = Math.floor(NOTIFICATION_PANEL_PADDING * this.scalingFactor);

		for (let t of this.tasks) t.resize();
	}

	update(now: number) {
		let fadeInCompletion = this.fadeInInterpolator.getCurrentValue(now);
		if (fadeInCompletion === 0) {
			this.container.visible = false;
			return;
		}
		this.container.visible = true;

		this.background.alpha = MathUtil.lerp(0, 0.5, fadeInCompletion);

		this.panelContainer.x = currentWindowDimensions.width - MathUtil.lerp(0, this.panelContainer.width, fadeInCompletion);

		let currentY = Math.floor(NOTIFICATION_PANEL_PADDING * this.scalingFactor);
		this.tasksHeading.y = currentY;
		currentY += this.tasksHeading.height + Math.floor(NOTIFICATION_MARGIN * this.scalingFactor);

		for (let i = 0; i < this.tasks.length; i++) {
			let task = this.tasks[i];
			task.update(now);

			if (task.destroyable) {
				// Remove the task

				this.panelContainer.removeChild(task.container);
				this.tasks.splice(i--, 1);

				continue;
			}

			task.container.x = Math.floor(NOTIFICATION_PANEL_PADDING * this.scalingFactor);
			task.container.y = Math.floor(currentY);

			currentY += task.getHeight(now);
		}
	}

	show() {
		this.fadeInInterpolator.setReversedState(false, performance.now());
		this.interactionGroup.enable();

		this.update(this.lastHideTime);
	}

	hide() {
		let now = performance.now();

		this.fadeInInterpolator.setReversedState(true, now);
		this.interactionGroup.disable();

		this.lastHideTime = now;
	}

	toggle() {
		if (this.interactionGroup.enabled) this.hide();
		else this.show();
	}
}