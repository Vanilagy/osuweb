import { InteractionGroup, InteractionRegistration } from "../../input/interactivity";
import { calculateRatioBasedScalingFactor, colorToHexNumber } from "../../util/graphics_util";
import { currentWindowDimensions, REFERENCE_SCREEN_HEIGHT } from "../../visuals/ui";
import { createPolygonTexture, svgToTexture } from "../../util/pixi_util";
import { DEFAULT_BUTTON_HEIGHT, Button, DEFAULT_BUTTON_WIDTH, ButtonPivot } from "../components/button";
import { Interpolator } from "../../util/interpolation";
import { EaseType, MathUtil } from "../../util/math_util";
import { THEME_COLORS } from "../../util/constants";
import { supportsNativeFileSystemApi, EMPTY_FUNCTION } from "../../util/misc_util";
import { VirtualDirectory } from "../../file_system/virtual_directory";
import { KeyCode } from "../../input/input";
import { ImportBeatmapsFromDirectoryTask } from "../../datamodel/beatmap/beatmap_library";
import { LoadingIndicator } from "../components/loading_indicator";

const PANEL_WIDTH = 420;
const PANEL_HEIGHT = 250;
const LEFT_MARGIN = 70;
const TOP_MARGIN = 22;

const plusTexture = svgToTexture(document.querySelector('#svg-plus'), true);

export class FolderSelector {
	public container: PIXI.Container;
	public interactionGroup: InteractionGroup;
	private scalingFactor: number = 1.0;

	private background: PIXI.Sprite;
	private centerContainer: PIXI.Container;
	private mask: PIXI.Sprite;
	private centerContainerBackground: PIXI.Sprite;

	private header: PIXI.Text;
	private description: PIXI.Text;
	/** A warning that will be shown when the Native File System API isn't available. */
	private warning: PIXI.Text;

	private closeButton: PIXI.Sprite;
	private selectButton: Button;

	private loadingContainer: PIXI.Container;
	private loadingText: PIXI.Text;
	private loadingIndicator: LoadingIndicator;

	private fadeInInterpolator: Interpolator;
	private closeButtonInterpolator: Interpolator;

	private loadingTask: ImportBeatmapsFromDirectoryTask = null;

	constructor() {
		this.container = new PIXI.Container();
		this.interactionGroup = new InteractionGroup();

		this.background = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.background.tint = 0x000000;
		this.background.alpha = 0.8;
		this.container.addChild(this.background);
		let backgroundRegistration = new InteractionRegistration(this.background);
		backgroundRegistration.enableEmptyListeners();
		this.interactionGroup.add(backgroundRegistration);

		this.centerContainer = new PIXI.Container();
		this.container.addChild(this.centerContainer);

		this.mask = new PIXI.Sprite();
		this.centerContainer.addChild(this.mask);

		this.centerContainerBackground = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.centerContainerBackground.tint = 0x000000;
		this.centerContainerBackground.alpha = 0.8;
		this.centerContainerBackground.mask = this.mask;
		this.centerContainer.addChild(this.centerContainerBackground);

		this.header = new PIXI.Text("import folder");
		this.header.style = {
			fontFamily: 'Exo2-BoldItalic',
			fill: 0xffffff
		};
		this.centerContainer.addChild(this.header);

		this.description = new PIXI.Text("Select a folder with beatmaps, a single beatmap folder or a beatmap file. (.osz)");
		this.description.style = {
			fontFamily: 'Exo2-RegularItalic',
			fill: 0xffffff,
			wordWrap: true
		};
		this.description.alpha = 0.75;
		this.centerContainer.addChild(this.description);

		this.warning = new PIXI.Text("WARNING: Your browser doesn't yet support the Native File System API, or it is disabled. This means that loading folders with more than ~500 beatmaps will freeze your browser for a considerable amount of time.");
		this.warning.style = {
			fontFamily: 'Exo2-RegularItalic',
			fill: colorToHexNumber(THEME_COLORS.AccentGold),
			wordWrap: true
		};
		this.centerContainer.addChild(this.warning);

		this.closeButton = new PIXI.Sprite(plusTexture);
		this.closeButton.rotation = Math.PI/4;
		this.closeButton.anchor.set(0.5, 0.5);
		this.centerContainer.addChild(this.closeButton);

		let closeButtonRegistration = new InteractionRegistration(this.closeButton);
		this.interactionGroup.add(closeButtonRegistration);
		closeButtonRegistration.addButtonHandlers(
			() => this.triggerClose(),
			() => this.closeButtonInterpolator.setReversedState(false, performance.now()),
			() => this.closeButtonInterpolator.setReversedState(true, performance.now()),
			EMPTY_FUNCTION,
			EMPTY_FUNCTION
		);

		this.selectButton = new Button(DEFAULT_BUTTON_WIDTH, DEFAULT_BUTTON_HEIGHT, 15, ButtonPivot.Center, 'select', colorToHexNumber(THEME_COLORS.PrimaryBlue));
		this.centerContainer.addChild(this.selectButton.container);

		this.selectButton.setupInteraction(this.interactionGroup, async () => {
			// Based on the supported method, call either the Native File System API or just a plain ol' <input type="file">.
			if (supportsNativeFileSystemApi()) {
				try {
					let handle = await chooseFileSystemEntries({type: 'open-directory'});
					let directory = VirtualDirectory.fromDirectoryHandle(handle);

					this.createTask(directory);
				} catch (e) {} 
			} else {
				let inputElement = document.createElement('input');
				inputElement.setAttribute('webkitdirectory', '');
				inputElement.setAttribute('type', 'file');
				inputElement.click();

				inputElement.addEventListener('change', () => {
					let files = inputElement.files;
					let directory = VirtualDirectory.fromFileList(files);

					this.createTask(directory);
				});
			}
		});

		this.loadingContainer = new PIXI.Container();
		this.centerContainer.addChild(this.loadingContainer);

		this.loadingText = new PIXI.Text("");
		this.loadingText.style = {
			fontFamily: 'Exo2-RegularItalic',
			fill: 0xffffff,
		};
		this.loadingText.alpha = 0.75;
		this.loadingContainer.addChild(this.loadingText);

		this.loadingIndicator = new LoadingIndicator(100);
		this.loadingContainer.addChild(this.loadingIndicator.container);

		this.fadeInInterpolator = new Interpolator({
			defaultToFinished: true,
			beginReversed: true,
			duration: 400,
			ease: EaseType.EaseOutCubic,
			reverseEase: EaseType.EaseInCubic
		});
		this.closeButtonInterpolator = new Interpolator({
			defaultToFinished: true,
			beginReversed: true,
			duration: 300,
			ease: EaseType.EaseOutCubic,
			reverseEase: EaseType.EaseInCubic
		});

		backgroundRegistration.addListener('keyDown', (e) => {
			if (e.keyCode === KeyCode.Escape) this.triggerClose();
		});

		this.resize();
		this.hide();
	}

	private createTask(directory: VirtualDirectory) {
		let task = new ImportBeatmapsFromDirectoryTask(directory);
		task.start();

		this.loadingTask = task;
		this.loadingIndicator.start();
		this.selectButton.registration.releaseAllPresses();

		task.addListener('done', () => {
			this.hide();
		});
	}

	private stopTask() {
		if (!this.loadingTask) return;
		
		this.loadingTask.destroy();
		this.loadingTask = null;
	}

	private triggerClose() {
		// If there's currently an active task, stop it. Otherwise close the entire panel.
		if (this.loadingTask) this.stopTask();
		else this.hide();
	}

	resize() {
		this.scalingFactor = calculateRatioBasedScalingFactor(currentWindowDimensions.width, currentWindowDimensions.height, 16/9, REFERENCE_SCREEN_HEIGHT);
		let slantWidth = PANEL_HEIGHT/5;

		this.background.width = currentWindowDimensions.width;
		this.background.height = currentWindowDimensions.height;

		this.mask.texture.destroy(true);
		this.mask.texture = createPolygonTexture(PANEL_WIDTH + slantWidth, PANEL_HEIGHT, [
			new PIXI.Point(0, 0), new PIXI.Point(PANEL_WIDTH, 0), new PIXI.Point(PANEL_WIDTH + slantWidth, PANEL_HEIGHT), new PIXI.Point(slantWidth, PANEL_HEIGHT)
		], this.scalingFactor);
		this.centerContainerBackground.width = Math.ceil((PANEL_WIDTH + slantWidth) * this.scalingFactor);
		this.centerContainerBackground.height = Math.ceil(PANEL_HEIGHT * this.scalingFactor);

		this.centerContainer.y = Math.floor(currentWindowDimensions.height / 2);
		this.centerContainer.pivot.x = Math.floor((PANEL_WIDTH + slantWidth) * this.scalingFactor / 2);
		this.centerContainer.pivot.y = Math.floor(PANEL_HEIGHT * this.scalingFactor / 2);

		this.header.style.fontSize = Math.floor(22 * this.scalingFactor);
		this.header.y = Math.floor(TOP_MARGIN * this.scalingFactor);

		this.description.style.fontSize = Math.floor(12 * this.scalingFactor);
		this.description.style.wordWrapWidth = this.description.style.fontSize * 28;
		this.description.y = Math.floor((TOP_MARGIN + 35) * this.scalingFactor);

		this.warning.style.fontSize = Math.floor(10 * this.scalingFactor);
		this.warning.style.wordWrapWidth = this.description.style.fontSize * 28;
		this.warning.y = Math.floor((TOP_MARGIN + 80) * this.scalingFactor);

		this.closeButton.width = Math.floor(20 * this.scalingFactor);
		this.closeButton.height = this.closeButton.width;
		this.closeButton.x = Math.floor((PANEL_WIDTH - 20) * this.scalingFactor);
		this.closeButton.y = Math.floor(20 * this.scalingFactor);

		this.selectButton.resize(this.scalingFactor);
		this.selectButton.container.x = Math.floor((PANEL_WIDTH + slantWidth) / 2 * this.scalingFactor);
		this.selectButton.container.y = Math.floor(200 * this.scalingFactor);

		this.loadingContainer.x = this.selectButton.container.x;
		this.loadingContainer.y = Math.floor(170 * this.scalingFactor);
		this.loadingText.style.fontSize = Math.floor(10 * this.scalingFactor);
		
		this.loadingIndicator.resize(this.scalingFactor);
		this.loadingIndicator.container.pivot.x = Math.floor(this.loadingIndicator.width * this.scalingFactor / 2);
		this.loadingIndicator.container.y = Math.floor(25 * this.scalingFactor);
	}

	update(now: number) {
		let fadeInCompletion = this.fadeInInterpolator.getCurrentValue(now);
		if (fadeInCompletion === 0) {
			this.container.visible = false;
			return;
		}
		this.container.visible = true;

		this.container.alpha = fadeInCompletion;
		this.centerContainer.x = Math.floor(currentWindowDimensions.width / 2) - 40 * (1 - fadeInCompletion) * this.scalingFactor;

		let headerNudge = -40 * (1 - fadeInCompletion) * this.scalingFactor;

		this.closeButton.alpha = MathUtil.lerp(0.25, 0.75, this.closeButtonInterpolator.getCurrentValue(now));
		this.selectButton.update(now);

		if (this.loadingTask) {
			this.loadingContainer.visible = true;
			this.selectButton.container.visible = false;
			this.selectButton.disable();
			this.warning.visible = false;

			let loadingTaskProgress = this.loadingTask.getProgress();
			if (loadingTaskProgress) {
				let n = loadingTaskProgress.dataCompleted;
				this.loadingText.text = `Importing ${n} beatmap ${(n === 1)? 'set' : 'sets'}...`;
			}
			
			this.loadingText.pivot.x = Math.floor(this.loadingText.width / 2);
			this.loadingIndicator.update(now);
		} else {
			this.loadingContainer.visible = false;
			this.selectButton.container.visible = true;
			this.selectButton.enable();

			this.warning.visible = !supportsNativeFileSystemApi();
			this.warning.x = this.description.x = this.header.x = Math.floor(LEFT_MARGIN * this.scalingFactor);
			this.warning.x += headerNudge * 0.6;
		}

		this.header.x += headerNudge;
		this.description.x += headerNudge * 0.8;
	}

	hide() {
		this.interactionGroup.disable();
		this.fadeInInterpolator.setReversedState(true, performance.now());
	}

	show() {
		this.interactionGroup.enable();
		this.fadeInInterpolator.setReversedState(false, performance.now());

		this.stopTask();
	}
}