import './visuals/ui';
import './visuals/simple_beatmap_selector';
import './menu/song_select/beatmap_carousel';
import { baseSkin } from './game/skin/skin';
import { showChooseFile } from './visuals/simple_beatmap_selector';

const osu: string | null = 'ORERU!';

async function init() {
    await baseSkin.init();
    showChooseFile();

    console.log(osu!); // Love the syntax <3
}

window.addEventListener('load', init);