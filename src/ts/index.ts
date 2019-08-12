import './visuals/ui';
import './visuals/simple_beatmap_selector';
import { currentSkin } from './game/skin';

const osu: string | null = 'ORERU!';

async function init() {
    await currentSkin.init();

    console.log(osu!); // Love the syntax <3
}

window.addEventListener('load', init);