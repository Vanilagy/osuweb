import { VirtualDirectory } from "../file_system/virtual_directory";
import { VirtualFile } from "../file_system/virtual_file";
import { globalState } from "../global_state";
import { ModHelper } from "../game/mods/mod_helper";
import { removeHTMLElement } from "../util/misc_util";
import { BeatmapSet } from "../datamodel/beatmap/beatmap_set";
import { BeatmapParser } from "../datamodel/beatmap/beatmap_parser";

const beatmapFileSelect = document.querySelector('#beatmap-select') as HTMLInputElement;
beatmapFileSelect.style.display = 'none';

beatmapFileSelect.addEventListener('change', async (e) => {
	let directory = VirtualDirectory.fromFileList(beatmapFileSelect.files);
	let beatmapSet = new BeatmapSet(directory);

	await beatmapSet.loadEntries();

	let selectedOsuFile: VirtualFile;
	if (beatmapSet.entries.length === 1) selectedOsuFile = beatmapSet.entries[0].resource;
	else {
		let promptStr = 'Select a beatmap by entering the number:\n';
		beatmapSet.entries.forEach((entry, index) => {
			let name = entry.resource.name;
			promptStr += index + ': ' + name + '\n';
		});

		let selection = prompt(promptStr);
		if (selection !== null) selectedOsuFile = beatmapSet.entries[Number(selection)].resource;
	}

	if (!selectedOsuFile) return;

	removeHTMLElement(document.querySelector('#temp-controls') as HTMLElement);

	let beatmap = BeatmapParser.parse(await selectedOsuFile.readAsText(), beatmapSet, false);
	let mods = ModHelper.getModsFromModCode(prompt("Enter mod code:"));
	await globalState.gameplayController.startPlayFromBeatmap(beatmap, mods);
});

export function showChooseFile() {
	beatmapFileSelect.style.display = 'block';
}