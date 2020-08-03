import { VirtualDirectory } from "../../file_system/virtual_directory";
import { globalState } from "../../global_state";
import { removeHTMLElement } from "../../util/misc_util";
import { ImportBeatmapsFromDirectoryTask } from "../../datamodel/beatmap/beatmap_library";

const songFolderSelect = document.querySelector('#songs-folder-select') as HTMLInputElement;
songFolderSelect.addEventListener('change', async () => {
	removeHTMLElement(document.querySelector('#temp-controls') as HTMLElement);

	let directory = VirtualDirectory.fromFileList(songFolderSelect.files);
	let task = new ImportBeatmapsFromDirectoryTask(directory);
	task.start();

	globalState.songSelect.show();
});

export const launchButton = document.querySelector('#launch-button') as HTMLButtonElement;
launchButton.addEventListener('click', () => {
	removeHTMLElement(document.querySelector('#temp-controls') as HTMLElement);
	globalState.songSelect.show();
});