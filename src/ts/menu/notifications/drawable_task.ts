import { NOTIFICATION_PANEL_WIDTH, NOTIFICATION_PANEL_PADDING, NotificationPanel } from "./notification_panel";
import { ProgressBar } from "../components/progress_bar";
import { Task } from "../../multithreading/task";
import { MathUtil, TAU } from "../../util/math_util";
import { LoadingIndicator } from "../components/loading_indicator";
import { NotificationPanelEntry, NOTIFICATION_PADDING } from "./notification_panel_entry";
import { THEME_COLORS } from "../../util/constants";

const HEIGHT = 50;

/** Used to draw tasks in the notification panel. */
export class DrawableTask extends NotificationPanelEntry {
	private task: Task<any, any>;
	private loadingIndicator: LoadingIndicator;
	private progressBar: ProgressBar;
	private pendingText: PIXI.Text;

	constructor(parent: NotificationPanel, task: Task<any, any>) {
		super(parent, task.descriptor, THEME_COLORS.PrimaryViolet, false);
		this.task = task;

		this.loadingIndicator = new LoadingIndicator(NOTIFICATION_PANEL_WIDTH - NOTIFICATION_PANEL_PADDING*2 - NOTIFICATION_PADDING*2);
		this.loadingIndicator.start();
		this.container.addChild(this.loadingIndicator.container);

		this.progressBar = new ProgressBar(NOTIFICATION_PANEL_WIDTH - NOTIFICATION_PANEL_PADDING*2 - NOTIFICATION_PADDING*2);
		this.progressBar.setProgress(0.0);
		this.progressBar.setAbsoluteData(0, 0);
		this.container.addChild(this.progressBar.container);

		this.pendingText = new PIXI.Text("pending...");
		this.pendingText.style = {
			fontFamily: "Exo2-Light",
			fill: 0xffffff
		};
		this.pendingText.alpha = 0.666;
		this.container.addChild(this.pendingText);

		this.task.getResult().finally(() => {
			this.close();
		});

		this.resize();
	}

	calculateRawHeight() {
		return HEIGHT;
	}

	resize() {
		super.resize();

		let height = this.calculateRawHeight();

		this.loadingIndicator.resize(this.parent.scalingFactor);
		this.loadingIndicator.container.x = this.heading.x;
		this.loadingIndicator.container.y = Math.floor((height - NOTIFICATION_PADDING - 1) * this.parent.scalingFactor);

		this.progressBar.resize(this.parent.scalingFactor);
		this.progressBar.container.x = this.loadingIndicator.container.x;
		this.progressBar.container.y = this.loadingIndicator.container.y;

		this.pendingText.style.fontSize = Math.floor(10 * this.parent.scalingFactor);
		this.pendingText.x = this.heading.x;
		this.pendingText.y = Math.floor((height - NOTIFICATION_PADDING - 1) * this.parent.scalingFactor - this.pendingText.height);
	}

	update(now: number) {
		super.update(now);
		if (this.destroyable) return;

		this.pendingText.visible = false;
		this.loadingIndicator.container.visible = false;
		this.progressBar.container.visible = false;

		if (this.task.awaitingTask) {
			this.pendingText.visible = true;

			// Make the pending text oscillate in brightness a bit
			this.pendingText.alpha = MathUtil.lerp(0.4, 0.666, Math.cos(now / 1000 * TAU) * 0.5 + 0.5);
		} else {
			let progress = this.task.getProgress();
			if (progress) {
				// If there is progress data, show a loading bar
				this.progressBar.container.visible = true;
	
				this.progressBar.setProgress(progress.completion);
				this.progressBar.setAbsoluteData(progress.dataCompleted, progress.dataTotal);
				this.progressBar.setExtras(true, progress.dataCompleted !== undefined, this.task.isPaused());

				this.progressBar.update(now);
			} else {
				// ...otherwise, show a generic loading indicator.
				this.loadingIndicator.container.visible = true;
				this.loadingIndicator.update(now);
			}
		}
	}
}