import { NOTIFICATION_PANEL_WIDTH, NOTIFICATION_PANEL_PADDING, NotificationPanel, NOTIFICATION_MARGIN } from "./notification_panel";
import { colorToHexNumber } from "../../util/graphics_util";
import { THEME_COLORS } from "../../util/constants";
import { ProgressBar } from "../components/progress_bar";
import { Task } from "../../multithreading/task";
import { Interpolator } from "../../util/interpolation";
import { EaseType, MathUtil, TAU } from "../../util/math_util";
import { LoadingIndicator } from "../components/loading_indicator";

const HEIGHT = 50;
const PADDING = 7;

/** Used to draw tasks in the notification panel. */
export class DrawableTask {
	private task: Task<any, any>;
	private parent: NotificationPanel;
	public container: PIXI.Container;
	private background: PIXI.Sprite;
	private topHighlight: PIXI.Sprite;

	private title: PIXI.Text;
	private loadingIndicator: LoadingIndicator;
	private progressBar: ProgressBar;
	private pendingText: PIXI.Text;

	private fadeInInterpolator: Interpolator;
	/** If this is set to true, then this drawawble should be disposed. */
	public destroyable = false;

	constructor(parent: NotificationPanel, task: Task<any, any>) {
		this.task = task;
		this.parent = parent;
		this.container = new PIXI.Container();

		this.background = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.background.tint = 0x000000;
		this.background.alpha = 0.8;
		this.container.addChild(this.background);

		this.topHighlight = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.topHighlight.tint = colorToHexNumber(THEME_COLORS.PrimaryViolet);
		this.container.addChild(this.topHighlight);

		this.title = new PIXI.Text(task.descriptor);
		this.title.style = {
			fontFamily: "Exo2-Regular",
			fill: 0xffffff
		};
		this.container.addChild(this.title);

		this.loadingIndicator = new LoadingIndicator(NOTIFICATION_PANEL_WIDTH - NOTIFICATION_PANEL_PADDING*2 - PADDING*2);
		this.loadingIndicator.start();
		this.container.addChild(this.loadingIndicator.container);

		this.progressBar = new ProgressBar(NOTIFICATION_PANEL_WIDTH - NOTIFICATION_PANEL_PADDING*2 - PADDING*2);
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

		this.fadeInInterpolator = new Interpolator({
			duration: 500,
			ease: EaseType.EaseOutElasticHalf,
			reverseEase: EaseType.EaseInCubic
		});
		this.fadeInInterpolator.start(performance.now());

		this.task.getResult().finally(() => {
			this.close();
		});

		this.resize();
	}

	resize() {
		this.background.width = Math.floor((NOTIFICATION_PANEL_WIDTH - NOTIFICATION_PANEL_PADDING*2) * this.parent.scalingFactor);
		this.background.height = Math.floor(HEIGHT * this.parent.scalingFactor);

		this.topHighlight.width = this.background.width;
		this.topHighlight.height = Math.ceil(1 * this.parent.scalingFactor);

		this.title.style.fontSize = Math.floor(12 * this.parent.scalingFactor);
		this.title.x = Math.floor(PADDING * this.parent.scalingFactor);
		this.title.y = this.topHighlight.height + Math.floor(PADDING * this.parent.scalingFactor);

		this.loadingIndicator.resize(this.parent.scalingFactor);
		this.loadingIndicator.container.x = this.title.x;
		this.loadingIndicator.container.y = Math.floor((HEIGHT - PADDING - 1) * this.parent.scalingFactor);

		this.progressBar.resize(this.parent.scalingFactor);
		this.progressBar.container.x = this.loadingIndicator.container.x;
		this.progressBar.container.y = this.loadingIndicator.container.y;

		this.pendingText.style.fontSize = Math.floor(10 * this.parent.scalingFactor);
		this.pendingText.x = this.title.x;
		this.pendingText.y = Math.floor((HEIGHT - PADDING - 1) * this.parent.scalingFactor - this.pendingText.height);
	}

	update(now: number) {
		let fadeInCompletion = this.fadeInInterpolator.getCurrentValue(now);
		this.container.scale.y = fadeInCompletion;
		this.container.alpha = Math.min(1, fadeInCompletion);

		if (fadeInCompletion === 0 && this.task.destroyed) {
			this.destroyable = true;
			return;
		}

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

	close() {
		this.fadeInInterpolator.setReversedState(true, performance.now());
		this.fadeInInterpolator.start(performance.now());
	}

	getHeight(now: number) {
		return this.container.height + NOTIFICATION_MARGIN * this.parent.scalingFactor * this.fadeInInterpolator.getCurrentValue(now);
	}
}