import { colorToHexNumber } from "../../util/graphics_util";
import { DEFAULT_BUTTON_HEIGHT, Button, DEFAULT_BUTTON_WIDTH, ButtonPivot } from "../components/button";
import { THEME_COLORS } from "../../util/constants";
import { supportsNativeFileSystemApi, addNounToNumber } from "../../util/misc_util";
import { VirtualDirectory } from "../../file_system/virtual_directory";
import { LoadingIndicator } from "../components/loading_indicator";
import { globalState } from "../../global_state";
import { PopupFrame } from "../components/popup_frame";
import { ImportBeatmapsFromDirectoriesTask } from "../../datamodel/beatmap/beatmap_library";

const PANEL_WIDTH = 420;
const PANEL_HEIGHT = 250;

export class FolderSelector extends PopupFrame {
	/** A warning that will be shown when the Native File System API isn't available. */
	private warning: PIXI.Text;

	private selectButton: Button;

	private loadingContainer: PIXI.Container;
	private loadingText: PIXI.Text;
	private loadingIndicator: LoadingIndicator;

	private loadingTask: ImportBeatmapsFromDirectoriesTask = null;

	constructor() {
		super({
			width: PANEL_WIDTH,
			height: PANEL_HEIGHT,
			headerText: "import folder",
			descriptionText: "Select a folder with beatmaps, a single beatmap folder or a beatmap file. (.osz)",
			enableCloseButton: true,
			buttons: []
		});

		this.warning = new PIXI.Text("WARNING: Your browser doesn't yet support the Native File System API, or it is disabled. This means that loading folders with more than ~500 beatmaps will freeze your browser for a considerable amount of time.");
		this.warning.style = {
			fontFamily: 'Exo2-RegularItalic',
			fill: colorToHexNumber(THEME_COLORS.AccentGold),
			wordWrap: true
		};
		this.centerContainer.addChild(this.warning);

		this.selectButton = new Button(DEFAULT_BUTTON_WIDTH, DEFAULT_BUTTON_HEIGHT, 15, ButtonPivot.Center, 'select', colorToHexNumber(THEME_COLORS.PrimaryBlue));
		this.centerContainer.addChild(this.selectButton.container);

		this.selectButton.setupInteraction(this.interactionGroup, async () => {
			// Based on the supported method, call either the Native File System API or just a plain ol' <input type="file">.
			if (supportsNativeFileSystemApi()) {
				try {
					// Get all stored directory handles
					let storedHandles = await globalState.database.findAll('directoryHandle', () => true);
					let handle = await chooseFileSystemEntries({type: 'open-directory'});
					let id = ULID.ulid();
					let storedHandleFound = false;

					for (let handleData of storedHandles) {
						// See if a stored handle matches the currently selected one. If so, import is easy.
						if (await handleData.handle.isSameEntry(handle)) {
							id = handleData.id;
							storedHandleFound = true;
							break;
						}
					}
					
					let directory = VirtualDirectory.fromDirectoryHandle(handle, true, id);

					if (storedHandleFound) {
						// Store again to update the permission state
						await globalState.database.put('directoryHandle', { id, handle, permissionGranted: true });

						globalState.beatmapLibrary.reopenImportedDirectories([directory]);
						this.hide();
					} else {
						this.createTask(directory);
					}
				} catch (e) {} 
			} else {
				// Create a temporary input element, then click it
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

		this.resize();
		this.hide();
	}

	private createTask(directory: VirtualDirectory) {
		let task = new ImportBeatmapsFromDirectoriesTask([directory]);
		task.start();

		this.loadingTask = task;
		this.loadingIndicator.start();
		this.selectButton.registration.releaseAllPresses();

		// Close the panel when the task is done
		task.getResult().finally(() => this.hide());
	}

	private stopTask() {
		if (!this.loadingTask) return;
		
		this.loadingTask.destroy();
		this.loadingTask = null;
	}

	triggerClose() {
		// If there's currently an active task, stop it. Otherwise close the entire panel.
		if (this.loadingTask) this.stopTask();
		else this.hide();
	}

	resize() {
		super.resize();

		let slantWidth = this.options.height/5;

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
		if (!super.update(now)) return false;

		this.selectButton.update(now);
		let headerNudge = -40 * (1 - this.fadeInInterpolator.getCurrentValue(now)) * this.scalingFactor;

		if (this.loadingTask) {
			this.loadingContainer.visible = true;
			this.selectButton.container.visible = false;
			this.selectButton.disable();
			this.warning.visible = false;

			let loadingTaskProgress = this.loadingTask.getProgress();
			if (loadingTaskProgress) {
				let n = loadingTaskProgress.dataCompleted;
				this.loadingText.text = `${addNounToNumber(n, "beatmap set", "beatmap sets")} found...`;//  `Importing ${n} beatmap ${(n === 1)? 'set' : 'sets'}...`;
			} else {
				this.loadingText.text = "Importing...";
			}
			
			this.loadingText.pivot.x = Math.floor(this.loadingText.width / 2);
			this.loadingIndicator.update(now);
		} else {
			this.loadingContainer.visible = false;
			this.selectButton.container.visible = true;
			this.selectButton.enable();

			this.warning.visible = !supportsNativeFileSystemApi();
			this.warning.x = this.description.x;
			this.warning.x -= headerNudge * 0.2;
		}

		return true;
	}

	show() {
		super.show();
		this.stopTask();
	}
}