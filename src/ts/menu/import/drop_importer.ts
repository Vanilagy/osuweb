import { VirtualFile } from "../../file_system/virtual_file";
import { VirtualDirectory } from "../../file_system/virtual_directory";
import { InteractionGroup, InteractionRegistration } from "../../input/interactivity";
import { Interpolator } from "../../util/interpolation";
import { currentWindowDimensions, REFERENCE_SCREEN_HEIGHT } from "../../visuals/ui";
import { svgToTexture } from "../../util/pixi_util";
import { ImportStatusDisplay } from "./import_status_display";
import { KeyCode } from "../../input/input";
import { Point, lerpPoints, addToPoint } from "../../util/point";
import { MathUtil, EaseType } from "../../util/math_util";
import { globalState } from "../../global_state";
import { THEME_COLORS } from "../../util/constants";
import { isOsuArchiveFile } from "../../util/file_util";

const fileDownloadTexture = svgToTexture(document.querySelector('#svg-file-download'), true, 512);
const folderCreateTexture = svgToTexture(document.querySelector('#svg-folder-create'), true, 512);

export class DropImporter {
	public container: PIXI.Container;
	public interactionGroup: InteractionGroup;
	public scalingFactor: number = 1;

	private background: PIXI.Sprite;
	private fadeInInterpolator: Interpolator;
	
	private icon: PIXI.Sprite;
	private text: PIXI.Text;
	private statusDisplay: ImportStatusDisplay;

	/** Interpolates between the "drop" and "importing" state. */
	private activeInterpolator: Interpolator;
	private showStartTime: number = 0;

	constructor() {
		this.container = new PIXI.Container();
		this.interactionGroup = new InteractionGroup();

		this.background = new PIXI.Sprite(PIXI.Texture.WHITE);
		this.background.tint = 0x000000;
		this.background.alpha = 0.8;
		this.container.addChild(this.background);

		this.icon = new PIXI.Sprite(fileDownloadTexture);
		this.container.addChild(this.icon);

		this.text = new PIXI.Text("drop here to import", {
			fontFamily: 'Exo2-Regular',
			fill: 0xffffff
		});
		this.container.addChild(this.text);

		this.statusDisplay = new ImportStatusDisplay();
		this.container.addChild(this.statusDisplay.container);

		this.fadeInInterpolator = new Interpolator({
			duration: 300,
			reverseDuration: 150,
			ease: EaseType.EaseOutQuint,
			reverseEase: EaseType.EaseInQuad,
			beginReversed: true,
			defaultToFinished: true
		});

		document.documentElement.addEventListener('dragenter', () => this.isDroppable() && this.show());
		document.documentElement.addEventListener('dragleave', () => this.hide());
		document.documentElement.addEventListener('dragover', (e) => e.preventDefault());
		document.documentElement.addEventListener('drop', async (e) => {
			e.preventDefault();
			if (!this.isDroppable()) return;
			if (e.dataTransfer.files.length === 0) {
				// No files were dropped
				this.hide();
				return;
			}

			let directoryToImport: VirtualDirectory;

			let fileSystemEntry = await fromDataTransfer(e.dataTransfer);
			if (fileSystemEntry instanceof VirtualDirectory) {
				directoryToImport = fileSystemEntry;
			} else {
				if (isOsuArchiveFile(fileSystemEntry.name)) {
					directoryToImport = await VirtualDirectory.fromZipFile(fileSystemEntry);
				}
			}

			if (directoryToImport) {
				this.statusDisplay.createTask([directoryToImport]);
				this.activeInterpolator.setReversedState(false, performance.now());

				// Hide the folder selector if it wasn't doing something
				if (!globalState.folderSelector.statusDisplay.task) globalState.folderSelector.hide();
			} else {
				globalState.toastManager.showToast("Cannot import this file.", THEME_COLORS.JudgementMiss);
				this.hide();
			}
		});

		let registration = new InteractionRegistration(this.container);
		registration.enableEmptyListeners();
		registration.addListener('keyDown', (e) => {
			if (e.keyCode === KeyCode.Escape) {
				this.statusDisplay.stopTask(); // Destroy the task
				this.hide();
			}
		});
		this.interactionGroup.add(registration);

		this.activeInterpolator = new Interpolator({
			duration: 1000,
			ease: EaseType.EaseOutElasticHalf,
			defaultToFinished: true,
			beginReversed: true
		});

		this.resize();
		this.hide();
	}

	private isDroppable() {
		return !globalState.gameplayController.currentPlay;
	}

	resize() {
		let scalingFactor = currentWindowDimensions.height / REFERENCE_SCREEN_HEIGHT;
		this.scalingFactor = scalingFactor;

		this.background.width = currentWindowDimensions.width;
		this.background.height = currentWindowDimensions.height;

		this.icon.width = this.icon.height = Math.floor(70 * scalingFactor);
		this.icon.x = Math.floor((currentWindowDimensions.width - this.icon.width) / 2);
		this.icon.y = Math.floor((currentWindowDimensions.height - this.icon.height) / 2 - 40 * scalingFactor);
		this.icon.anchor.set(0.5, 0.5);

		this.text.style.fontSize = Math.floor(20 * scalingFactor);
		this.text.x = Math.floor((currentWindowDimensions.width) / 2);
		this.text.y = Math.floor(currentWindowDimensions.height / 2 + 40 * scalingFactor);

		this.statusDisplay.resize(scalingFactor);
		this.statusDisplay.container.x = Math.floor(currentWindowDimensions.width / 2);
		this.statusDisplay.container.y = this.text.y;
	}

	update(now: number) {
		let fadeInValue = this.fadeInInterpolator.getCurrentValue(now);
		let activeValue = this.activeInterpolator.getCurrentValue(now);

		this.container.alpha = fadeInValue;

		if (this.statusDisplay.task) {
			this.statusDisplay.update(now);
			// If the task already went through all files and directories, hide the drop importer.
			if (this.statusDisplay.task.entryReadingComplete) this.hide();
		}

		this.statusDisplay.container.alpha = MathUtil.clamp(activeValue, 0, 1);
		this.text.alpha = MathUtil.clamp(1 - activeValue, 0, 1);
		this.text.scale.set(1);
		this.text.pivot.x = Math.floor(this.text.width / 2);
		this.text.pivot.y = MathUtil.lerp(20 * this.scalingFactor, 0, fadeInValue);
		this.text.scale.set(MathUtil.lerp(0.8, 1.0, fadeInValue));

		let x = (now - this.showStartTime) / 250 + 1;
		let parabolaVal = -((MathUtil.adjustedMod(x, 2) - 1)**2) + 1; // To simulate a bouncing ball effect

		let iconIdlePosition: Point = {x: 0, y: (-80 -parabolaVal * 20) * this.scalingFactor};
		let iconIdleScale = 1;
		let iconActivePosition: Point = {x: 0, y: -20 * this.scalingFactor};
		let iconActiveScale = MathUtil.lerp(0.5, 0.55, Math.sin(now / 200) * 0.5 + 0.5); // Pulses

		// Interpolate the position and scale
		let iconPosition = addToPoint(lerpPoints(iconIdlePosition, iconActivePosition, activeValue), {x: currentWindowDimensions.width/2, y: currentWindowDimensions.height/2 + MathUtil.lerp(-100 * this.scalingFactor, 0, fadeInValue)});
		let iconScale = MathUtil.lerp(iconIdleScale, iconActiveScale, activeValue) * MathUtil.lerp(0.4, 1.0, fadeInValue);

		this.icon.position.set(iconPosition.x, iconPosition.y);
		this.icon.width = this.icon.height = 70 * this.scalingFactor * iconScale;
		if (this.activeInterpolator.isReversed()) this.icon.texture = fileDownloadTexture;
		else this.icon.texture = folderCreateTexture;
	}
	
	show() {
		if (this.interactionGroup.enabled) return;

		this.activeInterpolator.setReversedState(true, -Infinity);
		this.fadeInInterpolator.setReversedState(false, performance.now());
		this.interactionGroup.enable();

		this.showStartTime = performance.now();
	}

	hide() {
		this.fadeInInterpolator.setReversedState(true, performance.now());
		this.interactionGroup.disable();

		this.statusDisplay.stopTask(false);
	}
}

/** Creates the correct VirtualFileSystemEntry based on the data transfer. */
async function fromDataTransfer(transfer: DataTransfer) {
	let fileEntries = [...transfer.items].map(item => {
		let entry = item.webkitGetAsEntry();

		if (entry.isFile) {
			return VirtualFile.fromFileEntry(entry);
		} else {
			return VirtualDirectory.fromDirectoryEntry(entry);
		}
	});

	if (fileEntries.length === 1) return fileEntries[0];
	else {
		let group = new VirtualDirectory('group');
		for (let entry of fileEntries) group.addEntry(entry);

		return group;
	}
}