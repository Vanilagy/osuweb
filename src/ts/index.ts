import './visuals/ui';
import './visuals/simple_beatmap_selector';
import { initSkin } from './game/skin';

const osu: string | null = 'ORERU!';

async function init() {
    await initSkin();

    console.log(osu!); // Love the syntax <3
}

window.addEventListener('load', init);