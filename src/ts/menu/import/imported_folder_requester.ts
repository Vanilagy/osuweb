import { PopupFrame } from "../components/popup_frame";
import { globalState } from "../../global_state";
import { THEME_COLORS } from "../../util/constants";
import { VirtualDirectory } from "../../file_system/virtual_directory";

/** The popup dialogue used to prompt the user to grant permission to the Native File System API. */
export class ImportedFolderRequester extends PopupFrame {
	constructor() {
		super({
			width: 420,
			height: 120,
			headerText: "Reopen imported folders",
			descriptionText: "You need to give this page permission to reopen the beatmap folders you have previously imported. This can always be done later.",
			enableCloseButton: true,
			buttons: [{
				label: 'allow',
				color: THEME_COLORS.PrimaryBlue,
				onclick: () => this.requestPermission()
			},
			{
				label: 'forbid',
				color: THEME_COLORS.SecondaryActionGray,
				onclick: () => this.forbid()
			}]
		});

		this.resize();
		this.hide();
	}

	private async requestPermission() {
		let storedHandles = await globalState.database.getAll('directoryHandle');
		let directories: VirtualDirectory[] = [];

		// Go through all stored handles and request permission individually
		for (let handleData of storedHandles) {
			if (!handleData.permissionGranted) continue;

			let state = await handleData.handle.requestPermission();
			if (state !== 'granted') {
				handleData.permissionGranted = false;
				await globalState.database.put('directoryHandle', handleData);
			} else {
				let directory = VirtualDirectory.fromDirectoryHandle(handleData.handle, true, handleData.id);
				directories.push(directory);
			}
		}

		globalState.beatmapLibrary.reopenImportedDirectories(directories);
		this.hide();
	}

	/** Remove the permission of all handles in the database, so that the prompt for these directories doesn't show up the next time. */
	private async forbid() {
		let storedHandles = await globalState.database.getAll('directoryHandle');
		for (let data of storedHandles) {
			data.permissionGranted = false;
			await globalState.database.put('directoryHandle', data);
		}

		this.hide();
	}
}