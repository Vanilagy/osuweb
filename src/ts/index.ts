import './visuals/ui';
import './visuals/simple_beatmap_selector';
import { currentSkin } from './game/skin';
import { initHud } from './game/hud';

const osu: string | null = 'ORERU!';

async function init() {
    await currentSkin.init();
    await initHud();

    console.log(osu!); // Love the syntax <3
}

window.addEventListener('load', init);