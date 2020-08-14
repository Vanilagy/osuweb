import { colorToHexNumber } from "../../util/graphics_util";
import { DEFAULT_BUTTON_HEIGHT, Button, DEFAULT_BUTTON_WIDTH, ButtonPivot } from "../components/button";
import { THEME_COLORS } from "../../util/constants";
import { supportsNativeFileSystemApi } from "../../util/misc_util";
import { VirtualDirectory } from "../../file_system/virtual_directory";
import { globalState } from "../../global_state";
import { PopupFrame } from "../components/popup_frame";
import { ImportStatusDisplay } from "./import_status_display";

const PANEL_WIDTH = 420;
const PANEL_HEIGHT = 250;

export class FolderSelector extends PopupFrame {
	/** Show that files can be imported via drag and drop as the preferred method when no Native File System API is available. */
	private dragAndDropNotice: PIXI.Text;
	private selectButton: Button;
	public statusDisplay: ImportStatusDisplay;

	constructor() {
		super({
			width: PANEL_WIDTH,
			height: PANEL_HEIGHT,
			headerText: "import folder",
			descriptionText: "Import a folder with beatmaps, a single beatmap folder or a beatmap file. (.osz)",
			enableCloseButton: true,
			buttons: []
		});

		this.dragAndDropNotice = new PIXI.Text("drag and drop to import", {
			fontFamily: 'Exo2-Regular',
			fill: 0xffffff
		});
		this.centerContainer.addChild(this.dragAndDropNotice);

		this.selectButton = new Button(DEFAULT_BUTTON_WIDTH, DEFAULT_BUTTON_HEIGHT, 15, ButtonPivot.Center, 'select folder', colorToHexNumber(THEME_COLORS.PrimaryBlue));
		this.centerContainer.addChild(this.selectButton.container);

		this.selectButton.setupInteraction(this.interactionGroup, async () => {
			// Based on the supported method, call either the Native File System API or just a plain ol' <input type="file">.
			if (supportsNativeFileSystemApi()) {
				try {
					// Get all stored directory handles
					let storedHandles = await globalState.database.getAll('directoryHandle');
					let handle = await chooseFileSystemEntries({type: 'open-directory'});
					let id = ULID.ulid();
					let matchingStoredHandle: typeof storedHandles[number];

					for (let handleData of storedHandles) {
						// See if a stored handle matches the currently selected one. If so, import is easy.
						if (await handleData.handle.isSameEntry(handle)) {
							id = handleData.id;
							matchingStoredHandle = handleData;
							break;
						}
					}
					
					let directory = VirtualDirectory.fromDirectoryHandle(handle, true, id);

					if (matchingStoredHandle) {
						// Store again to update the permission state
						matchingStoredHandle.permissionGranted = true;
						await globalState.database.put('directoryHandle', matchingStoredHandle);

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

		this.statusDisplay = new ImportStatusDisplay();
		this.centerContainer.addChild(this.statusDisplay.container);

		this.resize();
		this.hide();
	}

	private createTask(directory: VirtualDirectory) {
		this.selectButton.registration.releaseAllPresses();
		this.statusDisplay.createTask([directory]);

		// Close the panel when the task is done
		this.statusDisplay.task.getResult().finally(() => this.hide());
	}

	triggerClose() {
		// If there's currently an active task, stop it. Otherwise close the entire panel.
		if (this.statusDisplay.task) this.statusDisplay.stopTask();
		else this.hide();
	}

	resize() {
		super.resize();

		let slantWidth = this.options.height/5;

		this.selectButton.resize(this.scalingFactor);
		this.selectButton.container.x = Math.floor((PANEL_WIDTH + slantWidth) / 2 * this.scalingFactor);
		this.selectButton.container.y = Math.floor(200 * this.scalingFactor);

		this.statusDisplay.resize(this.scalingFactor);
		this.statusDisplay.container.x = this.selectButton.container.x;
		this.statusDisplay.container.y = Math.floor(170 * this.scalingFactor);

		this.dragAndDropNotice.style.fontSize = Math.floor(20 * this.scalingFactor);
		this.dragAndDropNotice.x = Math.floor(this.selectButton.container.x - this.dragAndDropNotice.width / 2);
		this.dragAndDropNotice.y = Math.floor(this.selectButton.container.y - 20 * this.scalingFactor);
	}

	update(now: number) {
		if (!super.update(now)) return false;

		this.selectButton.update(now);

		if (this.statusDisplay.task) {
			this.statusDisplay.update(now);
			this.statusDisplay.container.visible = true;
			this.selectButton.container.visible = false;
			this.selectButton.disable();
			this.dragAndDropNotice.visible = false;
		} else {
			this.statusDisplay.container.visible = false;

			if (supportsNativeFileSystemApi()) {
				this.selectButton.container.visible = true;
				this.selectButton.enable();
				this.dragAndDropNotice.visible = false;
			} else {
				// Hide the button, because drag and dropping is simply the superior method.
				this.selectButton.container.visible = false;
				this.selectButton.disable();
				this.dragAndDropNotice.visible = true;
			}
		}

		return true;
	}

	show() {
		super.show();
		this.statusDisplay.stopTask();
	}
}