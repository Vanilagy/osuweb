import { Beatmap } from "../datamodel/beatmap";
import { startPlay } from "../game/play";
import { BeatmapSet } from "../datamodel/beatmap_set";
import { VirtualDirectory } from "../file_system/virtual_directory";
import { VirtualFile } from "../file_system/virtual_file";

const beatmapFileSelect = document.querySelector('#beatmapSelect') as HTMLInputElement;

beatmapFileSelect.addEventListener('change', async (e) => {
    let directory = VirtualDirectory.fromFileList(beatmapFileSelect.files);
    let beatmapSet = new BeatmapSet(directory);

    let beatmapFiles = beatmapSet.getBeatmapFiles();

    let selectedOsuFile: VirtualFile;
    if (beatmapFiles.length === 1) selectedOsuFile = beatmapFiles[0];
    else {
        let promptStr = 'Select a beatmap by entering the number:\n';
        beatmapFiles.forEach((file, index) => {
            let name = file.name;
            promptStr += index + ': ' + name + '\n';
        });

        let selection = prompt(promptStr);
        if (selection !== null) selectedOsuFile = beatmapFiles[Number(selection)];
    }

    if (!selectedOsuFile) return;

    beatmapFileSelect.style.display = 'none';

    new Beatmap({
        text: await selectedOsuFile.readAsText(),
        beatmapSet: beatmapSet
    }, (map) => {
        startPlay(map);
    });
});