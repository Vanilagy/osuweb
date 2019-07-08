import { Beatmap } from "../datamodel/beatmap";
import { startPlay } from "../game/play";
import { BeatmapSet } from "../datamodel/beatmap_set";
import { readFileAsText } from "../util/file_util";

const beatmapFileSelect = document.querySelector('#beatmapSelect') as HTMLInputElement;

beatmapFileSelect.addEventListener('change', async (e) => {
    let beatmapSet = new BeatmapSet([...beatmapFileSelect.files]);

    let selectedOsuFile: File;
    if (beatmapSet.osuFiles.length === 1) selectedOsuFile = beatmapSet.osuFiles[0];
    else {
        let promptStr = 'Select a beatmap by entering the number:\n';
        beatmapSet.osuFiles.forEach((file, index) => {
            let name = file.name;
            promptStr += index + ': ' + name + '\n';
        });

        let selection = prompt(promptStr);
        if (selection !== null) selectedOsuFile = beatmapSet.osuFiles[Number(selection)];
    }

    if (!selectedOsuFile) return;

    beatmapFileSelect.style.display = 'none';

    new Beatmap({
        text: await readFileAsText(selectedOsuFile),
        beatmapSet: beatmapSet
    }, (map) => {
        startPlay(map);
    });
});