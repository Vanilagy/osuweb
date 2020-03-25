import { VirtualDirectory } from "../../file_system/virtual_directory";
import { BeatmapSet } from "../../datamodel/beatmap_set";
import { globalState } from "../../global_state";
import { defaultBeatmapCarouselSortingType } from "./beatmap_carousel";
import { removeHTMLElement } from "../../util/misc_util";

const songFolderSelect = document.querySelector('#songs-folder-select') as HTMLInputElement;
songFolderSelect.addEventListener('change', async () => {
	removeHTMLElement(document.querySelector('#temp-controls') as HTMLElement);

	let songSelect = globalState.songSelect;
	let directory = VirtualDirectory.fromFileList(songFolderSelect.files);
	let promises: Promise<unknown>[] = [];

	directory.forEach((entry) => {
		if (!(entry instanceof VirtualDirectory)) return;

		let beatmapSet = new BeatmapSet(entry);
		songSelect.loadedBeatmapSets.push(beatmapSet);
		promises.push(beatmapSet.init());
	});

	await Promise.all(promises);

	songSelect.carousel.showBeatmapSets(songSelect.loadedBeatmapSets, defaultBeatmapCarouselSortingType);
	songSelect.show();
});